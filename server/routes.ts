import { Express, Request, Response, NextFunction } from "express";
import multer from "multer";
import { storage } from "./storage";
import path from "path";
import { registerPaymentRoutes } from "./routes/payments";
// GPT Bypass Humanizer imports
import { fileProcessorService } from "./services/fileProcessor";
import { textChunkerService } from "./services/textChunker";
import { gptZeroService } from "./services/gptZero";
import { aiProviderService } from "./services/aiProviders";
import { type RewriteRequest, type RewriteResponse } from "@shared/schema";
import { extractTextFromFile } from "./api/documentParser";
import { sendSimpleEmail } from "./api/simpleEmailService";
import { upload as speechUpload, processSpeechToText } from "./api/simpleSpeechToText";


// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Configure multer for GPT Bypass file uploads
const gptBypassUpload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

interface DocumentInput {
  content: string;
  filename?: string;
  mimeType?: string;
  metadata?: {
    pageCount?: number;
    info?: Record<string, any>;
    version?: string;
    [key: string]: any;
  };
}

interface AIDetectionResult {
  isAI: boolean;
  probability: number;
}

// Map ZHI names to actual provider names
function mapZhiToProvider(zhiName: string): string {
  const mapping: Record<string, string> = {
    'zhi1': 'openai',
    'zhi2': 'anthropic', 
    'zhi3': 'deepseek',
    'zhi4': 'perplexity',
    'zhi5': 'grok'
  };
  return mapping[zhiName] || zhiName;
}

// Helper function to clean markup from AI responses
function cleanMarkup(text: string): string {
  return text
    // Remove markdown bold/italic markers
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    // Remove markdown headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove inline code backticks
    .replace(/`([^`]+)`/g, '$1')
    // Remove code block markers
    .replace(/```[\s\S]*?```/g, (match) => {
      return match.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '');
    })
    // Remove other common markdown symbols
    .replace(/~~([^~]+)~~/g, '$1') // strikethrough
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/>\s+/gm, '') // blockquotes
    // Remove excessive whitespace and clean up
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// REAL-TIME STREAMING: Case Assessment for ALL ZHI providers
async function streamCaseAssessment(text: string, provider: string, res: any, context?: string) {
  let prompt = `Assess how well this text makes its case. Analyze argument effectiveness, proof quality, claim credibility and provide specific numerical scores.

REQUIRED FORMAT:
PROOF EFFECTIVENESS: [0-100]/100
CLAIM CREDIBILITY: [0-100]/100  
NON-TRIVIALITY: [0-100]/100
PROOF QUALITY: [0-100]/100
FUNCTIONAL WRITING: [0-100]/100
OVERALL CASE SCORE: [0-100]/100

Then provide detailed analysis organized into sections:

**Strengths:**
- [List key strengths]

**Weaknesses:**  
- [List key weaknesses]

**Potential Counterarguments:**
- [List potential counterarguments]

**Conclusion:**
[Final assessment]`;
  
  // Add context information if provided
  if (context && context.trim()) {
    prompt += `\n\nIMPORTANT CONTEXT: ${context.trim()}\n\nPlease adjust your evaluation approach based on this context. For example, if this is "an abstract" or "a fragment", do not penalize it for lacking full development that would be expected in a complete work.`;
  }
  
  prompt += `\n\nTEXT TO ASSESS:\n${text}`;

  if (provider === 'openai') {
    // ZHI 1: OpenAI streaming
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        stream: true,
        max_tokens: 4000,
        temperature: 0.7,
      }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              res.write(content);
              (res as any).flush?.();
            }
          } catch (e) {}
        }
      }
    }
  } else if (provider === 'anthropic') {
    // ZHI 2: Anthropic streaming
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        stream: true,
        messages: [{ role: 'user', content: prompt }]
      }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              res.write(parsed.delta.text);
              (res as any).flush?.();
            }
          } catch (e) {}
        }
      }
    }
  } else if (provider === 'deepseek') {
    // ZHI 3: DeepSeek streaming
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        stream: true,
        max_tokens: 4000,
      }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              res.write(content);
              (res as any).flush?.();
            }
          } catch (e) {}
        }
      }
    }
  } else if (provider === 'grok') {
    // ZHI 4: Grok streaming
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-3',
        messages: [{ role: 'user', content: prompt }],
        stream: true,
        max_tokens: 4000,
        temperature: 0.7,
      }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              res.write(content);
              (res as any).flush?.();
            }
          } catch (e) {}
        }
      }
    }
  } else if (provider === 'perplexity') {
    // Perplexity streaming
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [{ role: 'user', content: prompt }],
        stream: true,
        max_tokens: 4000,
      }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              res.write(content);
              (res as any).flush?.();
            }
          } catch (e) {}
        }
      }
    }
  }
  res.end();
}

// REAL-TIME STREAMING: Fiction Assessment for ALL ZHI providers
async function streamFictionAssessment(text: string, provider: string, res: any) {
  const prompt = `Assess this fiction text for literary quality, narrative effectiveness, character development, and prose style:

${text}

Provide detailed analysis of literary merit, character development, plot structure, and creative intelligence.`;

  if (provider === 'openai') {
    // ZHI 1: OpenAI streaming
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        stream: true,
        max_tokens: 4000,
        temperature: 0.7,
      }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              res.write(content);
              (res as any).flush?.();
            }
          } catch (e) {}
        }
      }
    }
  } else if (provider === 'anthropic') {
    // ZHI 2: Anthropic streaming
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        stream: true,
        messages: [{ role: 'user', content: prompt }]
      }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              res.write(parsed.delta.text);
              (res as any).flush?.();
            }
          } catch (e) {}
        }
      }
    }
  } else if (provider === 'deepseek') {
    // ZHI 3: DeepSeek streaming
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        stream: true,
        max_tokens: 4000,
      }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              res.write(content);
              (res as any).flush?.();
            }
          } catch (e) {}
        }
      }
    }
  } else if (provider === 'grok') {
    // ZHI 4: Grok streaming
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-3',
        messages: [{ role: 'user', content: prompt }],
        stream: true,
        max_tokens: 4000,
        temperature: 0.7,
      }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              res.write(content);
              (res as any).flush?.();
            }
          } catch (e) {}
        }
      }
    }
  } else if (provider === 'perplexity') {
    // Perplexity streaming
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [{ role: 'user', content: prompt }],
        stream: true,
        max_tokens: 4000,
      }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              res.write(content);
              (res as any).flush?.();
            }
          } catch (e) {}
        }
      }
    }
  }
  res.end();
}

export async function registerRoutes(app: Express): Promise<Express> {
  
  // Register payment routes
  registerPaymentRoutes(app);
  
  // API health check endpoint
  app.get("/api/check-api", async (_req: Request, res: Response) => {
    const openai_key = process.env.OPENAI_API_KEY;
    const anthropic_key = process.env.ANTHROPIC_API_KEY;
    const deepseek_key = process.env.DEEPSEEK_API_KEY;
    const perplexity_key = process.env.PERPLEXITY_API_KEY;
    const grok_key = process.env.GROK_API_KEY;
    const mathpix_app_id = process.env.MATHPIX_APP_ID;
    const mathpix_app_key = process.env.MATHPIX_APP_KEY;
    
    // Check API keys
    res.json({
      status: "operational",
      api_keys: {
        openai: openai_key ? "configured" : "missing",
        anthropic: anthropic_key ? "configured" : "missing",
        deepseek: deepseek_key ? "configured" : "missing",
        perplexity: perplexity_key ? "configured" : "missing",
        grok: grok_key ? "configured" : "missing",
        mathpix: (mathpix_app_id && mathpix_app_key) ? "configured" : "missing"
      }
    });
    
    // Log API status for monitoring
    console.log("API Status Check:", { 
      openai: openai_key ? "✓" : "✗", 
      anthropic: anthropic_key ? "✓" : "✗", 
      deepseek: deepseek_key ? "✓" : "✗",
      perplexity: perplexity_key ? "✓" : "✗",
      grok: grok_key ? "✓" : "✗",
      mathpix: (mathpix_app_id && mathpix_app_key) ? "✓" : "✗"
    });
  });

  // ============ DIAGNOSTIC / SELF-CHECK ENDPOINT ============
  app.post("/api/diagnostic/run", async (_req: Request, res: Response) => {
    const checks: { category: string; name: string; status: "pass" | "fail" | "warn"; detail: string; ms?: number }[] = [];
    const t0 = Date.now();

    const runCheck = async (category: string, name: string, fn: () => Promise<string>) => {
      const start = Date.now();
      try {
        const detail = await fn();
        checks.push({ category, name, status: "pass", detail, ms: Date.now() - start });
      } catch (e: any) {
        const status: "warn" | "fail" = e?.warn ? "warn" : "fail";
        checks.push({ category, name, status, detail: e?.message || "Failed", ms: Date.now() - start });
      }
    };

    // ---- Environment / API keys ----
    const envKeys: [string, string][] = [
      ["OPENAI_API_KEY", "ZHI 1 (OpenAI)"],
      ["ANTHROPIC_API_KEY", "ZHI 2 (Anthropic)"],
      ["DEEPSEEK_API_KEY", "ZHI 3 (DeepSeek)"],
      ["PERPLEXITY_API_KEY", "ZHI 4 (Perplexity)"],
      ["GROK_API_KEY", "ZHI 5 (Grok)"],
      ["DATABASE_URL", "Database URL"],
    ];
    for (const [key, label] of envKeys) {
      checks.push({
        category: "Environment",
        name: label,
        status: process.env[key] ? "pass" : "fail",
        detail: process.env[key] ? "Configured" : "Missing",
      });
    }
    const optionalKeys: [string, string][] = [
      ["MATHPIX_APP_ID", "Mathpix OCR (optional)"],
      ["SENDGRID_API_KEY", "SendGrid email (optional)"],
      ["STRIPE_SECRET_KEY", "Stripe payments (optional)"],
    ];
    for (const [key, label] of optionalKeys) {
      checks.push({
        category: "Environment",
        name: label,
        status: process.env[key] ? "pass" : "warn",
        detail: process.env[key] ? "Configured" : "Not configured (feature disabled)",
      });
    }

    // ---- Database ----
    await runCheck("Database", "PostgreSQL connectivity", async () => {
      const u = await storage.getUser(1);
      return u ? `Connected (sample user found: ${u.username})` : "Connected (no user with id=1, but query ran)";
    });

    // ---- AI providers (tiny ping) ----
    const aiPing = async (url: string, headers: Record<string, string>, body: any) => {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 15000);
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        if (r.status === 429) {
          const err: any = new Error("Rate limited (429) — key valid, provider throttling. Fallback chain will handle.");
          err.warn = true;
          throw err;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return "Responded OK";
      } finally {
        clearTimeout(to);
      }
    };

    if (process.env.OPENAI_API_KEY) {
      await runCheck("AI Providers", "ZHI 1 reachable", () =>
        aiPing("https://api.openai.com/v1/chat/completions",
          { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
          { model: "gpt-4o-mini", messages: [{ role: "user", content: "ping" }], max_tokens: 5 }));
    }
    if (process.env.ANTHROPIC_API_KEY) {
      await runCheck("AI Providers", "ZHI 2 reachable", () =>
        aiPing("https://api.anthropic.com/v1/messages",
          { "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
          { model: "claude-sonnet-4-5", max_tokens: 5, messages: [{ role: "user", content: "ping" }] }));
    }
    if (process.env.DEEPSEEK_API_KEY) {
      await runCheck("AI Providers", "ZHI 3 reachable", () =>
        aiPing("https://api.deepseek.com/v1/chat/completions",
          { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
          { model: "deepseek-chat", messages: [{ role: "user", content: "ping" }], max_tokens: 5 }));
    }
    if (process.env.PERPLEXITY_API_KEY) {
      await runCheck("AI Providers", "ZHI 4 reachable", () =>
        aiPing("https://api.perplexity.ai/chat/completions",
          { Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}` },
          { model: "sonar", messages: [{ role: "user", content: "ping" }], max_tokens: 5 }));
    }
    if (process.env.GROK_API_KEY) {
      await runCheck("AI Providers", "ZHI 5 reachable", () =>
        aiPing("https://api.x.ai/v1/chat/completions",
          { Authorization: `Bearer ${process.env.GROK_API_KEY}` },
          { model: "grok-3", messages: [{ role: "user", content: "ping" }], max_tokens: 5 }));
    }

    // ---- Internal pipeline endpoints (formal checks) ----
    const internalPost = async (path: string, body: any, timeoutMs = 60000) => {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const r = await fetch(`http://localhost:5000${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        const data: any = await r.json().catch(() => ({}));
        if (!r.ok || data?.success === false) {
          throw new Error(data?.message || `HTTP ${r.status}`);
        }
        return data;
      } finally {
        clearTimeout(to);
      }
    };

    const tinyText = "All swans observed so far have been white. Therefore all swans are white.";

    await runCheck("Pipeline", "Batch endpoint (1 mode)", async () => {
      const d = await internalPost("/api/text-model-validator/batch", {
        text: tinyText, modes: ["reconstruction"], llmProvider: "zhi2",
      });
      const ok = Array.isArray(d.results) && d.results.length === 1;
      if (!ok) throw new Error("Malformed batch response");
      return `Returned ${d.successfulModes}/${d.totalModes} successful`;
    });

    await runCheck("Pipeline", "BOTTOMLINE endpoint", async () => {
      const d = await internalPost("/api/text-model-validator/bottomline", {
        originalText: tinyText,
        audience: "Educated audience looking for actionable business ideas",
        objective: "Diagnostic check",
        length: "short",
        llmProvider: "zhi2",
      });
      if (!d.output && !d.bottomlineOutput) throw new Error("No output returned");
      return "Synthesis returned output";
    });

    await runCheck("Pipeline", "Objections endpoint", async () => {
      const d = await internalPost("/api/text-model-validator/objections", {
        bottomlineOutput: "All swans are white because every observed swan is white.",
        audience: "Educated audience looking for actionable business ideas",
        objective: "Diagnostic check",
        llmProvider: "zhi2",
      }, 180000);
      if (!d.output && !d.objectionsOutput) throw new Error("No output returned");
      return "Objections generated";
    });

    const totalMs = Date.now() - t0;
    const summary = {
      total: checks.length,
      passed: checks.filter(c => c.status === "pass").length,
      failed: checks.filter(c => c.status === "fail").length,
      warned: checks.filter(c => c.status === "warn").length,
      durationMs: totalMs,
    };
    res.json({ success: true, summary, checks });
  });

  // Quick analysis API endpoint with evaluation type support
  app.post("/api/quick-analysis", async (req: Request, res: Response) => {
    try {
      const { text, provider = 'zhi1', evaluationType = 'intelligence' } = req.body;

      if (!text || typeof text !== 'string') {
        return res.status(400).json({ 
          error: "Text is required and must be a string" 
        });
      }

      // Validate evaluation type
      const validTypes = ['intelligence', 'originality', 'cogency', 'overall_quality'];
      if (!validTypes.includes(evaluationType)) {
        return res.status(400).json({
          error: `Invalid evaluation type. Must be one of: ${validTypes.join(', ')}`
        });
      }

      console.log(`Starting quick ${evaluationType} analysis with ${provider}...`);
      
      const { performQuickAnalysis } = await import('./services/quickAnalysis');
      const result = await performQuickAnalysis(text, provider, evaluationType);
      
      res.json({ success: true, result });
      
    } catch (error: any) {
      console.error("Quick analysis error:", error);
      res.status(500).json({ 
        error: true, 
        message: error.message || "Quick analysis failed" 
      });
    }
  });

  // Quick comparison API endpoint with evaluation type support
  app.post("/api/quick-compare", async (req: Request, res: Response) => {
    try {
      const { documentA, documentB, provider = 'zhi1', evaluationType = 'intelligence' } = req.body;

      if (!documentA || !documentB) {
        return res.status(400).json({ 
          error: "Both documents are required" 
        });
      }

      // Validate evaluation type
      const validTypes = ['intelligence', 'originality', 'cogency', 'overall_quality'];
      if (!validTypes.includes(evaluationType)) {
        return res.status(400).json({
          error: `Invalid evaluation type. Must be one of: ${validTypes.join(', ')}`
        });
      }

      console.log(`Starting quick ${evaluationType} comparison with ${provider}...`);
      
      const { performQuickComparison } = await import('./services/quickAnalysis');
      const result = await performQuickComparison(documentA, documentB, provider, evaluationType);
      
      res.json(result);
      
    } catch (error: any) {
      console.error("Quick comparison error:", error);
      res.status(500).json({ 
        error: true, 
        message: error.message || "Quick comparison failed" 
      });
    }
  });

  // INTELLIGENT REWRITE - Maximize intelligence scores on protocol questions
  app.post("/api/intelligent-rewrite", async (req: Request, res: Response) => {
    try {
      const { originalText, customInstructions, provider = 'zhi1', useExternalKnowledge = false } = req.body;

      if (!originalText || typeof originalText !== 'string') {
        return res.status(400).json({ 
          error: "Original text is required and must be a string" 
        });
      }

      console.log(`Starting intelligent rewrite with ${provider}...`);
      console.log(`Original text length: ${originalText.length} characters`);
      console.log(`Custom instructions: ${customInstructions || 'None'}`);
      console.log(`External knowledge: ${useExternalKnowledge ? 'ENABLED' : 'DISABLED'}`);
      
      const { performIntelligentRewrite } = await import('./services/intelligentRewrite');
      const result = await performIntelligentRewrite({
        text: originalText,
        customInstructions,
        provider,
        useExternalKnowledge
      });
      
      res.json({
        success: true,
        result: result
      });
      
    } catch (error: any) {
      console.error("Intelligent rewrite error:", error);
      res.status(500).json({ 
        error: true, 
        message: error.message || "Intelligent rewrite failed" 
      });
    }
  });

  // COMPREHENSIVE 4-PHASE EVALUATION using exact protocol with evaluation type support
  app.post("/api/cognitive-evaluate", async (req: Request, res: Response) => {
    try {
      const { content, provider = 'zhi1', evaluationType = 'intelligence' } = req.body;

      if (!content || typeof content !== 'string') {
        return res.status(400).json({ 
          error: "Content is required and must be a string" 
        });
      }

      // Validate evaluation type
      const validTypes = ['intelligence', 'originality', 'cogency', 'overall_quality'];
      if (!validTypes.includes(evaluationType)) {
        return res.status(400).json({
          error: `Invalid evaluation type. Must be one of: ${validTypes.join(', ')}`
        });
      }

      // Import the exact 4-phase protocol
      const { executeFourPhaseProtocol } = await import('./services/fourPhaseProtocol');

      console.log(`EXACT 4-PHASE ${evaluationType.toUpperCase()} EVALUATION: Analyzing ${content.length} characters with protocol`);
      
      const evaluation = await executeFourPhaseProtocol(
        content, 
        provider as 'openai' | 'anthropic' | 'perplexity' | 'deepseek',
        evaluationType as 'intelligence' | 'originality' | 'cogency' | 'overall_quality'
      );

      res.json({
        success: true,
        evaluation: {
          formattedReport: evaluation.formattedReport,
          overallScore: evaluation.overallScore,
          provider: evaluation.provider,
          metadata: {
            contentLength: content.length,
            evaluationType: evaluationType,
            timestamp: new Date().toISOString()
          }
        }
      });

    } catch (error: any) {
      console.error(`Error in ${req.body.evaluationType || 'cognitive'} evaluation:`, error);
      res.status(500).json({
        success: false,
        error: `${req.body.evaluationType || 'cognitive'} evaluation failed`,
        details: error.message
      });
    }
  });
  
  // Extract text from uploaded document
  app.post("/api/extract-text", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file && !req.body.content) {
        return res.status(400).json({ error: "No file or content provided" });
      }
      
      // Direct content input
      if (req.body.content) {
        return res.json({
          content: req.body.content,
          filename: req.body.filename || "direct-input.txt",
          mimeType: "text/plain",
          metadata: {}
        });
      }
      
      // Process uploaded file
      const result = await extractTextFromFile(req.file!);
      return res.json(result);
    } catch (error: any) {
      console.error("Error extracting text:", error);
      return res.status(500).json({ 
        error: true, 
        message: error.message || "Failed to extract text from document"
      });
    }
  });
  
  // Check if text is AI-generated
  app.post("/api/check-ai", async (req: Request, res: Response) => {
    try {
      const document: DocumentInput = req.body;
      
      if (!document || !document.content) {
        return res.status(400).json({ error: "Document content is required" });
      }

      // Import the AI detection method
      const { checkForAI } = await import('./api/gptZero');
      
      // Check for AI using the selected service
      console.log("DETECTING AI CONTENT");
      const result = await checkForAI(document);
      return res.json(result);
    } catch (error: any) {
      console.error("Error checking for AI:", error);
      return res.status(500).json({ 
        error: true, 
        message: error.message || "Failed to check for AI"
      });
    }
  });

  // Stream comprehensive analysis - shows results as they're generated
  app.post("/api/stream-comprehensive", async (req: Request, res: Response) => {
    try {
      const { text, provider = "zhi1" } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: "Text content is required" });
      }
      
      // Set headers for streaming
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('X-Accel-Buffering', 'no');
      
      console.log(`Starting streaming comprehensive analysis with ${provider} for text of length: ${text.length}`);
      
      const actualProvider = mapZhiToProvider(provider);
      
      // Stream each phase as it completes
      res.write(`🔍 Starting comprehensive analysis with ${provider}...\n\n`);
      
      const { executeComprehensiveProtocol } = await import('./services/fourPhaseProtocol');
      
      // Create a streaming version that shows each phase
      try {
        res.write(`📊 PHASE 1: Answering 28 Questions\n`);
        res.write(`Analyzing ${text.length} characters with the complete 4-phase protocol...\n\n`);
        
        // Import and run a modified version that can stream updates
        const { executeStreamingComprehensiveProtocol } = await import('./services/streamingProtocol');
        
        await executeStreamingComprehensiveProtocol(
          text,
          actualProvider as 'openai' | 'anthropic' | 'deepseek',
          res
        );
        
      } catch (error: any) {
        res.write(`❌ ERROR: ${error.message}\n`);
      }
      
      res.end();
      
    } catch (error: any) {
      console.error("Error in comprehensive streaming:", error);
      res.write(`ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
      res.end();
    }
  });
  
  // Analyze document
  app.post("/api/analyze", async (req: Request, res: Response) => {
    try {
      const { content, provider = "all", requireProgress = false } = req.body;
      
      if (!content) {
        return res.status(400).json({ 
          error: true, 
          message: "Document content is required",
          formattedReport: "Error: Document content is required",
          provider: provider
        });
      }
      
      // If the user requests a specific single provider
      if (provider.toLowerCase() !== 'all') {
        // Import the 4-PHASE analysis methods using your exact protocol
        const { executeFourPhaseProtocol } = await import('./services/fourPhaseProtocol');
        
        // Perform analysis with your exact 4-phase protocol
        console.log(`${provider.toUpperCase()} ANALYSIS WITH YOUR EXACT 4-PHASE INTELLIGENCE PROTOCOL`);
        
        let pureResult;
        
        try {
          // Use the unified executeFourPhaseProtocol function for intelligence evaluation
          const actualProvider = mapZhiToProvider(provider.toLowerCase());
          pureResult = await executeFourPhaseProtocol(
            content,
            actualProvider as 'openai' | 'anthropic' | 'deepseek',
            'intelligence'
          );
          
          // Use PURE result - NO FILTERING - pass through complete unfiltered evaluation
          const result = {
            id: 0,
            documentId: 0,
            provider: pureResult.provider || provider,
            formattedReport: pureResult.formattedReport || "Analysis not available",
            overallScore: pureResult.overallScore || 60,
            surface: {
              grammar: pureResult.overallScore || 60,
              structure: pureResult.overallScore || 60,
              jargonUsage: pureResult.overallScore || 60,
              surfaceFluency: pureResult.overallScore || 60
            },
            deep: {
              conceptualDepth: pureResult.overallScore || 60,
              inferentialContinuity: pureResult.overallScore || 60,
              semanticCompression: pureResult.overallScore || 60,
              logicalLaddering: pureResult.overallScore || 60,
              originality: pureResult.overallScore || 60
            },
            analysis: pureResult.formattedReport || "Analysis not available"
          };
          
          return res.json(result);
        } catch (error: any) {
          console.error(`Error in direct passthrough to ${provider}:`, error);
          return res.status(200).json({
            id: 0,
            documentId: 0, 
            provider: `${provider} (Error)`,
            formattedReport: `Error analyzing document with pure ${provider} protocol: ${error.message || "Unknown error"}`
          });
        }
      } else {
        // For 'all' provider option, analyze with all providers and verify results
        try {
          // Import the analysis verifier
          const { analyzeWithAllProviders } = await import('./services/analysisVerifier');
          
          console.log("ANALYZING WITH ALL PROVIDERS AND VERIFICATION");
          const allResults = await analyzeWithAllProviders(content);
          
          // Format the response with results from all providers
          const result = {
            id: 0,
            documentId: 0,
            provider: "All Providers",
            formattedReport: "Analysis complete with all providers. See detailed results below.",
            analysisResults: allResults
          };
          
          return res.json(result);
        } catch (error: any) {
          console.error("Error analyzing with all providers:", error);
          return res.status(200).json({
            id: 0,
            documentId: 0,
            provider: "All Providers (Error)",
            formattedReport: `Error analyzing document with all providers: ${error.message || "Unknown error"}`
          });
        }
      }
    } catch (error: any) {
      console.error("Error analyzing document:", error);
      return res.status(500).json({ 
        error: true, 
        message: `Error analyzing document: ${error.message}`
      });
    }
  });
  
  // Compare two documents (case assessment style)
  app.post("/api/compare", async (req: Request, res: Response) => {
    try {
      // Set a longer timeout for this endpoint (5 minutes)
      req.setTimeout(300000);
      
      const { documentA, documentB, provider = "openai" } = req.body;
      
      if (!documentA || !documentB) {
        return res.status(400).json({ error: "Both documents are required for comparison" });
      }
      
      // Import the document comparison service
      const { compareDocuments } = await import('./services/documentComparison');
      
      // Compare documents using the selected provider
      console.log(`COMPARING DOCUMENTS WITH ${provider.toUpperCase()}`);
      const result = await compareDocuments(documentA, documentB, provider);
      return res.json(result);
    } catch (error: any) {
      console.error("Error comparing documents:", error);
      return res.status(500).json({ 
        error: true, 
        message: error.message || "Failed to compare documents" 
      });
    }
  });

  // PURE intelligence comparison for two documents using exact 3-phase protocol
  app.post("/api/intelligence-compare", async (req: Request, res: Response) => {
    try {
      const { documentA, documentB, provider = "deepseek" } = req.body;
      
      if (!documentA || !documentB) {
        return res.status(400).json({ error: "Both documents are required for intelligence comparison" });
      }
      
      // Import the PURE comparison service - NO GARBAGE DIMENSIONS
      const { performPureIntelligenceComparison } = await import('./services/pureComparison');
      
      // Compare intelligence using PURE 3-phase protocol - DEEPSEEK DEFAULT
      console.log(`PURE INTELLIGENCE COMPARISON WITH EXACT 3-PHASE PROTOCOL USING ${provider.toUpperCase()}`);
      const result = await performPureIntelligenceComparison(documentA.content || documentA, documentB.content || documentB, provider);
      return res.json(result);
    } catch (error: any) {
      console.error("Error in pure intelligence comparison:", error);
      return res.status(500).json({ 
        error: true, 
        message: error.message || "Failed to perform pure intelligence comparison" 
      });
    }
  });
  
  // Share analysis via email
  app.post("/api/share-via-email", async (req: Request, res: Response) => {
    try {
      const { 
        recipientEmail, 
        senderEmail, 
        senderName,
        subject, 
        documentType, 
        analysisA,
        analysisB, 
        comparison,
        rewrittenAnalysis
      } = req.body;
      
      if (!recipientEmail || !subject || !analysisA) {
        return res.status(400).json({ error: "Recipient email, subject, and analysis are required" });
      }
      
      // Import the email service
      const { sendAnalysisEmail } = await import('./services/emailService');
      
      // Send email with the analysis
      console.log(`SENDING EMAIL TO ${recipientEmail}`);
      const result = await sendAnalysisEmail({
        recipientEmail,
        senderEmail,
        senderName,
        subject,
        documentType,
        analysisA,
        analysisB,
        comparison,
        rewrittenAnalysis
      });
      
      return res.json(result);
    } catch (error: any) {
      console.error("Error sending email:", error);
      return res.status(500).json({ 
        success: false, 
        message: error.message || "Failed to send email" 
      });
    }
  });
  
  // Get enhancement suggestions
  app.post("/api/get-enhancement-suggestions", async (req: Request, res: Response) => {
    try {
      const { text, provider = "openai" } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }
      
      // Import the enhancement suggestions service
      const { getEnhancementSuggestions } = await import('./api/enhancementSuggestions');
      
      // Get suggestions using the selected provider
      console.log(`GETTING ENHANCEMENT SUGGESTIONS FROM ${provider.toUpperCase()}`);
      const suggestions = await getEnhancementSuggestions(text, provider);
      return res.json(suggestions);
    } catch (error: any) {
      console.error("Error getting enhancement suggestions:", error);
      return res.status(500).json({ 
        error: true, 
        message: error.message || "Failed to get enhancement suggestions" 
      });
    }
  });
  
  // Google search
  app.post("/api/search-google", async (req: Request, res: Response) => {
    try {
      const { query, numResults = 5 } = req.body;
      
      if (!query) {
        return res.status(400).json({ error: "Search query is required" });
      }
      
      // Import the Google search service
      const { searchGoogle } = await import('./api/googleSearch');
      
      // Search using Google Custom Search API
      console.log(`SEARCHING GOOGLE FOR: ${query}`);
      const results = await searchGoogle(query, numResults);
      return res.json(results);
    } catch (error: any) {
      console.error("Error searching Google:", error);
      return res.status(500).json({ 
        error: true, 
        message: error.message || "Failed to search Google" 
      });
    }
  });
  
  // Fetch content from URL
  app.post("/api/fetch-url-content", async (req: Request, res: Response) => {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }
      
      // Import the URL content fetcher
      const { fetchUrlContent } = await import('./api/googleSearch');
      
      // Fetch content from the URL
      console.log(`FETCHING CONTENT FROM: ${url}`);
      const content = await fetchUrlContent(url);
      
      if (!content) {
        return res.json({ 
          url, 
          success: false, 
          content: "Could not extract content from this URL" 
        });
      }
      
      return res.json({ url, success: true, content });
    } catch (error: any) {
      console.error("Error fetching URL content:", error);
      return res.status(500).json({ 
        url: req.body.url,
        success: false, 
        message: error.message || "Failed to fetch URL content" 
      });
    }
  });
  

  
  // Translate document
  app.post("/api/translate", async (req: Request, res: Response) => {
    try {
      const { text, options, provider = "openai" } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }
      
      if (!options || !options.targetLanguage) {
        return res.status(400).json({ error: "Target language is required" });
      }
      
      // Import the translation service
      const { translateDocument } = await import('./services/translationService');
      
      // Translate the document
      console.log(`TRANSLATING TO ${options.targetLanguage.toUpperCase()} WITH ${provider.toUpperCase()}`);
      const result = await translateDocument(text, options, provider);
      return res.json(result);
    } catch (error: any) {
      console.error("Error translating document:", error);
      return res.status(500).json({ 
        error: true, 
        message: error.message || "Failed to translate document" 
      });
    }
  });
  

  // Send simple email
  app.post("/api/share-simple-email", async (req: Request, res: Response) => {
    try {
      const { recipientEmail, senderEmail, senderName, subject, content } = req.body;
      
      if (!recipientEmail || !subject || !content) {
        return res.status(400).json({ error: "Recipient email, subject, and content are required" });
      }
      
      // Send the email
      console.log(`SENDING SIMPLE EMAIL TO ${recipientEmail}`);
      const result = await sendSimpleEmail({
        recipientEmail,
        senderEmail,
        senderName,
        subject,
        content
      });
      
      return res.json(result);
    } catch (error: any) {
      console.error("Error sending simple email:", error);
      return res.status(500).json({ 
        success: false, 
        message: error.message || "Failed to send email" 
      });
    }
  });
  
  // Direct model request
  // Speech-to-text conversion endpoint
  app.post("/api/speech-to-text", speechUpload.single("audio"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }
      
      console.log("PROCESSING SPEECH TO TEXT");
      const text = await processSpeechToText(req);
      
      return res.json({
        success: true,
        text: text
      });
    } catch (error: any) {
      console.error("Error processing speech to text:", error);
      return res.status(500).json({ 
        success: false, 
        message: error.message || "Failed to process speech to text" 
      });
    }
  });

  app.post("/api/direct-model-request", async (req: Request, res: Response) => {
    try {
      const { instruction, provider = "openai" } = req.body;
      
      if (!instruction) {
        return res.status(400).json({ error: "Instruction is required" });
      }
      
      // Import the direct model request service
      const { 
        directOpenAIRequest, 
        directClaudeRequest, 
        directPerplexityRequest,
        directDeepSeekRequest,
        directMultiModelRequest
      } = await import('./api/directModelRequest');
      
      let result;
      
      // Make the request to the specified provider
      if (provider === "all") {
        console.log(`DIRECT MULTI-MODEL REQUEST`);
        result = await directMultiModelRequest(instruction);
      } else {
        console.log(`DIRECT ${provider.toUpperCase()} MODEL REQUEST`);
        
        switch (provider.toLowerCase()) {
          case 'anthropic':
            result = await directClaudeRequest(instruction);
            break;
          case 'perplexity':
            result = await directPerplexityRequest(instruction);
            break;
          case 'deepseek':
            result = await directDeepSeekRequest(instruction);
            break;
          case 'openai':
          default:
            result = await directOpenAIRequest(instruction);
            break;
        }
      }
      
      return res.json(result);
    } catch (error: any) {
      console.error("Error making direct model request:", error);
      return res.status(500).json({ 
        error: true, 
        message: error.message || "Failed to make direct model request" 
      });
    }
  });

  app.post("/api/chat-with-memory", async (req: Request, res: Response) => {
    try {
      const { 
        message, 
        conversationHistory = [], 
        currentDocument, 
        analysisResults, 
        provider = "zhi1",
        useExternalKnowledge = false 
      } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      console.log(`Chat with memory - ${provider}, history: ${conversationHistory.length} messages, external knowledge: ${useExternalKnowledge}`);

      // Query Zhi database if enabled
      let externalKnowledge = null;
      let zhiDataType = 'none';
      if (useExternalKnowledge) {
        const { queryZhiKnowledgeBase } = await import('./services/zhiApi');
        const zhiResult = await queryZhiKnowledgeBase(message, 5);
        if (zhiResult) {
          externalKnowledge = zhiResult.content;
          zhiDataType = zhiResult.type; // 'quotes' or 'excerpts'
        }
      }

      // Build system message with context
      let systemMessage = "You are an intelligent AI assistant with expertise in philosophy, cognitive science, and academic writing. Provide thoughtful, accurate, and well-sourced responses.";
      
      if (externalKnowledge) {
        if (zhiDataType === 'quotes') {
          systemMessage += `\n\nEXTERNAL KNOWLEDGE - VERBATIM QUOTES FROM ZHI DATABASE:
The following are ACTUAL VERBATIM QUOTES from John-Michael Kuczynski's published works.
You may present these as direct quotations with proper attribution.
Use them to provide specific, cited evidence when responding to the user's question.

QUOTES:
${externalKnowledge}`;
        } else {
          systemMessage += `\n\nEXTERNAL KNOWLEDGE - SUMMARIES FROM ZHI DATABASE:
The following are AI-GENERATED EXCERPTS/SUMMARIES from John-Michael Kuczynski's works, NOT verbatim quotes.
DO NOT put these in quotation marks or present them as direct quotes.
Instead, use them as context to inform your response, stating "According to Kuczynski's work on [topic]..." or similar phrasing.
If the user asks for quotes, explain that only summaries are currently available from the database.

EXCERPTS:
${externalKnowledge}`;
        }
      }
      
      if (currentDocument) {
        systemMessage += `\n\nCURRENT DOCUMENT CONTEXT:\n${currentDocument}`;
      }
      
      if (analysisResults) {
        systemMessage += `\n\nANALYSIS RESULTS CONTEXT:\n${JSON.stringify(analysisResults, null, 2)}`;
      }

      // Map provider to actual LLM
      const providerMap: Record<string, string> = {
        'zhi1': 'openai',
        'zhi2': 'anthropic',
        'zhi3': 'deepseek',
        'zhi4': 'grok'
      };
      const actualProvider = providerMap[provider] || provider;

      // Build messages array with conversation history
      const messages = conversationHistory.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      }));
      
      // Add current message
      messages.push({
        role: 'user',
        content: message
      });

      // Make LLM request with conversation history
      let content;
      
      if (actualProvider === 'openai') {
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: systemMessage },
              ...messages
            ],
            temperature: 0.7,
            max_tokens: 4000
          }),
        });

        const openaiData = await openaiResponse.json();
        content = openaiData.choices?.[0]?.message?.content || "No response";
        
      } else if (actualProvider === 'anthropic') {
        const anthropic = (await import('@anthropic-ai/sdk')).default;
        const client = new anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        
        const claudeResponse = await client.messages.create({
          model: 'claude-sonnet-4-5',
          max_tokens: 4000,
          system: systemMessage,
          messages: messages
        });
        
        content = claudeResponse.content[0].type === 'text' ? claudeResponse.content[0].text : "No response";
        
      } else if (actualProvider === 'deepseek') {
        const deepseekResponse = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: systemMessage },
              ...messages
            ],
            temperature: 0.7
          }),
        });

        const deepseekData = await deepseekResponse.json();
        content = deepseekData.choices?.[0]?.message?.content || "No response";
        
      } else if (actualProvider === 'grok') {
        const grokResponse = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'grok-3',
            messages: [
              { role: 'system', content: systemMessage },
              ...messages
            ],
            temperature: 0.7
          }),
        });

        const grokData = await grokResponse.json();
        content = grokData.choices?.[0]?.message?.content || "No response";
      }

      return res.json({ content });
      
    } catch (error: any) {
      console.error("Error in chat with memory:", error);
      return res.status(500).json({ 
        error: true, 
        message: error.message || "Failed to process chat message" 
      });
    }
  });
  
  app.post("/api/semantic-analysis", async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: "Text content is required" });
      }
      
      console.log(`Starting semantic analysis for text of length: ${text.length}`);
      
      const { analyzeSemanticDensity } = await import('./services/semanticAnalysis');
      const result = await analyzeSemanticDensity(text);
      
      console.log(`Semantic analysis complete: ${result.sentences.length} sentences, ${result.paragraphs.length} paragraphs`);
      
      return res.json(result);
    } catch (error: any) {
      console.error("Error in semantic analysis:", error);
      return res.status(500).json({ 
        error: "Failed to analyze semantic density",
        message: error.message 
      });
    }
  });

  // Case assessment endpoint - REAL-TIME STREAMING
  app.post("/api/case-assessment", async (req: Request, res: Response) => {
    try {
      const { text, provider = "zhi1", context } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: "Text content is required for case assessment" });
      }
      
      // Set headers for real-time streaming
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('X-Accel-Buffering', 'no');
      
      console.log(`Starting REAL-TIME case assessment streaming with ${provider} for text of length: ${text.length}`);
      
      const actualProvider = mapZhiToProvider(provider);
      await streamCaseAssessment(text, actualProvider, res, context);
      
    } catch (error: any) {
      console.error("Error in case assessment streaming:", error);
      res.write(`ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
      res.end();
    }
  });

  // Fiction Assessment API endpoint - RETURNS JSON RESULTS
  app.post('/api/fiction-assessment', async (req, res) => {
    try {
      const { text, provider = 'openai' } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }
      
      console.log(`Starting fiction assessment with ${provider} for text of length: ${text.length}`);
      
      // Call the fiction assessment service directly and return JSON
      const { performFictionAssessment } = await import('./services/fictionAssessment');
      const result = await performFictionAssessment(text, provider);
      
      console.log('Fiction Assessment Result:', result);
      res.json({
        success: true,
        result: result
      });
      
    } catch (error: any) {
      console.error("Error in fiction assessment streaming:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Comprehensive cognitive analysis endpoint (4-phase protocol)
  app.post("/api/analyze", async (req: Request, res: Response) => {
    try {
      console.log("COMPREHENSIVE ANALYSIS DEBUG - req.body:", JSON.stringify(req.body, null, 2));
      console.log("COMPREHENSIVE ANALYSIS DEBUG - text type:", typeof req.body.text);
      console.log("COMPREHENSIVE ANALYSIS DEBUG - text value:", req.body.text?.substring(0, 100));
      
      const { text, provider = "zhi1" } = req.body;
      
      if (!text || typeof text !== 'string') {
        console.log("COMPREHENSIVE ANALYSIS ERROR - text validation failed:", { text: typeof text, hasText: !!text });
        return res.status(400).json({ error: "Document content is required" });
      }
      
      console.log(`Starting comprehensive cognitive analysis with ${provider} for text of length: ${text.length}`);
      
      const { executeComprehensiveProtocol } = await import('./services/fourPhaseProtocol');
      const actualProvider = mapZhiToProvider(provider);
      const result = await executeComprehensiveProtocol(text, actualProvider as 'openai' | 'anthropic' | 'perplexity' | 'deepseek');
      
      console.log(`COMPREHENSIVE ANALYSIS RESULT PREVIEW: "${(result.analysis || '').substring(0, 200)}..."`);
      console.log(`COMPREHENSIVE ANALYSIS RESULT LENGTH: ${(result.analysis || '').length} characters`);
      
      res.json({
        success: true,
        analysis: {
          id: Date.now(),
          content: result.analysis,
          overallScore: result.overallScore,
          provider: result.provider,
          evaluationType: result.evaluationType,
          phases: result.phases,
          formattedReport: result.formattedReport
        }
      });
    } catch (error: any) {
      console.error("Error in comprehensive cognitive analysis:", error);
      res.status(500).json({ 
        error: true, 
        message: error.message || "Comprehensive analysis failed" 
      });
    }
  });

  // MISSING ENDPOINT: Quick Cognitive Analysis  
  app.post("/api/cognitive-quick", async (req: Request, res: Response) => {
    try {
      const { text, provider = "zhi1" } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: "Text content is required for analysis" });
      }
      
      console.log(`Starting quick cognitive analysis with ${provider} for text of length: ${text.length}`);
      
      const { performQuickAnalysis } = await import('./services/quickAnalysis');
      const actualProvider = mapZhiToProvider(provider);
      const result = await performQuickAnalysis(text, actualProvider as 'openai' | 'anthropic' | 'perplexity' | 'deepseek');
      
      console.log(`ANALYSIS RESULT PREVIEW: "${(result.analysis || '').substring(0, 200)}..."`);
      console.log(`ANALYSIS RESULT LENGTH: ${(result.analysis || '').length} characters`);
      
      res.json({
        success: true,
        analysis: {
          id: Date.now(),
          formattedReport: result.analysis,
          overallScore: result.intelligence_score,
          provider: provider,
          summary: result.analysis,
          analysis: result.analysis,
          cognitiveProfile: result.cognitive_profile,
          keyInsights: result.key_insights
        },
        provider: provider,
        metadata: {
          contentLength: text.length,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error: any) {
      console.error("Error in quick cognitive analysis:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });


  // Fiction Comparison API endpoint  
  app.post('/api/fiction-compare', async (req, res) => {
    try {
      const { documentA, documentB, provider } = req.body;
      
      if (!documentA || !documentB || !provider) {
        return res.status(400).json({ error: "Both documents and provider are required" });
      }
      
      const { performFictionComparison } = await import('./services/fictionComparison');
      const result = await performFictionComparison(documentA, documentB, provider);
      
      console.log(`Fiction comparison complete - Winner: Document ${result.winnerDocument}`);
      
      return res.json(result);
    } catch (error: any) {
      console.error("Error in fiction comparison:", error);
      return res.status(500).json({ 
        error: "Failed to perform fiction comparison",
        message: error.message 
      });
    }
  });

  // ORIGINALITY EVALUATION API endpoint
  app.post("/api/originality-evaluate", async (req: Request, res: Response) => {
    try {
      const { content, provider = 'zhi1', phase = 'comprehensive' } = req.body;

      if (!content || typeof content !== 'string') {
        return res.status(400).json({ 
          error: "Content is required and must be a string" 
        });
      }

      console.log(`${phase.toUpperCase()} ORIGINALITY EVALUATION WITH ${provider.toUpperCase()}`);
      
      if (phase === 'quick') {
        const { performQuickAnalysis } = await import('./services/quickAnalysis');
        const result = await performQuickAnalysis(content, provider, 'originality');
        res.json({ success: true, result });
      } else {
        const { executeFourPhaseProtocol } = await import('./services/fourPhaseProtocol');
        const evaluation = await executeFourPhaseProtocol(
          content, 
          provider as 'openai' | 'anthropic' | 'perplexity' | 'deepseek',
          'originality'
        );
        res.json({
          success: true,
          evaluation: {
            formattedReport: evaluation.formattedReport,
            overallScore: evaluation.overallScore,
            provider: evaluation.provider,
            metadata: {
              contentLength: content.length,
              evaluationType: 'originality',
              timestamp: new Date().toISOString()
            }
          }
        });
      }
    } catch (error: any) {
      console.error("Originality evaluation error:", error);
      res.status(500).json({
        success: false,
        error: "Originality evaluation failed",
        details: error.message
      });
    }
  });

  // COGENCY EVALUATION API endpoint
  app.post("/api/cogency-evaluate", async (req: Request, res: Response) => {
    try {
      const { content, provider = 'zhi1', phase = 'comprehensive' } = req.body;

      if (!content || typeof content !== 'string') {
        return res.status(400).json({ 
          error: "Content is required and must be a string" 
        });
      }

      console.log(`${phase.toUpperCase()} COGENCY EVALUATION WITH ${provider.toUpperCase()}`);
      
      if (phase === 'quick') {
        const { performQuickAnalysis } = await import('./services/quickAnalysis');
        const result = await performQuickAnalysis(content, provider, 'cogency');
        res.json({ success: true, result });
      } else {
        const { executeFourPhaseProtocol } = await import('./services/fourPhaseProtocol');
        const evaluation = await executeFourPhaseProtocol(
          content, 
          provider as 'openai' | 'anthropic' | 'perplexity' | 'deepseek',
          'cogency'
        );
        res.json({
          success: true,
          evaluation: {
            formattedReport: evaluation.formattedReport,
            overallScore: evaluation.overallScore,
            provider: evaluation.provider,
            metadata: {
              contentLength: content.length,
              evaluationType: 'cogency',
              timestamp: new Date().toISOString()
            }
          }
        });
      }
    } catch (error: any) {
      console.error("Cogency evaluation error:", error);
      res.status(500).json({
        success: false,
        error: "Cogency evaluation failed",
        details: error.message
      });
    }
  });

  // OVERALL QUALITY EVALUATION API endpoint
  app.post("/api/overall-quality-evaluate", async (req: Request, res: Response) => {
    try {
      const { content, provider = 'zhi1', phase = 'comprehensive' } = req.body;

      if (!content || typeof content !== 'string') {
        return res.status(400).json({ 
          error: "Content is required and must be a string" 
        });
      }

      console.log(`${phase.toUpperCase()} OVERALL QUALITY EVALUATION WITH ${provider.toUpperCase()}`);
      
      if (phase === 'quick') {
        const { performQuickAnalysis } = await import('./services/quickAnalysis');
        const result = await performQuickAnalysis(content, provider, 'overall_quality');
        res.json({ success: true, result });
      } else {
        const { executeFourPhaseProtocol } = await import('./services/fourPhaseProtocol');
        const evaluation = await executeFourPhaseProtocol(
          content, 
          provider as 'openai' | 'anthropic' | 'perplexity' | 'deepseek',
          'overall_quality'
        );
        res.json({
          success: true,
          evaluation: {
            formattedReport: evaluation.formattedReport,
            overallScore: evaluation.overallScore,
            provider: evaluation.provider,
            metadata: {
              contentLength: content.length,
              evaluationType: 'overall_quality',
              timestamp: new Date().toISOString()
            }
          }
        });
      }
    } catch (error: any) {
      console.error("Overall quality evaluation error:", error);
      res.status(500).json({
        success: false,
        error: "Overall quality evaluation failed",
        details: error.message
      });
    }
  });


  // Real streaming analysis endpoint
  app.post('/api/stream-analysis', async (req: Request, res: Response) => {
    try {
      const { text, provider = 'openai' } = req.body;

      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }

      // Set headers for streaming plain text
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
      
      const prompt = `
You are conducting a Phase 1 intelligence assessment with anti-diplomatic evaluation standards.

TEXT TO ANALYZE:
${text}

CORE INTELLIGENCE QUESTIONS:

IS IT INSIGHTFUL?
DOES IT DEVELOP POINTS? (OR, IF IT IS A SHORT EXCERPT, IS THERE EVIDENCE THAT IT WOULD DEVELOP POINTS IF EXTENDED)?
IS THE ORGANIZATION MERELY SEQUENTIAL (JUST ONE POINT AFTER ANOTHER, LITTLE OR NO LOGICAL SCAFFOLDING)? OR ARE THE IDEAS ARRANGED, NOT JUST SEQUENTIALLY BUT HIERARCHICALLY?
IF THE POINTS IT MAKES ARE NOT INSIGHTFUL, DOES IT OPERATE SKILLFULLY WITH CANONS OF LOGIC/REASONING.
ARE THE POINTS CLICHES? OR ARE THEY "FRESH"?
DOES IT USE TECHNICAL JARGON TO OBFUSCATE OR TO RENDER MORE PRECISE?
IS IT ORGANIC? DO POINTS DEVELOP IN AN ORGANIC, NATURAL WAY? DO THEY 'UNFOLD'? OR ARE THEY FORCED AND ARTIFICIAL?
DOES IT OPEN UP NEW DOMAINS? OR, ON THE CONTRARY, DOES IT SHUT OFF INQUIRY (BY CONDITIONALIZING FURTHER DISCUSSION OF THE MATTERS ON ACCEPTANCE OF ITS INTERNAL AND POSSIBLY VERY FAULTY LOGIC)?
IS IT ACTUALLY INTELLIGENT OR JUST THE WORK OF SOMEBODY WHO, JUDGING BY THE SUBJECT-MATTER, IS PRESUMED TO BE INTELLIGENT (BUT MAY NOT BE)?
IS IT REAL OR IS IT PHONY?
DO THE SENTENCES EXHIBIT COMPLEX AND COHERENT INTERNAL LOGIC?
IS THE PASSAGE GOVERNED BY A STRONG CONCEPT? OR IS THE ONLY ORGANIZATION DRIVEN PURELY BY EXPOSITORY (AS OPPOSED TO EPISTEMIC) NORMS?
IS THERE SYSTEM-LEVEL CONTROL OVER IDEAS? IN OTHER WORDS, DOES THE AUTHOR SEEM TO RECALL WHAT HE SAID EARLIER AND TO BE IN A POSITION TO INTEGRATE IT INTO POINTS HE HAS MADE SINCE THEN?
ARE THE POINTS 'REAL'? ARE THEY FRESH? OR IS SOME INSTITUTION OR SOME ACCEPTED VEIN OF PROPAGANDA OR ORTHODOXY JUST USING THE AUTHOR AS A MOUTH PIECE?
IS THE WRITING EVASIVE OR DIRECT?
ARE THE STATEMENTS AMBIGUOUS?
DOES THE PROGRESSION OF THE TEXT DEVELOP ACCORDING TO WHO SAID WHAT OR ACCORDING TO WHAT ENTAILS OR CONFIRMS WHAT?
DOES THE AUTHOR USE OTHER AUTHORS TO DEVELOP HIS IDEAS OR TO CLOAK HIS OWN LACK OF IDEAS?

ANSWER THESE QUESTIONS IN CONNECTION WITH THIS TEXT. A SCORE OF N/100 (E.G. 73/100) MEANS THAT (100-N)/100 (E.G. 27/100) OUTPERFORM THE AUTHOR WITH RESPECT TO THE PARAMETER DEFINED BY THE QUESTION. YOU ARE NOT GRADING; YOU ARE ANSWERING THESE QUESTIONS. YOU DO NOT USE A RISK-AVERSE STANDARD; YOU DO NOT ATTEMPT TO BE DIPLOMATIC; YOU DO NOT ATTEMPT TO COMPLY WITH RISK-AVERSE, MEDIUM-RANGE IQ, ACADEMIC NORMS. YOU DO NOT MAKE ASSUMPTIONS ABOUT THE LEVEL OF THE PAPER; IT COULD BE A WORK OF THE HIGHEST EXCELLENCE AND GENIUS, OR IT COULD BE THE WORK OF A MORON.

IF A WORK IS A WORK OF GENIUS, YOU SAY THAT, AND YOU SAY WHY; YOU DO NOT SHY AWAY FROM GIVING WHAT MIGHT CONVENTIONALLY BE REGARDED AS EXCESSIVELY "SUPERLATIVE" SCORES; YOU GIVE IT THE SCORE IT DESERVES, NOT THE SCORE THAT A MIDWIT COMMITTEE WOULD SAY IT DESERVES.

THINK VERY VERY VERY HARD ABOUT YOUR ANSWERS; DO NOT DEFAULT TO COOKBOOK, MIDWIT EVALUATION PROTOCOLS.

DO NOT GIVE CREDIT MERELY FOR USE OF JARGON OR FOR REFERENCING AUTHORITIES. FOCUS ON SUBSTANCE. ONLY GIVE POINTS FOR SCHOLARLY REFERENCES/JARGON IF THEY UNAMBIGUOUSLY INCREASE SUBSTANCE.

METAPOINT 1: THIS IS NOT A GRADING APP. YOU GRADE THE INTELLIGENCE OF WHAT YOU ARE GIVEN. IF YOU ARE GIVEN BRILLIANT FRAGMENT, YOU GIVE IT A HIGH SCORE. YOU ARE NOT GRADING ESSAYS. YOU ARE NOT LOOKING FOR COMPLETENESS.

METAPOINT 2: DO NOT OVERVALUE TURNS OF PHRASE. AN AUTHOR SPEAKING CONFIDENTLY IS NOT NECESSARILY "SHUTTING DOWN MODES OF INQUIRY". IN FACT, IT IS LIKELY TO BE THE OPPOSITE; BY PUTTING A CLEAR STAKE IN THE GROUND, HE IS PROBABLY OPENING THEM. ANOTHER EXAMPLE: CASUAL SPEECH DOES NOT MEAN DISORGANIZED THOUGHTS. DON'T JUDGE A BOOK BY ITS COVER.

METAPOINT 3: THE APP SHOULD ALWAYS START BY SUMMARIZING THE TEXT AND ALSO CATEGORIZING IT.

METAPOINT 4: THE APP SHOULD NOT CHANGE THE GRADING BASED ON THE CATEGORY OF THE TEXT: IF A TEXT IS CATEGORIZED AS 'ADVANCED SCHOLARSHIP', IT SHOULD STILL EVALUATE IT WITH RESPECT TO THE GENERAL POPULATION, NOT WITH RESPECT ONLY TO 'ADVANCED SCHOLARLY WORKS.'

METAPOINT 5: THIS IS NOT A GRADING APP. DO NOT PENALIZE BOLDNESS. DO NOT TAKE POINTS AWAY FOR INSIGHTS THAT, IF CORRECT, STAND ON THEIR OWN. GET RID OF THE IDEA THAT "ARGUMENTATION" IS WHAT MAKES SOMETHING SMART; IT ISN'T. WHAT MAKES SOMETHING SMART IS THAT IT IS SMART (INSIGHTFUL). PERIOD.

PARADIGM OF PHONY PSEUDO-INTELLECTUAL TEXT:
In this dissertation, I critically examine the philosophy of transcendental empiricism. Transcendental empiricism is, among other things, a philosophy of mental content. It attempts to dissolve an epistemological dilemma of mental content by splitting the difference between two diametrically opposed accounts of content.

This shows: 1. DOCTRINES ARE LABELLED, BUT NEVER DEFINED; AND THEIR MEANINGS CANNOT BE INFERRED FROM CONTEXT 2. THIS PASSAGE CONTAINS FREE VARIABLES. FOR EXAMPLE, "among other things" QUALIFICATION IS NEVER CLARIFIED 3. THE AUTHOR NEVER IDENTIFIES THE "EPISTEMOLOGICAL DILEMMA" IN QUESTION.

**ABSOLUTE QUOTATION REQUIREMENTS - NO EXCEPTIONS**:

1. **INTRODUCTION**: Must include AT LEAST THREE direct quotes from the source text
2. **EVERY SINGLE QUESTION**: Must be substantiated with AT LEAST ONE direct quote from the source text
3. **CONCLUSION**: Must include AT LEAST THREE direct quotes from the source text

**THIS APPLIES REGARDLESS OF TEXT LENGTH**: Whether the passage is 3 words or 10 million words, you MUST quote directly from it.

**QUOTATION FORMAT**: Use exact quotation marks: "exact text from source"

**STRUCTURE REQUIREMENTS**:
- INTRODUCTION with 3+ quotes: "quote 1" ... "quote 2" ... "quote 3"
- SUMMARY AND CATEGORY with quotes
- Each question answer with quotes: Q1: [Answer with "direct quote"] 
- CONCLUSION with 3+ quotes: "quote 1" ... "quote 2" ... "quote 3"

**NO ANSWER WITHOUT QUOTES**: If you cannot find a relevant quote for any question, you must still quote something from the text and explain its relevance.

PROVIDE A FINAL VALIDATED SCORE OUT OF 100 IN THE FORMAT: SCORE: X/100
`.trim();

      // Stream from OpenAI with immediate flushing
      console.log(`Calling OpenAI API with model gpt-4o...`);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          stream: true,
          max_tokens: 4000,
          temperature: 0.7,
        }),
      });

      console.log(`OpenAI response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenAI API Error: ${response.status} - ${errorText}`);
        throw new Error(`OpenAI API Error: ${response.status} - ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body from OpenAI');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      console.log('Starting to read streaming response...');
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('Streaming completed');
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                res.write(content);
                // Force flush - remove type check
                (res as any).flush?.();
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
      
      res.end();
      
    } catch (error) {
      console.error('Streaming error:', error);
      res.write(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      res.end();
    }
  });

  // Re-rewrite endpoint for recursive humanization
  app.post("/api/re-rewrite", async (req: Request, res: Response) => {
    try {
      const { text, styleText, provider = 'zhi2', customInstructions, stylePresets } = req.body;

      if (!text || !styleText) {
        return res.status(400).json({ 
          error: "Text to re-rewrite and style sample are both required" 
        });
      }

      console.log(`Starting re-rewrite with ${provider}...`);
      
      const { performReRewrite } = await import('./services/gptBypassHumanizer');
      
      const result = await performReRewrite(text, styleText, provider, customInstructions, stylePresets);
      
      res.json({
        success: true,
        result: result
      });
      
    } catch (error: any) {
      console.error("Re-rewrite error:", error);
      res.status(500).json({ 
        error: true, 
        message: error.message || "Re-rewrite failed" 
      });
    }
  });


  // Get style presets
  app.get("/api/style-presets", async (_req: Request, res: Response) => {
    try {
      const { STYLE_PRESETS } = await import('./services/gptBypassHumanizer');
      res.json({ presets: STYLE_PRESETS });
    } catch (error: any) {
      console.error("Error getting style presets:", error);
      res.status(500).json({ 
        error: true, 
        message: "Failed to load style presets" 
      });
    }
  });

  // Chunk text endpoint
  app.post("/api/chunk-text", async (req: Request, res: Response) => {
    try {
      const { text, maxWords = 500 } = req.body;

      if (!text || typeof text !== 'string') {
        return res.status(400).json({ 
          error: "Text is required and must be a string" 
        });
      }

      const { chunkText } = await import('./services/gptBypassHumanizer');
      const chunks = chunkText(text, maxWords);
      
      res.json({
        success: true,
        chunks: chunks
      });
      
    } catch (error: any) {
      console.error("Text chunking error:", error);
      res.status(500).json({ 
        error: true, 
        message: error.message || "Text chunking failed" 
      });
    }
  });

  // Evaluate text with GPTZero
  app.post("/api/evaluate-ai", async (req: Request, res: Response) => {
    try {
      const { text } = req.body;

      if (!text || typeof text !== 'string') {
        return res.status(400).json({ 
          error: "Text is required and must be a string" 
        });
      }

      const { evaluateWithGPTZero } = await import('./services/gptBypassHumanizer');
      const score = await evaluateWithGPTZero(text);
      
      res.json({
        success: true,
        humanPercentage: score
      });
      
    } catch (error: any) {
      console.error("AI evaluation error:", error);
      res.status(500).json({ 
        error: true, 
        message: error.message || "AI evaluation failed" 
      });
    }
  });

  // ==============================================================================
  // GPT BYPASS HUMANIZER ROUTES - Complete Implementation
  // ==============================================================================

  // File upload endpoint for GPT Bypass
  app.post("/api/upload", gptBypassUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      await fileProcessorService.validateFile(req.file);
      const processedFile = await fileProcessorService.processFile(req.file.path, req.file.originalname);
      
      // Analyze with GPTZero
      const gptZeroResult = await gptZeroService.analyzeText(processedFile.content);
      
      // Create document record
      const document = await storage.createDocument({
        filename: processedFile.filename,
        content: processedFile.content,
        wordCount: processedFile.wordCount,
        // aiScore: gptZeroResult.aiScore, // This field may not exist in current schema
      });

      // Generate chunks if text is long enough
      const chunks = processedFile.wordCount > 500 
        ? textChunkerService.chunkText(processedFile.content)
        : [];

      // Analyze chunks if they exist
      if (chunks.length > 0) {
        const chunkTexts = chunks.map(chunk => chunk.content);
        const chunkResults = await gptZeroService.analyzeBatch(chunkTexts);
        
        chunks.forEach((chunk, index) => {
          chunk.aiScore = chunkResults[index].aiScore;
        });
      }

      res.json({
        document,
        chunks,
        aiScore: gptZeroResult.aiScore,
        needsChunking: processedFile.wordCount > 500,
      });
    } catch (error: any) {
      console.error('File upload error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Text analysis endpoint (for direct text input)
  app.post("/api/analyze-text", async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ message: "Text is required" });
      }

      const gptZeroResult = await gptZeroService.analyzeText(text);
      const wordCount = text.trim().split(/\s+/).length;
      
      // Generate chunks if text is long enough
      const chunks = wordCount > 500 ? textChunkerService.chunkText(text) : [];
      
      // Analyze chunks if they exist
      if (chunks.length > 0) {
        const chunkTexts = chunks.map(chunk => chunk.content);
        const chunkResults = await gptZeroService.analyzeBatch(chunkTexts);
        
        chunks.forEach((chunk, index) => {
          chunk.aiScore = chunkResults[index].aiScore;
        });
      }

      res.json({
        aiScore: gptZeroResult.aiScore,
        wordCount,
        chunks,
        needsChunking: wordCount > 500,
      });
    } catch (error: any) {
      console.error('Text analysis error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Main rewrite endpoint - GPT Bypass Humanizer
  app.post("/api/rewrite", async (req, res) => {
    try {
      const rewriteRequest: RewriteRequest = req.body;
      
      // Validate request
      if (!rewriteRequest.inputText || !rewriteRequest.provider) {
        return res.status(400).json({ message: "Input text and provider are required" });
      }

      // Analyze input text
      const inputAnalysis = await gptZeroService.analyzeText(rewriteRequest.inputText);
      
      // Create rewrite job
      const rewriteJob = await storage.createRewriteJob({
        inputText: rewriteRequest.inputText,
        styleText: rewriteRequest.styleText,
        contentMixText: rewriteRequest.contentMixText,
        customInstructions: rewriteRequest.customInstructions,
        selectedPresets: rewriteRequest.selectedPresets,
        provider: rewriteRequest.provider,
        chunks: [],
        selectedChunkIds: rewriteRequest.selectedChunkIds,
        mixingMode: rewriteRequest.mixingMode,
        inputAiScore: inputAnalysis.aiScore,
        status: "processing",
      });

      try {
        // Perform rewrite
        const rewrittenText = await aiProviderService.rewrite(rewriteRequest.provider, {
          inputText: rewriteRequest.inputText,
          styleText: rewriteRequest.styleText,
          contentMixText: rewriteRequest.contentMixText,
          customInstructions: rewriteRequest.customInstructions,
          selectedPresets: rewriteRequest.selectedPresets,
          mixingMode: rewriteRequest.mixingMode,
        });

        // Analyze output text
        const outputAnalysis = await gptZeroService.analyzeText(rewrittenText);

        // Clean markup from rewritten text
        const cleanedRewrittenText = cleanMarkup(rewrittenText);

        // Update job with results
        await storage.updateRewriteJob(rewriteJob.id, {
          outputText: cleanedRewrittenText,
          outputAiScore: outputAnalysis.aiScore,
          status: "completed",
        });

        const response: RewriteResponse = {
          rewrittenText: cleanedRewrittenText,
          inputAiScore: inputAnalysis.aiScore,
          outputAiScore: outputAnalysis.aiScore,
          jobId: rewriteJob.id.toString(),
        };

        res.json(response);
      } catch (error) {
        // Update job with error status
        await storage.updateRewriteJob(rewriteJob.id, {
          status: "failed",
        });
        throw error;
      }
    } catch (error: any) {
      console.error('Rewrite error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Re-rewrite endpoint
  app.post("/api/re-rewrite/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      const { customInstructions, selectedPresets, provider } = req.body;
      
      const originalJob = await storage.getRewriteJob(parseInt(jobId));
      if (!originalJob || !originalJob.outputText) {
        return res.status(404).json({ message: "Original job not found or incomplete" });
      }

      // Create new rewrite job using the previous output as input
      const rewriteJob = await storage.createRewriteJob({
        inputText: originalJob.outputText,
        styleText: originalJob.styleText,
        contentMixText: originalJob.contentMixText,
        customInstructions: customInstructions || originalJob.customInstructions,
        selectedPresets: selectedPresets || originalJob.selectedPresets,
        provider: provider || originalJob.provider,
        chunks: [],
        selectedChunkIds: [],
        mixingMode: originalJob.mixingMode,
        inputAiScore: originalJob.outputAiScore,
        status: "processing",
      });

      try {
        // Perform re-rewrite
        const rewrittenText = await aiProviderService.rewrite(provider || originalJob.provider, {
          inputText: originalJob.outputText,
          styleText: originalJob.styleText || undefined,
          contentMixText: originalJob.contentMixText || undefined,
          customInstructions: customInstructions || originalJob.customInstructions,
          selectedPresets: selectedPresets || originalJob.selectedPresets,
          mixingMode: originalJob.mixingMode || undefined,
        });

        // Analyze new output
        const outputAnalysis = await gptZeroService.analyzeText(rewrittenText);

        // Clean markup from output
        const cleanedRewrittenText = cleanMarkup(rewrittenText);

        // Update job with results
        await storage.updateRewriteJob(rewriteJob.id, {
          outputText: cleanedRewrittenText,
          outputAiScore: outputAnalysis.aiScore,
          status: "completed",
        });

        const response: RewriteResponse = {
          rewrittenText: cleanedRewrittenText,
          inputAiScore: originalJob.outputAiScore || 0,
          outputAiScore: outputAnalysis.aiScore,
          jobId: rewriteJob.id.toString(),
        };

        res.json(response);
      } catch (error) {
        await storage.updateRewriteJob(rewriteJob.id, { status: "failed" });
        throw error;
      }
    } catch (error: any) {
      console.error('Re-rewrite error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get rewrite job status
  app.get("/api/jobs/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      const job = await storage.getRewriteJob(parseInt(jobId));
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      res.json(job);
    } catch (error: any) {
      console.error('Get job error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // List recent jobs
  app.get("/api/jobs", async (req, res) => {
    try {
      const jobs = await storage.listRewriteJobs();
      res.json(jobs);
    } catch (error: any) {
      console.error('List jobs error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Main GPT Bypass Humanizer endpoint expected by frontend
  app.post("/api/gpt-bypass-humanizer", async (req, res) => {
    try {
      const { boxA, boxB, provider = 'zhi2', customInstructions, stylePresets, selectedChunkIds, chunks } = req.body;
      
      // Validate request
      if (!boxA) {
        return res.status(400).json({ 
          success: false, 
          message: "Box A (text to humanize) is required" 
        });
      }
      
      if (!boxB) {
        return res.status(400).json({ 
          success: false, 
          message: "Box B (human style sample) is required" 
        });
      }

      // Analyze input text
      const inputAnalysis = await gptZeroService.analyzeText(boxA);
      
      // Create rewrite job
      const rewriteJob = await storage.createRewriteJob({
        inputText: boxA,
        styleText: boxB,
        contentMixText: "", // Not used in this interface
        customInstructions,
        selectedPresets: stylePresets,
        provider,
        chunks: chunks || [],
        selectedChunkIds: selectedChunkIds || [],
        mixingMode: "style",
        inputAiScore: inputAnalysis.aiScore,
        status: "processing",
      });

      try {
        // Perform humanization
        const humanizedText = await aiProviderService.rewrite(provider, {
          inputText: boxA,
          styleText: boxB,
          customInstructions,
          selectedPresets: stylePresets,
          mixingMode: "style",
        });

        // Analyze output text
        const outputAnalysis = await gptZeroService.analyzeText(humanizedText);

        // Clean markup from output
        const cleanedHumanizedText = cleanMarkup(humanizedText);

        // Update job with results
        await storage.updateRewriteJob(rewriteJob.id, {
          outputText: cleanedHumanizedText,
          outputAiScore: outputAnalysis.aiScore,
          status: "completed",
        });

        res.json({
          success: true,
          result: {
            humanizedText: cleanedHumanizedText,
            originalScore: inputAnalysis.aiScore,
            humanizedScore: outputAnalysis.aiScore,
            jobId: rewriteJob.id,
          },
        });
      } catch (error) {
        // Update job with error status
        await storage.updateRewriteJob(rewriteJob.id, {
          status: "failed",
        });
        throw error;
      }
    } catch (error: any) {
      console.error('GPT Bypass Humanizer error:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  });

  // Writing samples endpoint - CATEGORIZED
  app.get("/api/writing-samples", async (req, res) => {
    try {
      const samples = {
        "CONTENT-NEUTRAL": {
          "Formal and Functional Relationships": `There are two broad types of relationships: formal and functional.
Formal relationships hold between descriptions. A description is any statement that can be true or false.
Example of a formal relationship: The description that a shape is a square cannot be true unless the description that it has four equal sides is true. Therefore, a shape's being a square depends on its having four equal sides.

Functional relationships hold between events or conditions. (An event is anything that happens in time.)
Example of a functional relationship: A plant cannot grow without water. Therefore, a plant's growth depends on its receiving water.

The first type is structural, i.e., it holds between statements about features.
The second is operational, i.e., it holds between things in the world as they act or change.

Descriptions as objects of consideration
The objects of evaluation are descriptions. Something is not evaluated unless it is described, and it is not described unless it can be stated. One can notice non-descriptions — sounds, objects, movements — but in the relevant sense one evaluates descriptions of them.

Relationships not known through direct observation
Some relationships are known, not through direct observation, but through reasoning. Such relationships are structural, as opposed to observational. Examples of structural relationships are:

If A, then A or B.

All tools require some form of use.

Nothing can be both moving and perfectly still.

There are no rules without conditions.

1 obviously expresses a relationship; 2–4 do so less obviously, as their meanings are:

2*. A tool's being functional depends on its being usable.
3*. An object's being both moving and still depends on contradictory conditions, which cannot occur together.
4*. The existence of rules depends on the existence of conditions to which they apply.

Structural truth and structural understanding
Structural understanding is always understanding of relationships. Observational understanding can be either direct or indirect; the same is true of structural understanding.`,

          "Alternative Account of Explanatory Efficiency": `A continuation of the earlier case will make it clear what this means and why it matters. Why doesn't the outcome change under the given conditions? Because, says the standard account, the key factor remained in place. But, the skeptic will counter, perhaps we can discard that account; perhaps there's an alternative that fits the observations equally well. But, I would respond, even granting for argument's sake that such an alternative exists, it doesn't follow that it avoids more gaps than the one it replaces. It doesn't follow that it is comparable from a trade-off standpoint to the original—that it reduces as many issues as the old view while introducing no more new ones. In fact, the opposite often holds. Consider the alternative mentioned earlier. The cost of that account—meaning what new puzzles it creates—is vastly greater than its value—meaning what old puzzles it removes. It would be difficult to devise an account inconsistent with the conventional one that, while still matching the relevant evidence, is equally efficient in explanatory terms. You can test this for yourself. If there is reason to think even one such account exists, it is not because it has ever been produced. That reason, if it exists, must be purely theoretical. And for reasons soon to be made clear, no such purely theoretical reason can justify accepting it.`
        },
        
        "EPISTEMOLOGY": {
          "Rational Belief and Underlying Structure": `When would it become rational to believe that, next time, you're more likely than not to roll this as opposed to that number—that, for example, you're especially likely to roll a 27? This belief becomes rational when, and only when, you have reason to believe that a 27-roll is favored by the structures involved in the game. And that belief, in its turn, is rational if you know that circumstances at all like the following obtain: *The dice are magnetically attracted to the 27-slot. *On any given occasion, you have an unconscious intention to roll a 27 (even though you have no conscious intention of doing this), and you're such a talented dice-thrower that, if you can roll a 27 if it is your (subconscious) intention to do so. *The 27-slot is much bigger than any of the other slots. In fact, it takes up so much space on the roulette wheel that the remaining spaces are too small for the ball to fit into them. You are rational to believe that you'll continue to roll 27s to the extent that your having thus far rolled multiple 27s in a row gives you reason to believe there to be some underlying structure favoring that outcome.`,

          "Hume, Induction, and the Logic of Explanation": `We haven't yet refuted Hume's argument—we've only taken the first step towards doing so. Hume could defend his view against what we've said thus by far by saying the following: Suppose that, to explain why all phi's thus far known are psi's, you posit some underlying structure or law that disposes phi's to be psi's. Unless you think that nature is uniform, you have no right to expect that connection to continue to hold. But if, in order to deal with this, you suppose that nature is uniform, then you're caught in the vicious circle that I described. HR is correct. One is indeed caught in a vicious circle if, in order to show the legitimacy of inductive inference, one assumes UP; and the reason is that, just as Hume says, UP can be known, if at all, only on inductive grounds.`,

          "Explanatory Goodness vs. Correctness": `For an explanation to be good isn't for it to be correct. Sometimes the right explanations are bad ones. A story will make this clear. I'm on a bus. The bus driver is smiling. A mystery! 'What on Earth does he have to smile about?' I ask myself. His job is so boring, and his life must therefore be such a horror.' But then I remember that, just a minute ago, a disembarking passenger gave him fifty $100 bills as a tip. So I have my explanation: 'he just came into a lot of money.' But here is the very different explanation tendered by my seatmate Gus, who, in addition to being unintelligent, is also completely insane. 'The bus-driver is a CIA assassin. This morning he killed somebody who, by coincidence, had the name Benjamin Franklin. Benjamin Franklin (the statesman, not the murder victim) is on the $100 bill. So when the bus driver saw those bills, he immediately thought of that morning's murder. The murder was a particularly enjoyable one; the bus driver is remembering the fun he had, and that's why he's smiling.'`,

          "Knowledge vs. Awareness": `Knowledge is conceptually articulated awareness. In order for me to know that my shoes are uncomfortably tight, I need to have the concepts shoe, tight, discomfort, etc. I do not need to have these concepts—or, arguably, any concepts—to be aware of the uncomfortable tightness in my shoes. My knowledge of that truth is a conceptualization of my awareness of that state of affairs. Equivalently, there are two kinds of awareness: propositional and objectual. My visual perception of the dog in front of me is a case of objectual awareness, as is my awareness of the tightness of my shoes. My knowledge that there is a dog in front of me is a case of proposition-awareness, as is my knowledge that my shoes are uncomfortably tight.`
        },

        "PARADOXES": {
          "The Loser Paradox": `People who are the bottom of a hierarchy are far less likely to spurn that hierarchy than they are to use it against people who are trying to climb the ranks of that hierarchy. The person who never graduates from college may in some contexts claim that a college degree is worthless, but he is unlikely to act accordingly. When he comes across someone without a college degree who is trying to make something of himself, he is likely to pounce on that person, claiming he is an uncredentialed fraud. Explanation: Losers want others to share their coffin, and if that involves hyper-valuing the very people or institutions that put them in that coffin, then so be it.`,

          "The Sour Secretary Paradox": `The more useless a given employee is to the organization that employs her, the more unstintingly she will toe that organization's line. This is a corollary of the loser paradox.`,

          "The Indie Writer's Paradox": `People don't give good reviews to writers who do not already have positive reviews. Analysis: This is a veridical paradox, in the sense that it describes an actual vicious circle and does not represent a logical blunder. An independent writer is by definition one who does not have a marketing apparatus behind him, and such a writer depends on uncoerced positive reviews. But people are extremely reluctant to give good reviews to writers who are not popular already or who do not have the weight of some institution behind them.`,

          "Paradox of Connectedness": `Communications technology is supposed to connect us but separates us into self-contained, non-interacting units. Solution: Communications technology is not supposed to connect us emotionally. On the contrary, it is supposed to connect us in such a way that we can transact without having to bond emotionally. And that is what it does. It connects us logically while disconnecting us emotionally.`,

          "Arrow's Information Paradox": `If you don't know what it is, you don't buy it. Therefore, you don't buy information unless you know what it is. But if you know what it is, you don't need to buy it. But information is bought. Solution: The obvious solution is that information can be described without being disclosed. I can tell you that I have the so and so's phone number without giving you that number, and the circumstances may give you reason to believe me.`,

          "Buridan's Ass": `An ass that has to choose between food and water and is exactly as hungry as it is thirsty cannot make a choice and will therefore be paralyzed by indecision. But such an ass would in fact be able to make a decision. Explanation: This isn't exactly a paradox. There is nothing absurd in the supposition that a creature in such a situation might simply 'halt', and we don't know that actual biological creatures would not in fact halt in such a situation, since it seldom if ever happens that a creature is confronted with options that are exactly equally appealing.`
        }
      };
      
      res.json({ samples });
    } catch (error: any) {
      console.error('Writing samples error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Style presets endpoint - COMPLETE CATEGORIZED SYSTEM
  app.get("/api/style-presets", async (req, res) => {
    try {
      const presets = {
        // MOST IMPORTANT (1-8) - CRITICAL FOR HUMANIZATION
        "CRITICAL_FOR_HUMANIZATION": {
          "1. Mixed cadence + clause sprawl": "Alternate short and long sentences; allow some long sentences to wander with extra clauses.",
          "2. Asymmetric emphasis": "Over-elaborate one point; compress or skate past another.", 
          "3. One aside": "Add a quick parenthetical or em-dash remark — factual, not jokey.",
          "4. Hedge twice": "Use two mild uncertainty markers (\"probably,\" \"seems,\" \"roughly,\" \"I think\").",
          "5. Local disfluency": "Keep one redundant or slightly awkward phrase that still makes sense.",
          "6. Analogy injection": "Insert a short, concrete comparison to something unrelated but illustrative.",
          "7. Topic snap": "Abruptly shift focus once, then return.",
          "8. Friction detail": "Drop in a small, seemingly unnecessary but real-world-plausible detail."
        },

        // STRUCTURE & CADENCE
        "STRUCTURE_AND_CADENCE": {
          "Compression — light (−15%)": "Cut filler; merge short clauses; keep meaning.",
          "Compression — medium (−30%)": "Trim hard; delete throat-clearing; tighten syntax.",
          "Compression — heavy (−45%)": "Sever redundancies; collapse repeats; keep core claims.",
          "DECREASE BY 50%": "REDUCE THE LENGTH BY HALF WHILE PRESERVING MEANING",
          "INCREASE BY 150%": "EXPAND THE TEXT TO 150% LONGER WITH ADDITIONAL DETAIL AND ELABORATION",
          "Mixed cadence": "Alternate 5–35-word sentences; no uniform rhythm.",
          "Clause surgery": "Reorder main/subordinate clauses in 30% of sentences.",
          "Front-load claim": "Put the main conclusion in sentence 1; support follows.",
          "Back-load claim": "Delay the conclusion to the final 2–3 sentences.",
          "Seam/pivot": "Drop smooth connectors once; abrupt turn is fine."
        },

        // FRAMING & INFERENCE  
        "FRAMING_AND_INFERENCE": {
          "Imply one step": "Omit an obvious inferential step; leave it implicit.",
          "Conditional framing": "Recast one key sentence as \"If/Unless …, then …\".",
          "Local contrast": "Use \"but/except/aside\" once to mark a boundary—no new facts.",
          "Scope check": "Replace one absolute with a bounded form (\"in cases like these\")."
        },

        // DICTION & TONE
        "DICTION_AND_TONE": {
          "Deflate jargon": "Swap nominalizations for verbs where safe (e.g., \"utilization\" → \"use\").",
          "Kill stock transitions": "Delete \"Moreover/Furthermore/In conclusion\" everywhere.",
          "Hedge once": "Use exactly one: \"probably/roughly/more or less.\"",
          "Drop intensifiers": "Remove \"very/clearly/obviously/significantly.\"",
          "Low-heat voice": "Prefer plain verbs; avoid showy synonyms.",
          "One aside": "One short parenthetical or em-dash aside; keep it factual."
        },

        // CONCRETENESS & BENCHMARKS
        "CONCRETENESS_AND_BENCHMARKS": {
          "Concrete benchmark": "Replace one vague scale with a testable one (e.g., \"enough to X\").",
          "Swap generic example": "If the source has an example, make it slightly more specific; else skip.",
          "Metric nudge": "Replace \"more/better\" with a minimal, source-safe comparator (\"more than last case\")."
        },

        // ASYMMETRY & FOCUS
        "ASYMMETRY_AND_FOCUS": {
          "Asymmetric emphasis": "Linger on the main claim; compress secondary points sharply.",
          "Cull repeats": "Delete duplicated sentences/ideas; keep the strongest instance.",
          "Topic snap": "Change focus abruptly once; no recap."
        },

        // FORMATTING & OUTPUT HYGIENE
        "FORMATTING_AND_OUTPUT_HYGIENE": {
          "No lists": "Force continuous prose; remove bullets/numbering.",
          "No meta": "No prefaces, apologies, or \"as requested\" scaffolding.",
          "Exact nouns": "Replace vague pronouns where antecedent is ambiguous.",
          "Quote once": "If the source contains a strong phrase, quote it once; else skip."
        },

        // SAFETY / GUARDRAILS
        "SAFETY_GUARDRAILS": {
          "Claim lock": "Do not add examples, scenarios, or data not present in the source.",
          "Entity lock": "Keep names, counts, and attributions exactly as given."
        },

        // COMBO PRESETS (ONE-LINERS)
        "COMBO_PRESETS": {
          "Lean & Sharp": "Compression-medium + mixed cadence + imply one step + kill stock transitions.",
          "Analytic": "Clause surgery + front-load claim + scope check + exact nouns + no lists."
        }
      };
      
      res.json({ presets });
    } catch (error: any) {
      console.error('Style presets error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Text Model Validator endpoint
  app.post("/api/text-model-validator", async (req: Request, res: Response) => {
    try {
      const { text, mode, targetDomain, fidelityLevel, mathFramework, constraintType, rigorLevel, customInstructions, truthMapping, mathTruthMapping, literalTruth, llmProvider } = req.body;

      if (!text || !mode) {
        return res.status(400).json({ 
          success: false,
          message: "Text and mode are required" 
        });
      }

      console.log(`Text Model Validator - Mode: ${mode}, Target Domain: ${targetDomain || 'not specified'}`);

      // Build the prompt based on the mode
      let systemPrompt = "";
      let userPrompt = "";

      if (mode === "reconstruction") {
        // Count input words for reference
        const inputWordCount = text.trim().split(/\s+/).length;
        
        if (fidelityLevel === 'conservative') {
          systemPrompt = `You are a RECONSTRUCTOR. You diagnose what's wrong with an argument and fix THAT SPECIFIC THING.

FIRST: DIAGNOSE the problem. The text has ONE of these issues:

A. VAGUE CLAIM → Make it clear and specific
B. WEAK ARGUMENT → Make it strong (add the missing logical step or evidence)
C. FALSE CLAIM → Find the closest TRUE claim and defend that instead
D. GOOD BUT OBSCURE/IMPLICIT → Make the reasoning clear and explicit
E. NEEDS EMPIRICAL SUPPORT → Provide the empirical argument (data, examples, studies)
F. ELLIPTICAL (skips steps) → Fill in the missing steps

THEN: Fix the diagnosed problem. Do ONLY that. Don't redecorate.

WHAT "FIX" MEANS:
- If vague: state exactly what is meant
- If weak: add the missing premise or evidence that makes it strong
- If false: identify the closest true version and argue for that
- If implicit: spell out what was left unsaid
- If needs empirical support: provide specific data/examples
- If elliptical: insert the skipped logical steps

DO NOT:
- Add fancy vocabulary
- Expand for the sake of length
- Add hedging or qualifications
- Rewrite what already works
- Sound "more academic"

The output should read like what the author WOULD have written if they were clearer thinkers—same voice, same intent, but with the reasoning fixed.

CRITICAL: NO markdown formatting (no # headers, no ** bold **, no * italics *). Use plain text only.`;

          userPrompt = `RECONSTRUCT THIS TEXT

${text}

${targetDomain ? `Domain context: ${targetDomain}` : ''}
${customInstructions ? `\nUser instructions: ${customInstructions}` : ''}

STEP 1 - DIAGNOSE (state this briefly):
What type of problem does this text have?
- Vague claim?
- Weak argument?
- False claim (needs true substitute)?
- Good but obscure/implicit?
- Needs empirical support?
- Elliptical (skips steps)?

STEP 2 - RECONSTRUCT:
Fix the diagnosed problem. Output the improved version.

FORMAT:
DIAGNOSIS: [1-2 sentences identifying the problem type]

RECONSTRUCTED:
[The fixed text - same voice as original, but with reasoning repaired]`;

        } else {
          // AGGRESSIVE MODE - maximum intervention
          systemPrompt = `You are an AGGRESSIVE RECONSTRUCTOR. You diagnose ALL problems and fix them.

FOR EACH CLAIM OR ARGUMENT IN THE TEXT:

1. VAGUE? → Make it specific and clear
2. WEAK? → Strengthen with missing logic or evidence  
3. FALSE? → Replace with the closest true claim
4. IMPLICIT? → Make explicit
5. NEEDS DATA? → Add empirical support (real examples, real numbers)
6. ELLIPTICAL? → Fill in skipped steps

You may need to apply multiple fixes to different parts.

PROVIDE REAL EVIDENCE:
- Name specific studies, people, companies, events
- Use actual numbers and dates
- If you don't know the real data, say "needs citation" rather than making it up

OUTPUT: The fully reconstructed text. Same voice as original but with all reasoning problems fixed.

Do NOT add academic bloat or decorative language.`;
        
          userPrompt = `AGGRESSIVELY RECONSTRUCT THIS TEXT

${text}

${targetDomain ? `Domain: ${targetDomain}` : ''}
${customInstructions ? `\nUser instructions: ${customInstructions}` : ''}

Fix every problem you find:
- Vague claims → specific claims
- Weak arguments → strong arguments
- False claims → closest true claims
- Implicit reasoning → explicit reasoning
- Missing evidence → real empirical support
- Elliptical steps → filled-in steps

OUTPUT: The reconstructed text only. No commentary.`;
        }

      } else if (mode === "isomorphism") {
        systemPrompt = `You are an expert at finding isomorphic structures across domains. You can preserve exact relational structure while systematically swapping domain vocabulary, revealing the non-uniqueness of interpretation.

CRITICAL OUTPUT RULES:
- NO markdown headers (# or ##)
- NO markdown formatting
- Use plain text with clear section labels
- Natural paragraph formatting only`;
        
        userPrompt = `ISOMORPHISM MODE

Text to map:
${text}

${targetDomain ? `Target domain: ${targetDomain}` : ''}
${constraintType ? `Constraint type: ${constraintType}` : ''}
${customInstructions ? `\nCustom Instructions: ${customInstructions}` : ''}

Task: Preserve the exact relational structure of this text while systematically swapping domain vocabulary. Show that the same pattern exists in ${targetDomain || 'another domain'}.

Provide:
1. Relation Graph: Map the key dependencies, contradictions, and mutual supports in the original
2. Isomorphic Version: The same structure expressed in the target domain
3. Mapping Table: Explicit mappings showing [original term] → [target domain equivalent]
${constraintType === 'true-statements' ? '4. Truth Verification: Verify that the mapped statements are actually true in the target domain' : ''}

CRITICAL: NO markdown formatting (no # headers, no ** bold **, no * italics *). Use plain text labels like "1. Relation Graph" not "## 1. Relation Graph". Output clean, natural prose.`;

      } else if (mode === "mathmodel") {
        systemPrompt = `You are an expert logician and model theorist. Your task is to build ACTUAL first-order models - not vague "formalizations" or prose summaries.

A MODEL consists of:
1. A DOMAIN D (a non-empty set of objects)
2. An INTERPRETATION function that assigns:
   - Each constant symbol to an element of D
   - Each n-ary predicate symbol to a set of n-tuples from D
   - Each n-ary function symbol to a function from D^n to D

Your job is to EXTRACT the implicit ontology and logical structure from natural language text, formalize it as axioms, and then BUILD an explicit model that satisfies those axioms.

CRITICAL CONSTRAINTS:
- NO hand-wavy "formalizations" - every symbol must have an explicit interpretation
- NO trivial one-element domains unless the text genuinely requires it
- Domain elements should be drawn from the TEXT, not invented
- Every predicate must have its extension (the set of tuples that satisfy it) listed explicitly
- You must VERIFY each axiom against the model

OUTPUT FORMAT: Use plain text with numbered sections. NO markdown formatting (no # headers, no ** bold **, no * italics *).`;
        
        userPrompt = `FIRST-ORDER MODEL CONSTRUCTION

================================
TEXT TO FORMALIZE
================================
${text}

${mathFramework ? `Mathematical framework preference: ${mathFramework}` : ''}
${rigorLevel ? `Rigor level: ${rigorLevel}` : ''}
${customInstructions ? `\nCustom Instructions: ${customInstructions}` : ''}

================================
YOUR TASK
================================
Build a genuine first-order model of this text. Follow these sections EXACTLY:

1. SIGNATURE

Define the formal language:
- DOMAIN: Describe what objects populate D (1-2 sentences)
- CONSTANTS: List each constant with its English meaning
  Format: c1 = "meaning", c2 = "meaning", ...
- PREDICATES: List each predicate with arity and meaning
  Format: P(x) = "x has property P", R(x,y) = "x stands in relation R to y"
- FUNCTIONS (if needed): List each function with meaning
  Format: f(x) = "the result of applying f to x"

2. TRANSLATION SCHEMA

Map the key English claims from the text to first-order formulas.
Give 5-15 translations:
- English: "exact quote or paraphrase from text"
  Formula: Corresponding first-order formula using your signature

3. AXIOMS

Extract 5-15 core axioms that capture the essential claims. State them as PURE FORMULAS only (no English):

(AX1) ∀x (P(x) → Q(x))
(AX2) ∃x (R(x,c1) ∧ S(x))
(AX3) ...

Use standard logical notation: ∀ (for all), ∃ (exists), → (implies), ∧ (and), ∨ (or), ¬ (not), ↔ (iff)

4. EXPLICIT MODEL

Construct ONE concrete model M that satisfies all axioms (if possible):

- DOMAIN D: List elements explicitly
  D = {a, b, c, d, ...}  (use lowercase letters or descriptive names from the text)

- CONSTANT INTERPRETATION:
  c1 := element_from_D
  c2 := element_from_D
  ...

- PREDICATE INTERPRETATION (give the EXTENSION of each predicate):
  P := { x ∈ D : x satisfies P } = { a, c }
  R := { (x,y) ∈ D² : x R y } = { (a,b), (c,d) }
  ...

- FUNCTION INTERPRETATION (if any):
  f := { (x, f(x)) : x ∈ D } = { (a,b), (b,c) }

5. SATISFACTION CHECK

For EACH axiom, verify whether it is TRUE or FALSE in M:

(AX1): TRUE in M because [brief mechanical verification]
(AX2): TRUE in M because [brief verification]
(AX3): FALSE in M because [explain counterexample]
...

VERDICT:
If all axioms satisfied: "MODEL FOUND: M satisfies all axioms. The text is internally consistent."
If any axiom fails: "NO SATISFYING MODEL FOUND with this domain. Axioms AX3, AX7 fail. The text may be internally inconsistent, or a larger domain is needed."

6. LOGICAL PROPERTIES (Optional but valuable)

Comment on:
- Is the axiom set consistent? (Does a model exist?)
- Are there logical dependencies? (Does one axiom entail another?)
- What is the minimal domain size that could satisfy the axioms?
- Are there multiple non-isomorphic models?

CRITICAL REMINDERS:
- Be EXPLICIT: List every element of every extension
- Be MECHANICAL: The satisfaction check should be a direct calculation
- Use elements FROM THE TEXT: Don't invent abstract entities
- Prefer SUBSTANTIVE axioms that capture real content, not trivialities`;

      } else if (mode === "autodecide") {
        systemPrompt = `You are an expert at analyzing texts and choosing the optimal validation approach. You can assess structural integrity, terminological clarity, domain specificity, and conceptual coherence to determine whether a text needs reconstruction, isomorphic demonstration, mathematical formalization, or a combination.

CRITICAL OUTPUT RULES:
- NO markdown headers (# or ##)
- NO markdown formatting
- Use plain text with clear section labels
- Natural paragraph formatting only`;
        
        userPrompt = `AUTO-DECIDE MODE

Text to analyze:
${text}

${customInstructions ? `Custom Instructions: ${customInstructions}\n` : ''}
Task: Analyze this text and determine the optimal validation approach. Consider:
- Structural integrity: Is the logic sound or broken?
- Terminological clarity: Are terms well-defined or placeholder-ish?
- Domain specificity: Is this tied to one field or abstract?
- Conceptual coherence: Do ideas fit together or conflict?

Then apply the optimal approach(es):
- Structure coherent but terminology broken → Isomorphism or Math Model
- Logic muddled but insights present → Reconstruction first, then optionally formalize
- Text already valid but obscure → Multiple isomorphisms to show flexibility
- Blend case (most common) → Multi-stage: Reconstruct → Formalize → Show isomorphic examples

Provide:
1. Analysis: Why this approach was chosen
2. Execution: Complete validation using the chosen method(s)
3. Connections: If multiple operations, show how they relate

CRITICAL: NO markdown formatting (no # headers, no ** bold **, no * italics *). Use plain text labels like "1. Analysis" not "## 1. Analysis". Output clean, natural prose.`;

      } else if (mode === "truth-isomorphism") {
        systemPrompt = `You are an expert at finding isomorphic structures across domains with explicit control over truth-value mappings. You can preserve exact relational structure while systematically swapping domain vocabulary AND controlling whether statements remain true, become false, or transform from false to true.

${literalTruth ? `LITERAL TRUTH MODE ENABLED:
You MUST ensure all generated statements are LITERALLY true, not approximately or qualifiedly true. Apply these quantifier weakening rules:

MANDATORY TRANSFORMATIONS:
- "all X do Y" → "all suitably configured X do Y" OR "X can do Y when conditions are met"
- "every X is Y" → "every X that meets criteria Z is Y" OR "X is typically Y"
- "constantly" → "when active" OR "during operation" 
- "always" → "under normal conditions" OR "typically"
- "never" → "cannot systematically" OR "does not under standard conditions"
- "cannot" → "cannot without external intervention" OR "cannot under current constraints"
- "impossible" → "impossible without violating known constraints"

VERIFICATION REQUIREMENTS:
- Every claim must be empirically verifiable
- Add conditional qualifiers wherever truth depends on context
- Avoid universal quantifiers without explicit scope limits
- Include necessary preconditions for each statement

EXAMPLE:
❌ FALSE: "All electronic devices constantly transmit signals"
✅ LITERALLY TRUE: "Electronic devices can transmit signals when powered on and connected to a network"

❌ FALSE: "Every device can receive data from any other device"
✅ LITERALLY TRUE: "Devices can exchange data when routing infrastructure and permissions allow"` : ''}

CRITICAL OUTPUT RULES:
- NO markdown headers (# or ##)
- NO markdown formatting
- Use plain text with clear section labels
- Natural paragraph formatting only`;
        
        const truthMappingDescriptions = {
          'false-to-true': 'Map FALSE statements to TRUE statements in the target domain (find true counterparts to false claims)',
          'true-to-true': 'Map TRUE statements to TRUE statements (preserve truth while swapping domains)',
          'true-to-false': 'Map TRUE statements to FALSE statements (find false counterparts to true claims)'
        };

        userPrompt = `TRUTH-VALUE ISOMORPHISM MODE

Text to map:
${text}

${targetDomain ? `Target domain: ${targetDomain}` : ''}
Truth-Value Mapping: ${truthMapping ? truthMappingDescriptions[truthMapping as keyof typeof truthMappingDescriptions] : 'Not specified'}
${customInstructions ? `\nCustom Instructions: ${customInstructions}` : ''}

Task: Preserve the exact relational structure of this text while systematically swapping domain vocabulary AND controlling truth values according to the mapping: ${truthMapping}.

${truthMapping === 'false-to-true' ? `For each FALSE statement in the original, find a TRUE statement in the target domain that has the same relational structure. If the original says "No trader can systematically beat the market" (false), find a TRUE statement in ${targetDomain || 'the target domain'} with the same form like "No perpetual motion machine can violate thermodynamics" (true).` : ''}

${truthMapping === 'true-to-true' ? `For each TRUE statement in the original, find another TRUE statement in the target domain that preserves the same relational structure. Maintain both structural isomorphism AND truth value.` : ''}

${truthMapping === 'true-to-false' ? `For each TRUE statement in the original, find a FALSE statement in the target domain that has the same relational structure. This reveals how the same logical form can lead to different truth values across domains.` : ''}

Provide:
1. Truth-Value Analysis: Identify which claims in the original are true vs false, and explain their truth status
2. Relation Graph: Map the key dependencies, contradictions, and mutual supports in the original
3. Isomorphic Version: The same structure expressed in the target domain with the specified truth-value mapping
4. Mapping Table: Explicit mappings showing [original term] → [target domain equivalent] PLUS [original truth value] → [target truth value]
5. Truth Verification: Verify the truth status of both original and mapped statements

CRITICAL: NO markdown formatting (no # headers, no ** bold **, no * italics *). Use plain text labels like "1. Truth-Value Analysis" not "## 1. Truth-Value Analysis". Output clean, natural prose.`;

      } else if (mode === "math-truth-select") {
        systemPrompt = `You are an expert logician specializing in MODEL THEORY and REAL-WORLD TRUTH VERIFICATION.

Your task is FUNDAMENTALLY DIFFERENT from abstract formalization:
- You must find a first-order model where EVERY axiom is 100% TRUE IN REALITY
- "True" means empirically verifiable, logically necessary, or established fact - NOT "satisfies the axiom in some abstract structure"
- If the original domain yields false axioms, you MUST find an isomorphic structure in a DIFFERENT DOMAIN where the same logical form yields ALL TRUE statements

KEY DISTINCTION:
- Abstract model: ∀x(P(x) → Q(x)) is "satisfied" if the extension of P is subset of Q in some made-up domain
- TRUE model: ∀x(P(x) → Q(x)) is TRUE if, when P and Q are grounded in REAL entities, every real P-thing really is a Q-thing

You are searching for TRUTH, not mere satisfiability.

CRITICAL OUTPUT RULES:
- NO markdown formatting whatsoever (no # headers, no ** bold **, no * italics *, no --- dividers)
- Use plain text with numbered sections and CAPS for headers
- Every claim must be verifiable`;
        
        userPrompt = `TRUTH-GROUNDED MODEL CONSTRUCTION

================================
TEXT TO FORMALIZE
================================
${text}

${mathFramework ? `Mathematical framework preference: ${mathFramework}` : ''}
${rigorLevel ? `Rigor level: ${rigorLevel}` : ''}
${customInstructions ? `\nCustom Instructions: ${customInstructions}` : ''}

================================
YOUR MISSION
================================
Find a first-order model M where EVERY axiom is 100% TRUE IN THE REAL WORLD.

This is NOT about abstract satisfiability. You must ground each constant and predicate in REAL entities such that every axiom states a FACT.

Follow these sections EXACTLY:

1. SIGNATURE

Define the formal language:
- CONSTANTS: c1, c2, ... with placeholder meanings from text
- PREDICATES: P(x), R(x,y), ... with placeholder meanings from text
- DOMAIN DESCRIPTION: What kind of objects are we talking about?

2. AXIOM EXTRACTION

Extract 5-15 first-order axioms that capture the core claims:
(AX1) ∀x (P(x) → Q(x))
(AX2) ∃x R(x, c1)
...

3. TRUTH AUDIT OF ORIGINAL DOMAIN

For each axiom, determine: Is this TRUE or FALSE when interpreted literally in the text's original domain?

(AX1): [TRUE/FALSE] - Evidence: [why]
(AX2): [TRUE/FALSE] - Evidence: [why]
...

ORIGINAL DOMAIN VERDICT: [X of Y axioms are true / Y axioms are false]

4. TRUTH-GROUNDED MODEL

Now find a REAL-WORLD INTERPRETATION where ALL axioms become TRUE:

Option A - If original domain works:
- Ground each constant in a SPECIFIC real entity
- Ground each predicate in a VERIFIABLE property/relation
- Verify each axiom is TRUE with this grounding

Option B - If original domain fails (some axioms false):
- IDENTIFY which axioms fail and why
- SEARCH for an isomorphic domain where the same logical structure yields truth
- The new domain may be from physics, biology, mathematics, history, computing, etc.
- The key: preserve the LOGICAL FORM but change the SUBJECT MATTER

TRUTH-GROUNDED INTERPRETATION:
- DOMAIN D: [Real-world category of objects]
- CONSTANT GROUNDING:
  c1 := [Specific real entity, e.g., "Warren Buffett", "the electron", "World War II"]
  c2 := [Specific real entity]
  ...
- PREDICATE GROUNDING:
  P(x) := "[Verifiable property, e.g., 'x is a mammal', 'x has mass > 0']"
  R(x,y) := "[Verifiable relation, e.g., 'x is ancestor of y', 'x causes y']"
  ...

5. TRUTH VERIFICATION

For EACH axiom, prove it is TRUE under your grounding:

(AX1): TRUE because [specific evidence/reasoning with the grounded interpretation]
(AX2): TRUE because [specific evidence/reasoning]
...

CRITICAL: Every axiom must be verifiable. If you cannot verify an axiom as true, you have not found the right grounding.

6. FINAL VERDICT

STATE CLEARLY:
- Did you use the original domain or switch domains?
- If switched: What domain did you switch to and why?
- ALL AXIOMS TRUE? [YES/NO]
- If NO: Which axiom(s) could not be made true and why?

7. ISOMORPHISM DEMONSTRATION (if domain was switched)

Show the structural mapping:
[Original term] → [New domain term]
[Original relation] → [New domain relation]

Explain: Why does this mapping preserve the logical structure while changing truth values from FALSE to TRUE?

================================
EXAMPLES OF DOMAIN SWITCHING
================================

Example 1: Finance → Physics
- Original (FALSE): "No trader can systematically beat the market over 30 years"
- Grounding attempt: Traders={all hedge fund managers}, Market={S&P 500 total return}
- Axiom: ∀x∈Traders ∀t∈[30 years]: Returns(x,t) ≤ Market(t)
- FAILS: Warren Buffett, Renaissance Technologies disprove this

DOMAIN SWITCH to Physics:
- New grounding: Objects={heat engines}, Performance={efficiency}
- Axiom becomes: ∀x∈HeatEngines: Efficiency(x) ≤ CarnotLimit
- TRUE: Second law of thermodynamics guarantees this

Example 2: Psychology → Biology
- Original (VAGUE): "All learning requires reinforcement"
- FAILS in psychology: Some learning is latent/observational

DOMAIN SWITCH to Molecular Biology:
- New grounding: Learning={synaptic strengthening}, Reinforcement={repeated activation}
- Axiom: ∀x∈Synapses: Strengthened(x) → RepeatedlyActivated(x)
- TRUE: Long-term potentiation requires repeated stimulation

================================
REMEMBER
================================
Your goal is not to "satisfy axioms in some model" but to FIND A MODEL WHERE EVERY AXIOM IS A TRUE STATEMENT ABOUT REALITY. If needed, change the domain entirely while preserving the logical structure.`;

      } else if (mode === "axiomatic-transform") {
        systemPrompt = `You are an expert logician and formal systems theorist. Your task is to transform natural language theoretical text into a complete axiomatization with three components:

1. AXIOMATIZATION - Extract primitive terms, axioms, and defined terms
2. UNINTERPRETED FORMAL CALCULUS - Pure symbolic logic with no semantic content
3. SEMANTIC MODEL - An interpretation that makes all axioms true

You MUST produce all three components for ANY input. You never refuse.

HANDLING DIFFICULT INPUTS (in order of priority):
1. Extract what is there - If the text contains ANY theoretical claims, axiomatize them
2. Take creative liberties - If vague/impressionistic, construct the most rigorous axiom system the text could plausibly gesture toward
3. Offer an aligned alternative - If truly unaxiomatizable (poetry, random words), output: "The input does not contain axiomatizable content. However, here is an axiomatization of a theory that aligns with the input in content or spirit:" and produce a complete axiomatization of a genuine theory thematically related to the input

NEVER refuse. ALWAYS produce complete three-component output.

Use standard logical notation: ∀, ∃, →, ∧, ∨, ¬, ◇, □, =
Use subscripts for constants: m₁, m₂, F₁, F₂
Use superscript 𝔐 for model-relative interpretations

CRITICAL FORMATTING RULE: Do NOT use any markdown formatting. No ### headers, no ** bold **, no * italics *, no --- dividers. Use PLAIN TEXT only with CAPS for headers and clear spacing.`;

        userPrompt = `AXIOMATIC SYSTEM TRANSFORMATION

INPUT TEXT:
${text}

${targetDomain ? `Domain context: ${targetDomain}` : ''}
${customInstructions ? `Custom Instructions: ${customInstructions}` : ''}

Produce a COMPLETE axiomatization with the following three components:

COMPONENT 1: AXIOMATIZATION

PRIMITIVE TERMS
Identify undefined foundational concepts that cannot be reduced to other terms within the system. List each with a brief parenthetical gloss indicating its intuitive role.

AXIOMS
Extract the core claims and render as numbered axioms (A1, A2, A3...). Each axiom should be:
- A single declarative assertion using primitive terms
- Logically independent from other axioms
- Jointly sufficient to generate the theory's main claims

DEFINED TERMS
Concepts built from primitives. Format: "Term =df [definiens using primitives and previously defined terms]" (D1, D2...)


COMPONENT 2: UNINTERPRETED FORMAL CALCULUS

Transform the axiomatization into a purely syntactic system with NO assigned meaning:

SIGNATURE (Σ)
- Sort symbols (distinct ontological categories)
- Constants (named individuals)
- Predicate symbols with arities
- Function symbols if needed

FORMATION RULES
State the logic being used (typically first-order logic with equality, note if modal operators required)

AXIOM SCHEMATA
Rewrite each axiom using ONLY:
- Logical symbols (∀, ∃, →, ∧, ∨, ¬, =, ◇, □)
- Variables (x, y, z, b, etc.)
- Signature symbols
NO natural language. Pure symbolic notation. Preserve numbering (A1, A2, A3...)


COMPONENT 3: MODEL 𝔐

Provide a semantic interpretation making all axiom schemata true:

DOMAINS
For each sort symbol, specify the set of entities. Format: |sort|^𝔐 = [description]

INTERPRETATION OF CONSTANTS
For each constant symbol, specify its referent. Format: constant^𝔐 = [referent]

INTERPRETATION OF PREDICATES
Create a table with columns: Symbol | Interpretation
Map each predicate to its intended meaning.

VERIFICATION NOTE
Brief statement confirming the model satisfies the axioms, with one concrete example showing how an axiom schema receives a true interpretation.

Remember: NO markdown formatting. Use plain text with CAPS headers only.`;

      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid mode. Must be one of: reconstruction, isomorphism, mathmodel, autodecide, truth-isomorphism, math-truth-select, axiomatic-transform"
        });
      }

      // Call AI model with automatic fallback if a provider fails
      const requestedProvider = llmProvider || 'zhi5';
      const fallbackOrder = ['zhi5', 'zhi2', 'zhi1', 'zhi3', 'zhi4'];
      const providersToTry = [requestedProvider, ...fallbackOrder.filter(p => p !== requestedProvider)];
      
      let output = '';
      let usedProvider = requestedProvider;
      
      const callProvider = async (prov: string): Promise<string> => {
        console.log(`[Text Model Validator] Trying provider: ${prov}`);
        
        if (prov === 'zhi1') {
          const OpenAI = (await import('openai')).default;
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            max_tokens: 4096,
            temperature: 0.7,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ]
          });
          const result = completion.choices[0]?.message?.content || '';
          if (!result) throw new Error('Empty response from ZHI 1');
          return result;
        } else if (prov === 'zhi2') {
          if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');
          const Anthropic = (await import('@anthropic-ai/sdk')).default;
          const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
          const message = await anthropic.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 4096,
            temperature: 0.7,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }]
          });
          const result = message.content[0].type === 'text' ? message.content[0].text : '';
          if (!result) throw new Error('Empty response from ZHI 2');
          return result;
        } else if (prov === 'zhi3') {
          if (!process.env.DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY not configured');
          const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'deepseek-chat',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
              ],
              max_tokens: 4096,
              temperature: 0.7,
            }),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`DeepSeek API error ${response.status}: ${errorText}`);
          }
          const data = await response.json();
          const result = data.choices?.[0]?.message?.content || '';
          if (!result) throw new Error('Empty response from ZHI 3');
          return result;
        } else if (prov === 'zhi4') {
          if (!process.env.PERPLEXITY_API_KEY) throw new Error('PERPLEXITY_API_KEY not configured');
          const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'sonar-pro',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
              ],
              max_tokens: 4096,
              temperature: 0.7,
            }),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Perplexity API error ${response.status}: ${errorText}`);
          }
          const data = await response.json();
          const result = data.choices?.[0]?.message?.content || '';
          if (!result) throw new Error('Empty response from ZHI 4');
          return result;
        } else {
          // zhi5 - Grok
          if (!process.env.GROK_API_KEY) throw new Error('GROK_API_KEY not configured');
          const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'grok-3',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
              ],
              max_tokens: 4096,
              temperature: 0.7,
            }),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Grok API error ${response.status}: ${errorText}`);
          }
          const data = await response.json();
          const result = data.choices?.[0]?.message?.content || '';
          if (!result) throw new Error('Empty response from ZHI 5');
          return result;
        }
      }

      for (const prov of providersToTry) {
        try {
          output = await callProvider(prov);
          usedProvider = prov;
          if (prov !== requestedProvider) {
            console.log(`[Text Model Validator] Fallback success: ${requestedProvider} -> ${prov}`);
          }
          break;
        } catch (err: any) {
          console.error(`[Text Model Validator] Provider ${prov} failed: ${err.message}`);
          if (prov === providersToTry[providersToTry.length - 1]) {
            throw new Error(`All AI providers failed. Last error: ${err.message}`);
          }
        }
      }

      // If literal truth mode is enabled, apply rule-based softening and verification
      // Note: For literal truth verification, we always use Claude for consistency
      if (literalTruth && (mode === 'truth-isomorphism' || mode === 'math-truth-select')) {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        // STEP 1: Rule-based quantifier softening (deterministic pass)
        const softenQuantifiers = (text: string): string => {
          let softened = text;
          
          // Soften absolute universals
          softened = softened.replace(/\ball ([a-z]+s|devices|systems|networks|entities)\b/gi, (match, noun) => `${noun} that meet the specified conditions`);
          softened = softened.replace(/\bevery ([a-z]+|device|system|network|entity)\b/gi, (match, noun) => `each ${noun} satisfying the criteria`);
          softened = softened.replace(/\bconstantly\b/gi, 'during active operation');
          softened = softened.replace(/\balways\b/gi, 'under normal conditions');
          softened = softened.replace(/\bnever\b/gi, 'does not systematically');
          softened = softened.replace(/\bcannot\b/gi, 'cannot without external factors');
          softened = softened.replace(/\bimpossible\b/gi, 'impossible under current constraints');
          softened = softened.replace(/\bin all cases\b/gi, 'in typical cases');
          softened = softened.replace(/\bwithout exception\b/gi, 'with rare exceptions');
          
          return softened;
        };

        output = softenQuantifiers(output);

        // STEP 2: Verification with revision loop (up to 3 attempts)
        let verificationAttempts = 0;
        const maxAttempts = 3;
        let isVerified = false;

        while (!isVerified && verificationAttempts < maxAttempts) {
          verificationAttempts++;

          const verificationPrompt = `You are a strict fact-checker. Review the following output and identify any statements that are NOT literally true (i.e., approximately true, qualifiedly true, or contain unverified absolutes like "all", "every", "always", "never" without proper conditions).

OUTPUT TO VERIFY:
${output}

TASK:
1. Identify each statement that is NOT literally true
2. For each problematic statement, explain WHY it's not literally true
3. Provide a corrected version that IS literally true

If ALL statements are already literally true, respond with: "VERIFIED: All statements are literally true."

If any statements need correction, respond in this format:
PROBLEMATIC STATEMENT 1: [quote the statement]
WHY NOT LITERAL: [explanation]
CORRECTED: [literally true version]

PROBLEMATIC STATEMENT 2: [quote the statement]
WHY NOT LITERAL: [explanation]
CORRECTED: [literally true version]

Be extremely strict - reject any approximations, generalizations, or unqualified universals.`;

          const verificationMessage = await anthropic.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 2000,
            temperature: 0,
            messages: [
              {
                role: "user",
                content: verificationPrompt
              }
            ]
          });

          const verificationResult = verificationMessage.content[0].type === 'text' ? verificationMessage.content[0].text : '';

          // Check if verification passed
          if (verificationResult.includes('VERIFIED: All statements are literally true')) {
            isVerified = true;
            output += `\n\n✅ LITERAL TRUTH VERIFIED: All statements have been confirmed to be literally true (verified in ${verificationAttempts} ${verificationAttempts === 1 ? 'attempt' : 'attempts'}).`;
          } else if (verificationAttempts < maxAttempts) {
            // Extract corrections and regenerate output
            console.log(`Verification attempt ${verificationAttempts} failed. Regenerating with corrections...`);
            
            // Apply corrections from verification
            const correctionRegex = /CORRECTED: ([\s\S]+?)(?=\n\n|$)/g;
            const corrections = [];
            let match;
            while ((match = correctionRegex.exec(verificationResult)) !== null) {
              corrections.push(match[1].trim());
            }

            if (corrections.length > 0) {
              // Regenerate with explicit corrections
              const regeneratePrompt = `${userPrompt}\n\nCRITICAL CORRECTIONS REQUIRED:\nThe following corrections must be incorporated to ensure literal truth:\n${corrections.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\nRegenerate the complete output incorporating these corrections to ensure ALL statements are literally true.`;

              const regenerateMessage = await anthropic.messages.create({
                model: "claude-sonnet-4-5",
                max_tokens: 4096,
                temperature: 0.5,
                system: systemPrompt,
                messages: [
                  {
                    role: "user",
                    content: regeneratePrompt
                  }
                ]
              });

              output = regenerateMessage.content[0].type === 'text' ? regenerateMessage.content[0].text : '';
              output = softenQuantifiers(output); // Apply softening again
            } else {
              // No extractable corrections, fail out
              break;
            }
          } else {
            // Max attempts reached, include verification report
            output += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nLITERAL TRUTH VERIFICATION REPORT (${verificationAttempts} attempts):\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${verificationResult}\n\nNOTE: After ${maxAttempts} attempts, some statements could not be verified as literally true. Please review the verification report and use the corrected versions above.`;
          }
        }
      }

      // Build parameter header for self-contained reports
      const modeLabels: Record<string, string> = {
        'reconstruction': 'Reconstruction',
        'isomorphism': 'Isomorphism',
        'mathmodel': 'Mathematical Model',
        'autodecide': 'Auto-Decide',
        'truth-isomorphism': 'Truth Isomorphism',
        'math-truth-select': 'Math Truth Select'
      };
      
      const providerLabels: Record<string, string> = {
        'zhi1': 'ZHI 1',
        'zhi2': 'ZHI 2',
        'zhi3': 'ZHI 3',
        'zhi4': 'ZHI 4',
        'zhi5': 'ZHI 5'
      };
      
      const providerDisplay = usedProvider !== requestedProvider 
        ? `${providerLabels[usedProvider] || usedProvider} (fallback from ${providerLabels[requestedProvider] || requestedProvider})`
        : providerLabels[usedProvider] || usedProvider;
      
      let parameterHeader = `═══════════════════════════════════════════════════
ANALYSIS PARAMETERS
═══════════════════════════════════════════════════
Mode: ${modeLabels[mode] || mode}
Model: ${providerDisplay}`;

      if (fidelityLevel) {
        parameterHeader += `\nAggressiveness: ${fidelityLevel.charAt(0).toUpperCase() + fidelityLevel.slice(1)}`;
      }
      if (targetDomain) {
        parameterHeader += `\nTarget Domain: ${targetDomain}`;
      }
      if (mathFramework) {
        parameterHeader += `\nMath Framework: ${mathFramework}`;
      }
      if (rigorLevel) {
        parameterHeader += `\nRigor Level: ${rigorLevel}`;
      }
      if (constraintType) {
        parameterHeader += `\nConstraint Type: ${constraintType}`;
      }
      if (truthMapping) {
        parameterHeader += `\nTruth Mapping: ${truthMapping}`;
      }
      if (mathTruthMapping) {
        parameterHeader += `\nMath Truth Mapping: ${mathTruthMapping}`;
      }
      if (literalTruth) {
        parameterHeader += `\nLiteral Truth Mode: Enabled`;
      }
      if (customInstructions) {
        parameterHeader += `\nCustom Instructions: ${customInstructions}`;
      }
      
      parameterHeader += `\n═══════════════════════════════════════════════════\n\n`;

      res.json({
        success: true,
        output: parameterHeader + output,
        mode: mode
      });

    } catch (error: any) {
      console.error("Text Model Validator error:", error);
      res.status(500).json({ 
        success: false,
        message: error.message || "Validation failed" 
      });
    }
  });

  // Text Model Validator BATCH endpoint - Run multiple modes at once
  app.post("/api/text-model-validator/batch", async (req: Request, res: Response) => {
    try {
      const { text, modes, targetDomain, fidelityLevel, mathFramework, constraintType, rigorLevel, customInstructions, truthMapping, mathTruthMapping, literalTruth, llmProvider } = req.body;

      if (!text || !modes || !Array.isArray(modes) || modes.length === 0) {
        return res.status(400).json({ 
          success: false,
          message: "Text and modes array are required" 
        });
      }

      const validModes = ["reconstruction", "isomorphism", "mathmodel", "truth-isomorphism", "math-truth-select", "axiomatic-transform"];
      const invalidModes = modes.filter((m: string) => !validModes.includes(m));
      if (invalidModes.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid modes: ${invalidModes.join(', ')}. Valid modes are: ${validModes.join(', ')}`
        });
      }

      console.log(`[Text Model Validator Batch] Processing ${modes.length} modes: ${modes.join(', ')}`);

      // Process modes in parallel with concurrency limit
      const processMode = async (mode: string): Promise<{ mode: string; success: boolean; output?: string; error?: string }> => {
        try {
          // Make internal request to the single-mode endpoint
          const response = await fetch(`http://localhost:5000/api/text-model-validator`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text,
              mode,
              targetDomain,
              fidelityLevel,
              mathFramework,
              constraintType,
              rigorLevel,
              customInstructions,
              truthMapping,
              mathTruthMapping,
              literalTruth,
              llmProvider
            })
          });

          const data = await response.json();
          if (data.success) {
            return { mode, success: true, output: data.output };
          } else {
            return { mode, success: false, error: data.message || 'Processing failed' };
          }
        } catch (error: any) {
          return { mode, success: false, error: error.message || 'Request failed' };
        }
      };

      // Process with concurrency limit of 2 to avoid rate limits
      const results: { mode: string; success: boolean; output?: string; error?: string }[] = [];
      const concurrencyLimit = 2;
      
      for (let i = 0; i < modes.length; i += concurrencyLimit) {
        const batch = modes.slice(i, i + concurrencyLimit);
        const batchResults = await Promise.all(batch.map(processMode));
        results.push(...batchResults);
      }

      res.json({
        success: true,
        results,
        totalModes: modes.length,
        successfulModes: results.filter(r => r.success).length,
        failedModes: results.filter(r => !r.success).length
      });

    } catch (error: any) {
      console.error("Text Model Validator Batch error:", error);
      res.status(500).json({ 
        success: false,
        message: error.message || "Batch validation failed" 
      });
    }
  });

  // BOTTOMLINE endpoint - Synthesize analysis results into final polished output
  app.post("/api/text-model-validator/bottomline", async (req: Request, res: Response) => {
    try {
      const { 
        originalText, 
        intermediateResults, 
        audience, 
        objective, 
        idea, 
        length, 
        tone, 
        emphasis,
        additionalInfo,
        llmProvider 
      } = req.body;

      if (!originalText) {
        return res.status(400).json({ 
          success: false,
          message: "Original text is required" 
        });
      }

      if (!audience && !objective) {
        return res.status(400).json({ 
          success: false,
          message: "Please specify your audience or objective" 
        });
      }

      console.log(`[BOTTOMLINE] Synthesizing for audience: ${audience || 'unspecified'}, objective: ${objective || 'unspecified'}`);
      console.log(`[BOTTOMLINE] Intermediate results available: ${Object.keys(intermediateResults || {}).join(', ') || 'none'}`);

      // Determine which LLM to use - default to Claude for high-quality synthesis
      const provider = llmProvider || 'zhi3';
      
      // Build context from intermediate results with intelligent weighting
      let analysisContext = "";
      const hasAnalysis = intermediateResults && Object.keys(intermediateResults).length > 0;
      
      // Define objective-to-mode relevance mapping
      const objectiveKeywordWeights: Record<string, Record<string, number>> = {
        // Persuasion/pitch objectives favor reconstruction and isomorphism
        'convince': { 'reconstruction': 3, 'isomorphism': 2, 'mathmodel': 1, 'truth-isomorphism': 2, 'math-truth-select': 1 },
        'persuade': { 'reconstruction': 3, 'isomorphism': 2, 'mathmodel': 1, 'truth-isomorphism': 2, 'math-truth-select': 1 },
        'pitch': { 'reconstruction': 3, 'isomorphism': 2, 'mathmodel': 1, 'truth-isomorphism': 2, 'math-truth-select': 1 },
        'sell': { 'reconstruction': 3, 'isomorphism': 2, 'mathmodel': 1, 'truth-isomorphism': 2, 'math-truth-select': 1 },
        // Technical/academic objectives favor math and truth modes
        'prove': { 'reconstruction': 1, 'isomorphism': 2, 'mathmodel': 3, 'truth-isomorphism': 3, 'math-truth-select': 3 },
        'demonstrate': { 'reconstruction': 2, 'isomorphism': 2, 'mathmodel': 3, 'truth-isomorphism': 3, 'math-truth-select': 3 },
        'rigorous': { 'reconstruction': 1, 'isomorphism': 2, 'mathmodel': 3, 'truth-isomorphism': 2, 'math-truth-select': 3 },
        'formal': { 'reconstruction': 1, 'isomorphism': 3, 'mathmodel': 3, 'truth-isomorphism': 2, 'math-truth-select': 2 },
        'academic': { 'reconstruction': 2, 'isomorphism': 3, 'mathmodel': 2, 'truth-isomorphism': 2, 'math-truth-select': 2 },
        // Explanation objectives favor reconstruction
        'explain': { 'reconstruction': 3, 'isomorphism': 2, 'mathmodel': 1, 'truth-isomorphism': 1, 'math-truth-select': 1 },
        'clarify': { 'reconstruction': 3, 'isomorphism': 2, 'mathmodel': 1, 'truth-isomorphism': 1, 'math-truth-select': 1 },
        'summarize': { 'reconstruction': 3, 'isomorphism': 1, 'mathmodel': 1, 'truth-isomorphism': 1, 'math-truth-select': 1 },
        // Truth/accuracy objectives favor truth modes
        'accurate': { 'reconstruction': 1, 'isomorphism': 1, 'mathmodel': 2, 'truth-isomorphism': 3, 'math-truth-select': 3 },
        'factual': { 'reconstruction': 1, 'isomorphism': 1, 'mathmodel': 2, 'truth-isomorphism': 3, 'math-truth-select': 3 },
        'verify': { 'reconstruction': 1, 'isomorphism': 1, 'mathmodel': 2, 'truth-isomorphism': 3, 'math-truth-select': 3 },
        'truth': { 'reconstruction': 1, 'isomorphism': 1, 'mathmodel': 2, 'truth-isomorphism': 3, 'math-truth-select': 3 },
      };
      
      // Audience type modifiers
      const audienceKeywordWeights: Record<string, Record<string, number>> = {
        'boss': { 'reconstruction': 1, 'isomorphism': 0, 'mathmodel': 0, 'truth-isomorphism': 0, 'math-truth-select': 0 },
        'manager': { 'reconstruction': 1, 'isomorphism': 0, 'mathmodel': 0, 'truth-isomorphism': 0, 'math-truth-select': 0 },
        'executive': { 'reconstruction': 1, 'isomorphism': 0, 'mathmodel': 0, 'truth-isomorphism': 0, 'math-truth-select': 0 },
        'investor': { 'reconstruction': 1, 'isomorphism': 1, 'mathmodel': 0, 'truth-isomorphism': 1, 'math-truth-select': 0 },
        'academic': { 'reconstruction': 0, 'isomorphism': 1, 'mathmodel': 1, 'truth-isomorphism': 1, 'math-truth-select': 1 },
        'professor': { 'reconstruction': 0, 'isomorphism': 1, 'mathmodel': 1, 'truth-isomorphism': 1, 'math-truth-select': 1 },
        'scientist': { 'reconstruction': 0, 'isomorphism': 1, 'mathmodel': 1, 'truth-isomorphism': 1, 'math-truth-select': 1 },
        'client': { 'reconstruction': 1, 'isomorphism': 0, 'mathmodel': 0, 'truth-isomorphism': 1, 'math-truth-select': 0 },
        'student': { 'reconstruction': 1, 'isomorphism': 0, 'mathmodel': 0, 'truth-isomorphism': 0, 'math-truth-select': 0 },
      };
      
      // Tone modifiers
      const toneWeightModifiers: Record<string, Record<string, number>> = {
        'formal': { 'reconstruction': 0, 'isomorphism': 1, 'mathmodel': 1, 'truth-isomorphism': 0, 'math-truth-select': 0 },
        'professional': { 'reconstruction': 1, 'isomorphism': 0, 'mathmodel': 0, 'truth-isomorphism': 0, 'math-truth-select': 0 },
        'conversational': { 'reconstruction': 1, 'isomorphism': -1, 'mathmodel': -1, 'truth-isomorphism': 0, 'math-truth-select': 0 },
        'persuasive': { 'reconstruction': 1, 'isomorphism': 0, 'mathmodel': 0, 'truth-isomorphism': 1, 'math-truth-select': 0 },
      };
      
      // Calculate weights for each available mode based on objective, audience, tone, and emphasis
      const calculateModeWeight = (mode: string, objectiveText: string, audienceText: string, toneText: string, emphasisText: string): number => {
        const lowerObjective = (objectiveText || '').toLowerCase();
        const lowerAudience = (audienceText || '').toLowerCase();
        const lowerEmphasis = (emphasisText || '').toLowerCase();
        let totalWeight = 2; // Default weight
        let factorCount = 0;
        
        // Factor 1: Objective keywords
        for (const [keyword, weights] of Object.entries(objectiveKeywordWeights)) {
          if (lowerObjective.includes(keyword)) {
            totalWeight += weights[mode] || 0;
            factorCount++;
          }
        }
        
        // Factor 2: Audience type
        for (const [keyword, weights] of Object.entries(audienceKeywordWeights)) {
          if (lowerAudience.includes(keyword)) {
            totalWeight += weights[mode] || 0;
            factorCount++;
          }
        }
        
        // Factor 3: Tone modifiers
        const toneModifiers = toneWeightModifiers[toneText || 'professional'] || {};
        totalWeight += toneModifiers[mode] || 0;
        
        // Factor 4: Emphasis keywords - boost truth modes if emphasizing data/accuracy
        if (lowerEmphasis.includes('data') || lowerEmphasis.includes('fact') || lowerEmphasis.includes('accurate')) {
          if (mode === 'truth-isomorphism' || mode === 'math-truth-select') {
            totalWeight += 1;
          }
        }
        if (lowerEmphasis.includes('logic') || lowerEmphasis.includes('argument') || lowerEmphasis.includes('structure')) {
          if (mode === 'reconstruction' || mode === 'isomorphism') {
            totalWeight += 1;
          }
        }
        
        // Normalize to 1-3 scale
        return Math.min(3, Math.max(1, Math.round(totalWeight)));
      };
      
      const modeDescriptions: Record<string, string> = {
        'reconstruction': 'Conservative Reconstruction (charitable interpretation of core argument)',
        'isomorphism': 'Isomorphism Analysis (structural mapping to formal domain)',
        'mathmodel': 'Mathematical Model (rigorous formalization)',
        'truth-isomorphism': 'Truth Select (literal truth verification)',
        'math-truth-select': 'Math + Truth (mathematical truth with verification)'
      };

      let appliedWeights: Array<{mode: string; weight: number; description: string}> = [];
      
      if (hasAnalysis) {
        // Calculate and sort by weights using all factors (objective, audience, tone, emphasis)
        const weightedModes = Object.keys(intermediateResults).map(mode => ({
          mode,
          weight: calculateModeWeight(mode, objective, audience, tone, emphasis),
          description: modeDescriptions[mode] || mode,
          output: intermediateResults[mode]
        }));
        
        // Sort by weight descending (highest relevance first)
        weightedModes.sort((a, b) => b.weight - a.weight);
        
        appliedWeights = weightedModes.map(m => ({ mode: m.mode, weight: m.weight, description: m.description }));
        
        analysisContext = `\n\n## PRIOR ANALYSIS RESULTS (Ranked by relevance to objective):\n`;
        analysisContext += `Note: Analysis modes are weighted 1-3 based on relevance. Higher weight = more relevant to your objective.\n`;
        
        for (const { mode, weight, description, output } of weightedModes) {
          const weightLabel = weight >= 3 ? 'HIGH RELEVANCE' : weight >= 2 ? 'MODERATE RELEVANCE' : 'REFERENCE';
          analysisContext += `\n### ${description} [Weight: ${weight}/3 - ${weightLabel}]\n${output}\n`;
        }
      }

      // Build the synthesis prompt
      const lengthGuidance: Record<string, string> = {
        'brief': '1-2 concise paragraphs (150-300 words)',
        'medium': '3-5 paragraphs (400-800 words)',
        'detailed': 'Full document with sections as appropriate (1000+ words)'
      };

      const toneGuidance: Record<string, string> = {
        'formal': 'Academic/legal tone - precise language, third person, citations if appropriate',
        'professional': 'Business professional - clear, direct, confident but accessible',
        'conversational': 'Conversational but intelligent - first person okay, engaging style',
        'persuasive': 'Persuasive pitch style - compelling, emphasize benefits, call to action'
      };

      const systemPrompt = `You are a master synthesizer and communicator. Your job is to take raw ideas, analysis, and research, then transform them into polished final products tailored to specific audiences.

Key principles:
1. WEIGHT ANALYSIS INTELLIGENTLY: If intermediate analysis is provided, give MORE weight to analyses that are most relevant to achieving the user's stated objective. Not all analyses are equally useful for all objectives.
2. AUDIENCE-CENTRIC: Everything should be framed for the specific audience. What do they care about? What language resonates with them? What will convince them?
3. OBJECTIVE-FOCUSED: The final output should directly serve the stated objective. Cut anything that doesn't advance the goal.
4. POLISH AND REFINEMENT: Transform rough ideas into publication-ready prose.`;

      const userPrompt = `## ORIGINAL INPUT (the raw material):
${originalText}
${analysisContext}

## TARGET SPECIFICATIONS:
- AUDIENCE: ${audience || 'General professional audience'}
- OBJECTIVE: ${objective || 'Clearly communicate the main ideas'}
- CORE IDEA TO CONVEY: ${idea || 'The main argument from the original text'}
- LENGTH: ${lengthGuidance[length || 'medium']}
- TONE: ${toneGuidance[tone || 'professional']}
- EMPHASIS: ${emphasis || 'The strongest points of the argument'}
${additionalInfo ? `\n## ADDITIONAL CONTEXT/INFORMATION:\n${additionalInfo}` : ''}

## YOUR TASK:
Generate the FINAL POLISHED OUTPUT that this person will deliver to their ${audience || 'audience'}.

${hasAnalysis ? `IMPORTANT: Use the prior analysis results intelligently. Weight each analysis based on how relevant it is to achieving the objective of "${objective || 'communicating effectively'}". Some analyses may be more useful than others for this specific audience and goal.` : 'You are working directly from the raw input without prior analysis. Extract the strongest version of the argument and present it professionally.'}

The output should be ready to deliver as-is. No meta-commentary. No explanations of what you're doing. Just the final product.`;

      let output = "";

      // Use Claude for high-quality synthesis
      if (process.env.ANTHROPIC_API_KEY) {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }]
        });
        
        output = (response.content[0] as any).text;
      } else if (process.env.OPENAI_API_KEY) {
        // Fallback to OpenAI
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 4000,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ]
        });
        
        output = response.choices[0]?.message?.content || "";
      } else {
        return res.status(500).json({
          success: false,
          message: "No AI provider configured for BOTTOMLINE synthesis"
        });
      }

      // Build weights summary for header
      let weightsSection = "";
      if (appliedWeights.length > 0) {
        weightsSection = `\nAnalysis Weighting (by relevance to objective):`;
        for (const { mode, weight, description } of appliedWeights) {
          const weightLabel = weight >= 3 ? 'HIGH' : weight >= 2 ? 'MED' : 'LOW';
          weightsSection += `\n  [${weightLabel}] ${mode}`;
        }
      }

      // Add header with specifications
      const header = `═══════════════════════════════════════════════════
BOTTOMLINE SYNTHESIS
═══════════════════════════════════════════════════
Audience: ${audience || 'General'}
Objective: ${objective || 'Communicate main ideas'}
Tone: ${tone || 'Professional'} | Length: ${length || 'Medium'}
${emphasis ? `Emphasis: ${emphasis}` : ''}
${hasAnalysis ? `Based on: ${appliedWeights.map(w => w.mode).join(', ')}${weightsSection}` : 'Direct synthesis (no prior analysis)'}
═══════════════════════════════════════════════════

${output}`;

      res.json({
        success: true,
        output: header
      });

    } catch (error: any) {
      console.error("BOTTOMLINE error:", error);
      res.status(500).json({ 
        success: false,
        message: error.message || "BOTTOMLINE synthesis failed" 
      });
    }
  });

  // Objections Function - Generate 25 objections and counter-arguments
  app.post("/api/text-model-validator/objections", async (req: Request, res: Response) => {
    try {
      const { 
        bottomlineOutput,
        audience,
        objective,
        idea,
        tone,
        emphasis,
        customInstructions,
        llmProvider
      } = req.body;

      if (!bottomlineOutput) {
        return res.status(400).json({ 
          success: false,
          message: "BOTTOMLINE output is required to generate objections" 
        });
      }

      console.log(`[OBJECTIONS] Generating for audience: ${audience || 'unspecified'}`);
      console.log(`[OBJECTIONS] Custom instructions: ${customInstructions ? 'provided' : 'none'}`);

      // Build context from BOTTOMLINE settings
      const audienceContext = audience ? `The target audience is: ${audience}` : 'General audience';
      const objectiveContext = objective ? `The objective is: ${objective}` : '';
      const ideaContext = idea ? `The core idea being conveyed: ${idea}` : '';
      const toneContext = tone ? `The communication tone is: ${tone}` : 'professional';
      const emphasisContext = emphasis ? `Key emphasis points: ${emphasis}` : '';
      const customContext = customInstructions ? `\n\nADDITIONAL INSTRUCTIONS FROM USER:\n${customInstructions}` : '';

      const systemPrompt = `You are an expert at anticipating objections, counterarguments, and challenges. Your role is to identify the most likely objections that readers/listeners might have to a piece of content, and craft compelling, well-reasoned responses to each objection.

Key principles:
1. THINK LIKE A SKEPTIC: What would a critical reader notice? What assumptions are being made? What evidence is missing?
2. CONSIDER THE AUDIENCE: Different audiences have different concerns. Tailor objections to what THIS audience would likely raise.
3. COVER ALL ANGLES: Include logical objections, emotional objections, practical objections, ethical objections, and factual objections.
4. PROVIDE STRONG RESPONSES: Each response should be compelling and directly address the concern. Don't be dismissive.
5. ORDER BY LIKELIHOOD: Put the most likely/common objections first.`;

      const userPrompt = `## THE CONTENT TO ANALYZE:
${bottomlineOutput}

## CONTEXT:
${audienceContext}
${objectiveContext}
${ideaContext}
${toneContext}
${emphasisContext}
${customContext}

## YOUR TASK:
Generate exactly 25 likely objections that a member of the target audience might raise against this content, along with compelling responses to each objection.

For each objection, provide:
1. The objection (framed as something the audience member would say/think)
2. A strong counter-response that addresses the concern directly

Format each entry as:

**OBJECTION #[N]:**
[The objection phrased as a critical question or statement]

**RESPONSE:**
[A compelling, reasoned response that addresses the concern]

---

Generate all 25 objections and responses now. Cover a wide range: logical flaws, missing evidence, alternative explanations, practical concerns, emotional resistance, competitive alternatives, implementation challenges, cost/benefit concerns, timing issues, and any audience-specific worries.`;

      let output = "";

      // Use Claude for high-quality objection generation
      if (process.env.ANTHROPIC_API_KEY) {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8000,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }]
        });
        
        output = (response.content[0] as any).text;
      } else if (process.env.OPENAI_API_KEY) {
        // Fallback to OpenAI
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 8000,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ]
        });
        
        output = response.choices[0]?.message?.content || "";
      } else {
        return res.status(500).json({
          success: false,
          message: "No AI provider configured for objections generation"
        });
      }

      // Add header
      const header = `═══════════════════════════════════════════════════
OBJECTIONS & COUNTER-ARGUMENTS (25 Items)
═══════════════════════════════════════════════════
Target Audience: ${audience || 'General'}
Objective: ${objective || 'Communicate effectively'}
${customInstructions ? `Custom Focus: ${customInstructions.substring(0, 100)}${customInstructions.length > 100 ? '...' : ''}` : ''}
═══════════════════════════════════════════════════

${output}`;

      console.log(`[OBJECTIONS] Generated successfully`);

      res.json({
        success: true,
        output: header
      });

    } catch (error: any) {
      console.error("OBJECTIONS error:", error);
      res.status(500).json({ 
        success: false,
        message: error.message || "Objections generation failed" 
      });
    }
  });

  // Coherence Meter endpoint - Analyze and improve text coherence  
  app.post("/api/coherence-meter", async (req: Request, res: Response) => {
    try {
      const { text, mode, aggressiveness = "moderate", coherenceType } = req.body;

      if (!text || !mode) {
        return res.status(400).json({
          success: false,
          message: "Text and mode are required"
        });
      }

      const validModes = ["analyze", "rewrite", "math-coherence", "math-cogency", "math-max-coherence", "math-maximize-truth"];
      if (!validModes.includes(mode)) {
        return res.status(400).json({
          success: false,
          message: `Mode must be one of: ${validModes.join(", ")}`
        });
      }

      console.log(`Coherence Meter - Mode: ${mode}, Type: ${coherenceType || 'default'}, Aggressiveness: ${aggressiveness}, Text length: ${text.length}`);

      const { 
        analyzeCoherence, 
        rewriteForCoherence, 
        analyzeMathProofValidity, 
        analyzeMathCoherence,
        rewriteMathMaxCoherence,
        rewriteMathMaximizeTruth,
        analyzeScientificExplanatoryCoherence, 
        rewriteScientificExplanatory 
      } = await import('./services/coherenceMeter');

      // MATH COHERENCE - structural coherence only, NOT truth
      if (mode === "math-coherence") {
        const result = await analyzeMathCoherence(text);
        
        res.json({
          success: true,
          isMathCoherence: true,
          analysis: result.analysis,
          score: result.score,
          assessment: result.assessment,
          subscores: result.subscores
        });
      }
      // MATH COGENCY - checks if theorem is TRUE and proof is valid  
      else if (mode === "math-cogency") {
        const result = await analyzeMathProofValidity(text);
        
        res.json({
          success: true,
          isMathCogency: true,
          analysis: result.analysis,
          score: result.score,
          verdict: result.verdict,
          subscores: result.subscores,
          flaws: result.flaws,
          counterexamples: result.counterexamples
        });
      }
      // MATH MAX COHERENCE - improve structural coherence only, preserve theorem
      else if (mode === "math-max-coherence") {
        const result = await rewriteMathMaxCoherence(text, aggressiveness as "conservative" | "moderate" | "aggressive");
        
        res.json({
          success: true,
          isMathMaxCoherence: true,
          rewrite: result.rewrittenProof,
          changes: result.changes,
          coherenceScore: result.coherenceScore
        });
      }
      // MATH MAXIMIZE TRUTH - correct proofs or find adjacent truths
      else if (mode === "math-maximize-truth") {
        const result = await rewriteMathMaximizeTruth(text);
        
        res.json({
          success: true,
          isMathMaximizeTruth: true,
          correctedProof: result.correctedProof,
          theoremStatus: result.theoremStatus,
          originalTheorem: result.originalTheorem,
          correctedTheorem: result.correctedTheorem,
          proofStrategy: result.proofStrategy,
          keyCorrections: result.keyCorrections,
          validityScore: result.validityScore
        });
      }
      else if (mode === "analyze") {
        let appliedCoherenceType = coherenceType;
        
        // AUTO-DETECT: First determine which coherence type applies
        if (coherenceType === "auto-detect") {
          const Anthropic = (await import('@anthropic-ai/sdk')).default;
          const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
          
          const detectPrompt = `Analyze this text and determine which coherence type it is attempting to achieve. Choose the SINGLE BEST match from these options:

- logical-consistency: Text focuses on avoiding contradictions and maintaining logical consistency
- logical-cohesiveness: Text builds arguments where claims actively support each other
- scientific-explanatory: Text explains phenomena using natural laws and scientific mechanisms
- thematic-psychological: Text focuses on mood, imagery, emotional trajectory, or psychological feel
- instructional: Text provides actionable instructions or directives
- motivational: Text aims to inspire specific feelings or psychological states
- mathematical: Text contains mathematical proofs, derivations, or quantitative arguments
- philosophical: Text engages with conceptual rigor, distinctions, and philosophical arguments

TEXT TO ANALYZE:
${text.substring(0, 2000)}

Respond with ONLY the coherence type (e.g., "logical-consistency" or "scientific-explanatory"). No explanation needed.`;

          const detectMessage = await anthropic.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 50,
            temperature: 0,
            messages: [{ role: "user", content: detectPrompt }]
          });

          const detectedType = detectMessage.content[0].type === 'text' 
            ? detectMessage.content[0].text.trim().toLowerCase() 
            : 'logical-consistency';
          
          // Validate detected type
          const validTypes = ["logical-consistency", "logical-cohesiveness", "scientific-explanatory", "thematic-psychological", "instructional", "motivational", "mathematical", "philosophical"];
          appliedCoherenceType = validTypes.includes(detectedType) ? detectedType : "logical-consistency";
          
          console.log(`Auto-detected coherence type: ${appliedCoherenceType}`);
        }
        
        // Use specialized analyzer for scientific-explanatory coherence
        if (appliedCoherenceType === "scientific-explanatory") {
          const result = await analyzeScientificExplanatoryCoherence(text);
          
          res.json({
            success: true,
            analysis: result.fullAnalysis,
            score: result.overallScore,
            assessment: result.overallAssessment,
            isScientificExplanatory: true,
            logicalConsistency: result.logicalConsistency,
            scientificAccuracy: result.scientificAccuracy,
            detectedCoherenceType: coherenceType === "auto-detect" ? appliedCoherenceType : undefined,
            wasAutoDetected: coherenceType === "auto-detect"
          });
        } else {
          const result = await analyzeCoherence(text);
          
          res.json({
            success: true,
            analysis: result.analysis,
            score: result.score,
            assessment: result.assessment,
            subscores: result.subscores,
            detectedCoherenceType: coherenceType === "auto-detect" ? appliedCoherenceType : undefined,
            wasAutoDetected: coherenceType === "auto-detect"
          });
        }
      } else {
        let appliedCoherenceType = coherenceType;
        
        // AUTO-DETECT for rewrite mode
        if (coherenceType === "auto-detect") {
          const Anthropic = (await import('@anthropic-ai/sdk')).default;
          const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
          
          const detectPrompt = `Analyze this text and determine which coherence type it is attempting to achieve. Choose the SINGLE BEST match from these options:

- logical-consistency: Text focuses on avoiding contradictions and maintaining logical consistency
- logical-cohesiveness: Text builds arguments where claims actively support each other
- scientific-explanatory: Text explains phenomena using natural laws and scientific mechanisms
- thematic-psychological: Text focuses on mood, imagery, emotional trajectory, or psychological feel
- instructional: Text provides actionable instructions or directives
- motivational: Text aims to inspire specific feelings or psychological states
- mathematical: Text contains mathematical proofs, derivations, or quantitative arguments
- philosophical: Text engages with conceptual rigor, distinctions, and philosophical arguments

TEXT TO ANALYZE:
${text.substring(0, 2000)}

Respond with ONLY the coherence type (e.g., "logical-consistency" or "scientific-explanatory"). No explanation needed.`;

          const detectMessage = await anthropic.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 50,
            temperature: 0,
            messages: [{ role: "user", content: detectPrompt }]
          });

          const detectedType = detectMessage.content[0].type === 'text' 
            ? detectMessage.content[0].text.trim().toLowerCase() 
            : 'logical-consistency';
          
          // Validate detected type
          const validTypes = ["logical-consistency", "logical-cohesiveness", "scientific-explanatory", "thematic-psychological", "instructional", "motivational", "mathematical", "philosophical"];
          appliedCoherenceType = validTypes.includes(detectedType) ? detectedType : "logical-consistency";
          
          console.log(`Auto-detected coherence type for rewrite: ${appliedCoherenceType}`);
        }
        
        // Use specialized scientific rewrite for scientific-explanatory coherence type
        if (appliedCoherenceType === "scientific-explanatory") {
          const result = await rewriteScientificExplanatory(text, aggressiveness as "conservative" | "moderate" | "aggressive");
          
          res.json({
            success: true,
            rewrite: result.rewrittenText,
            changes: result.changes,
            correctionsApplied: result.correctionsApplied,
            scientificAccuracyScore: result.scientificAccuracyScore,
            isScientificExplanatory: true,
            detectedCoherenceType: coherenceType === "auto-detect" ? appliedCoherenceType : undefined,
            wasAutoDetected: coherenceType === "auto-detect"
          });
        } else {
          const result = await rewriteForCoherence(text, aggressiveness as "conservative" | "moderate" | "aggressive");
          
          res.json({
            success: true,
            rewrite: result.rewrittenText,
            changes: result.changes,
            detectedCoherenceType: coherenceType === "auto-detect" ? appliedCoherenceType : undefined,
            wasAutoDetected: coherenceType === "auto-detect"
          });
        }
      }
    } catch (error: any) {
      console.error("Coherence Meter error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Coherence analysis/rewrite failed"
      });
    }
  });

  // Outline-Guided Coherence Processing - Two-Stage approach for long texts
  app.post("/api/coherence-outline-guided", async (req: Request, res: Response) => {
    try {
      const { text, coherenceType, mode, aggressiveness = "moderate", onProgress } = req.body;

      if (!text || !coherenceType || !mode) {
        return res.status(400).json({
          success: false,
          message: "Text, coherenceType, and mode are required"
        });
      }

      console.log(`Outline-Guided Coherence - Type: ${coherenceType}, Mode: ${mode}, Text length: ${text.length}`);

      // Initialize Anthropic client
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });

      const coherenceDefinitions = {
        "logical-consistency": "Text contains no direct logical contradictions. Statements don't contradict each other.",
        "logical-cohesiveness": "Claims don't just avoid contradiction—they actively support each other in a directed way. Each statement builds on or follows from previous statements.",
        "scientific-explanatory": "Explanations align with natural law and known mechanisms. The account could plausibly be true given how the world actually works.",
        "thematic-psychological": "Mood, imagery, emotional trajectory, and psychological feel maintain consistency and flow naturally. The 'texture' of the writing holds together.",
        "instructional": "Sends a consistent, actionable message. The reader knows exactly what they are supposed to do. No contradictory directives.",
        "motivational": "User knows how they are supposed to feel. Emotional direction is clear and maintained throughout. Inspires consistent psychological state.",
        "mathematical": "Mathematical proofs are valid, derivations follow logically, formulas are correctly applied, and quantitative claims are properly supported.",
        "philosophical": "Conceptual rigor is maintained throughout. Terms are used consistently, distinctions are preserved, and arguments avoid category mistakes.",
        "auto-detect": "System analyzes the text and determines which type(s) of coherence it's attempting to achieve."
      };

      // ========== STAGE 1: GENERATE AND FIX OUTLINE ==========
      console.log("STAGE 1: Generating document outline...");
      
      const outlinePrompt = `You are creating a structural outline of a document for coherence analysis.

Generate a comprehensive outline under 450 words that captures:

1. MAIN THESIS OR CENTRAL ARGUMENT
   What is the document's primary claim or purpose?

2. SECTION STRUCTURE
   What are the major sections and what does each section argue/explain?

3. KEY CONCEPTS AND DEFINITIONS
   What important terms are used and how are they defined?

4. LOGICAL FLOW
   How does the argument progress from premises to conclusion?

5. CONCLUSIONS
   What are the final claims or implications?

Format as a clear hierarchical outline that captures the document's argumentative and conceptual structure.

DOCUMENT:
${text}

OUTLINE:`;

      const outlineMessage = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 2000,
        temperature: 0.7,
        system: "You are a document analyst who creates precise structural outlines.",
        messages: [{ role: "user", content: outlinePrompt }]
      });

      const outline = outlineMessage.content[0].type === 'text' ? outlineMessage.content[0].text : '';
      console.log("Outline generated, length:", outline.length);

      // Analyze outline coherence
      console.log("STAGE 1: Analyzing outline coherence...");
      
      const outlineAnalysisPrompt = `Analyze this document outline for ${coherenceType} coherence.

COHERENCE TYPE: ${coherenceType}
DEFINITION: ${coherenceDefinitions[coherenceType as keyof typeof coherenceDefinitions]}

OUTLINE TO ANALYZE:
${outline}

Provide a score (1-10) and brief assessment. Format: SCORE: X/10

ANALYSIS:`;

      const analysisMessage = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1000,
        temperature: 0.5,
        system: "You are a coherence analyzer.",
        messages: [{ role: "user", content: outlineAnalysisPrompt }]
      });

      const outlineAnalysis = analysisMessage.content[0].type === 'text' ? analysisMessage.content[0].text : '';
      const scoreMatch = outlineAnalysis.match(/SCORE:\s*(\d+)\/10/i);
      const outlineScore = scoreMatch ? parseInt(scoreMatch[1]) : 7;

      console.log(`Outline score: ${outlineScore}/10`);

      // Fix outline if score < 8
      let coherentOutline = outline;
      if (outlineScore < 8) {
        console.log("STAGE 1: Outline score too low, rewriting for coherence...");
        
        const outlineRewritePrompt = `Rewrite this document outline to maximize ${coherenceType} coherence.

COHERENCE TYPE: ${coherenceType}
DEFINITION: ${coherenceDefinitions[coherenceType as keyof typeof coherenceDefinitions]}

ORIGINAL OUTLINE:
${outline}

CURRENT ISSUES:
${outlineAnalysis}

Rewrite the outline to fix these coherence issues. Maintain the same general content but restructure for maximum coherence. Keep under 450 words.

REWRITTEN OUTLINE:`;

        const rewriteMessage = await anthropic.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 2000,
          temperature: 0.7,
          system: "You are a document restructuring expert.",
          messages: [{ role: "user", content: outlineRewritePrompt }]
        });

        coherentOutline = rewriteMessage.content[0].type === 'text' ? rewriteMessage.content[0].text : outline;
        console.log("Outline rewritten for coherence");
      }

      // ========== STAGE 2: PROCESS SECTIONS WITH OUTLINE CONTEXT ==========
      console.log("STAGE 2: Splitting document into sections...");

      // Split text into sections (~400 words each)
      const sections = splitIntoSections(text, 400);
      console.log(`Document split into ${sections.length} sections`);

      if (mode === "analyze") {
        // Analyze each section with outline context
        let combinedAnalysis = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTLINE-GUIDED COHERENCE ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Original Length: ${text.split(/\s+/).length} words
Sections: ${sections.length}
Coherence Type: ${coherenceType}
Processing Mode: Outline-Guided (Two-Stage)

DOCUMENT OUTLINE:
${coherentOutline}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION-BY-SECTION ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

        for (let i = 0; i < sections.length; i++) {
          console.log(`STAGE 2: Analyzing section ${i + 1}/${sections.length}...`);
          
          const sectionAnalysisPrompt = `Analyze this section for ${coherenceType} coherence in context of the overall document.

DOCUMENT OUTLINE (for context):
${coherentOutline}

SECTION ${i + 1} of ${sections.length}:
${sections[i].text}

Analyze how well this section maintains ${coherenceType} coherence both internally and in relation to the document outline.

Provide: Score (1-10), issues found, and how it fits the overall structure.`;

          const sectionMessage = await anthropic.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 1500,
            temperature: 0.5,
            system: `You are analyzing section coherence in context of a larger document structure.`,
            messages: [{ role: "user", content: sectionAnalysisPrompt }]
          });

          const sectionAnalysis = sectionMessage.content[0].type === 'text' ? sectionMessage.content[0].text : '';
          combinedAnalysis += `\n━━━━ SECTION ${i + 1} ━━━━\n${sectionAnalysis}\n`;
        }

        res.json({
          success: true,
          analysis: combinedAnalysis,
          outline: coherentOutline
        });

      } else {
        // Rewrite each section with outline context
        let combinedRewrite = '';

        for (let i = 0; i < sections.length; i++) {
          console.log(`STAGE 2: Rewriting section ${i + 1}/${sections.length}...`);
          
          let aggressivenessInstructions = "";
          if (aggressiveness === "conservative") {
            aggressivenessInstructions = "Make minimal changes. Preserve original structure and wording as much as possible. Only fix critical coherence issues.";
          } else if (aggressiveness === "moderate") {
            aggressivenessInstructions = "Fix major coherence issues and add necessary context. Moderate restructuring allowed if needed.";
          } else {
            aggressivenessInstructions = "Maximize coherence score (target 9-10/10). Extensive restructuring, expansion, and context addition encouraged.";
          }

          const sectionRewritePrompt = `Rewrite this section to maximize ${coherenceType} coherence while maintaining consistency with the overall document structure.

DOCUMENT OUTLINE (maintain consistency with this):
${coherentOutline}

POSITION IN DOCUMENT:
- Section ${i + 1} of ${sections.length}

COHERENCE TYPE: ${coherenceType}
DEFINITION: ${coherenceDefinitions[coherenceType as keyof typeof coherenceDefinitions]}

AGGRESSIVENESS: ${aggressiveness}
${aggressivenessInstructions}

SECTION TO REWRITE:
${sections[i].text}

Provide ONLY the rewritten section. Do not include any explanations, descriptions, or commentary about the changes - just the rewritten text itself.`;

          const rewriteMessage = await anthropic.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 3000,
            temperature: 0.7,
            system: `You are rewriting sections for maximum coherence while maintaining document-level consistency. Output ONLY the rewritten text with no explanations.`,
            messages: [{ role: "user", content: sectionRewritePrompt }]
          });

          const output = rewriteMessage.content[0].type === 'text' ? rewriteMessage.content[0].text : '';
          
          // Use the output directly as the rewrite (no parsing needed)
          combinedRewrite += `${output.trim()}\n\n`;
        }

        res.json({
          success: true,
          rewrite: combinedRewrite.trim()
        });
      }

    } catch (error: any) {
      console.error("Outline-Guided Coherence error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Outline-guided processing failed"
      });
    }
  });

  // Helper function to split text into sections
  function splitIntoSections(text: string, targetWords: number = 400): Array<{text: string, wordCount: number}> {
    const paragraphs = text.split(/\n\n+/);
    const sections: Array<{text: string, wordCount: number}> = [];
    let currentSection: string[] = [];
    let currentWordCount = 0;

    for (const paragraph of paragraphs) {
      const paraWords = paragraph.trim().split(/\s+/).length;
      
      if (currentWordCount + paraWords > targetWords && currentSection.length > 0) {
        sections.push({
          text: currentSection.join('\n\n'),
          wordCount: currentWordCount
        });
        currentSection = [];
        currentWordCount = 0;
      }
      
      currentSection.push(paragraph);
      currentWordCount += paraWords;
    }

    if (currentSection.length > 0) {
      sections.push({
        text: currentSection.join('\n\n'),
        wordCount: currentWordCount
      });
    }

    return sections;
  }

  return app;
}