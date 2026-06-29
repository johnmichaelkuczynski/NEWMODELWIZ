// GPT Bypass Humanizer - Rewrite text to match exact style patterns

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

interface HumanizerRequest {
  boxA: string; // Sample text for style reference
  boxB: string; // Target style sample
  boxC: string; // Text to be rewritten
  provider: string;
  customInstructions?: string;
}

interface HumanizerResult {
  originalText: string;
  rewrittenText: string;
  styleAnalysis: string;
  provider: string;
  timestamp: string;
}

// Core humanizer function that analyzes style and rewrites text
export async function performHumanization({
  boxA,
  boxB, 
  boxC,
  provider,
  customInstructions
}: HumanizerRequest): Promise<HumanizerResult> {
  
  const actualProvider = mapZhiToProvider(provider);
  
  // Construct the style matching prompt
  const prompt = buildStyleMatchingPrompt(boxA, boxB, boxC, customInstructions);
  
  console.log(`Performing humanization with ${actualProvider}...`);
  console.log(`Box A length: ${boxA.length} chars`);
  console.log(`Box B length: ${boxB.length} chars`);
  console.log(`Box C length: ${boxC.length} chars`);
  
  let rewrittenText = '';
  let styleAnalysis = '';
  
  try {
    if (actualProvider === 'openai') {
      const result = await callOpenAI(prompt);
      ({ rewrittenText, styleAnalysis } = parseHumanizerResponse(result));
    } else if (actualProvider === 'anthropic') {
      const result = await callAnthropic(prompt);
      ({ rewrittenText, styleAnalysis } = parseHumanizerResponse(result));
    } else if (actualProvider === 'deepseek') {
      const result = await callDeepSeek(prompt);
      ({ rewrittenText, styleAnalysis } = parseHumanizerResponse(result));
    } else if (actualProvider === 'perplexity') {
      const result = await callPerplexity(prompt);
      ({ rewrittenText, styleAnalysis } = parseHumanizerResponse(result));
    } else if (actualProvider === 'grok') {
      const result = await callGrok(prompt);
      ({ rewrittenText, styleAnalysis } = parseHumanizerResponse(result));
    } else {
      throw new Error(`Unsupported provider: ${actualProvider}`);
    }
    
    return {
      originalText: boxC,
      rewrittenText,
      styleAnalysis,
      provider: actualProvider,
      timestamp: new Date().toISOString()
    };
    
  } catch (error: any) {
    console.error(`Humanization failed with ${actualProvider}:`, error);
    throw new Error(`Humanization failed: ${error.message}`);
  }
}

// Build the core style matching prompt
function buildStyleMatchingPrompt(boxA: string, boxB: string, boxC: string, customInstructions?: string): string {
  let prompt = `You are a precision style matching expert. Your task is to rewrite text to match EXACT stylistic patterns.

CRITICAL INSTRUCTION: Analyze the style differences between Box A and Box B, then apply those EXACT same stylistic transformations to Box C.

Box A (Original Style Sample):
"""
${boxA}
"""

Box B (Target Style Sample):  
"""
${boxB}
"""

Box C (Text to Rewrite):
"""
${boxC}
"""

TASK: Rewrite Box C to match the EXACT stylistic patterns, tone, sentence structure, vocabulary level, and linguistic features demonstrated in Box B compared to Box A.

ANALYSIS REQUIREMENTS:
1. Identify specific stylistic differences between Box A and Box B
2. Note changes in: sentence length, vocabulary complexity, tone, punctuation patterns, paragraph structure, formality level
3. Apply these EXACT same transformations to Box C
4. Maintain the original meaning and content of Box C while matching Box B's style

OUTPUT FORMAT:
STYLE ANALYSIS:
[Detailed analysis of stylistic differences between Box A and Box B]

REWRITTEN TEXT:
[Box C rewritten to match Box B's exact style]`;

  if (customInstructions && customInstructions.trim()) {
    prompt += `\n\nADDITIONAL INSTRUCTIONS:\n${customInstructions.trim()}`;
  }

  return prompt;
}

// Parse the LLM response to extract rewritten text and analysis
function parseHumanizerResponse(response: string): { rewrittenText: string; styleAnalysis: string } {
  const sections = response.split(/REWRITTEN TEXT:|STYLE ANALYSIS:/i);
  
  let styleAnalysis = '';
  let rewrittenText = '';
  
  if (sections.length >= 3) {
    // Format: [initial content] STYLE ANALYSIS: [analysis] REWRITTEN TEXT: [rewritten]
    styleAnalysis = sections[1].trim();
    rewrittenText = sections[2].trim();
  } else if (sections.length === 2) {
    // Try to find which section is which
    if (response.toLowerCase().includes('style analysis:')) {
      styleAnalysis = sections[1].trim();
      // Try to extract rewritten text from the end
      const rewrittenMatch = response.match(/rewritten text:\s*([\s\S]*)/i);
      rewrittenText = rewrittenMatch ? rewrittenMatch[1].trim() : sections[1].trim();
    } else {
      // Assume it's the rewritten text
      rewrittenText = sections[1].trim();
      styleAnalysis = 'Style analysis not provided in expected format.';
    }
  } else {
    // Fallback - use entire response as rewritten text
    rewrittenText = response.trim();
    styleAnalysis = 'Style analysis could not be parsed from response.';
  }
  
  return { rewrittenText, styleAnalysis };
}

// OpenAI API call
async function callOpenAI(prompt: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Anthropic API call  
async function callAnthropic(prompt: string): Promise<string> {
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
      messages: [{ role: 'user', content: prompt }]
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

// DeepSeek API call
async function callDeepSeek(prompt: string): Promise<string> {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Perplexity API call
async function callPerplexity(prompt: string): Promise<string> {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-sonar-small-128k-online',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Grok API call
async function callGrok(prompt: string): Promise<string> {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-3',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`Grok API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Text chunking for large inputs
export function chunkText(text: string, maxLength: number = 3000): string[] {
  if (text.length <= maxLength) {
    return [text];
  }
  
  const chunks: string[] = [];
  const sentences = text.split(/[.!?]+/);
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length + 1 > maxLength && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? '. ' : '') + sentence;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

// Process large texts by chunking and reassembling
export async function processLargeText(request: HumanizerRequest): Promise<HumanizerResult> {
  const { boxC } = request;
  
  if (boxC.length <= 3000) {
    return performHumanization(request);
  }
  
  console.log(`Processing large text (${boxC.length} chars) in chunks...`);
  
  const chunks = chunkText(boxC);
  const processedChunks: string[] = [];
  let combinedStyleAnalysis = '';
  
  for (let i = 0; i < chunks.length; i++) {
    console.log(`Processing chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)...`);
    
    const chunkRequest = {
      ...request,
      boxC: chunks[i]
    };
    
    const result = await performHumanization(chunkRequest);
    processedChunks.push(result.rewrittenText);
    
    if (i === 0) {
      combinedStyleAnalysis = result.styleAnalysis;
    }
  }
  
  const finalRewrittenText = processedChunks.join(' ');
  
  return {
    originalText: boxC,
    rewrittenText: finalRewrittenText,
    styleAnalysis: combinedStyleAnalysis + `\n\nNote: Text was processed in ${chunks.length} chunks due to length.`,
    provider: request.provider,
    timestamp: new Date().toISOString()
  };
}