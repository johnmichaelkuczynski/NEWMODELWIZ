import { streamProviderText } from "../services/aiProviders";

const DIRECT_SYSTEM_PROMPT =
  "You are a helpful assistant responding to user instructions. Provide direct, thorough and accurate responses.";

async function directText(
  provider: string,
  instructions: string,
  temperature = 0.3,
  onChunk?: (chunk: string) => void,
): Promise<string> {
  return streamProviderText(provider, [
    { role: "system", content: DIRECT_SYSTEM_PROMPT },
    { role: "user", content: instructions },
  ], onChunk || (() => undefined), { temperature, maxTokens: 4000 });
}

/**
 * Direct request to OpenAI without any intermediary processing
 */
export async function directOpenAIRequest(instructions: string, onChunk?: (chunk: string) => void): Promise<any> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required but not provided");
  }

  console.log("Sending direct request to OpenAI");
  
  try {
    const content = await directText("openai", instructions, 0.3, onChunk);
    
    return {
      content,
      model: "gpt-4o",
      provider: "OpenAI"
    };
  } catch (error) {
    console.error("Error in direct OpenAI request:", error);
    throw error;
  }
}

/**
 * Direct request to Anthropic Claude without any intermediary processing
 */
export async function directClaudeRequest(instructions: string, onChunk?: (chunk: string) => void): Promise<any> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is required but not provided");
  }

  console.log("Sending direct request to Claude");
  
  try {
    const content = await directText("anthropic", instructions, 0.3, onChunk);
    if (content) {
      return {
        content,
        model: "claude-sonnet-4-20250514",
        provider: "Anthropic (Claude)"
      };
    } else {
      throw new Error("Unexpected response format from Anthropic API");
    }
  } catch (error) {
    console.error("Error in direct Claude request:", error);
    throw error;
  }
}

/**
 * Direct request to Perplexity without any intermediary processing
 */
export async function directPerplexityRequest(instructions: string, onChunk?: (chunk: string) => void): Promise<any> {
  if (!process.env.PERPLEXITY_API_KEY) {
    throw new Error("PERPLEXITY_API_KEY is required but not provided");
  }

  console.log("Sending direct request to Perplexity");
  
  try {
    let citations: string[] = [];
    const content = await streamProviderText("perplexity", [
      { role: "system", content: DIRECT_SYSTEM_PROMPT },
      { role: "user", content: instructions },
    ], onChunk || (() => undefined), {
      temperature: 0.4,
      maxTokens: 4000,
      onEvent: event => {
        if (Array.isArray(event.citations)) citations = event.citations;
      },
    });
    if (content) {
      return {
        content,
        model: "sonar",
        provider: "Perplexity",
        citations
      };
    } else {
      throw new Error("Unexpected response format from Perplexity API");
    }
  } catch (error) {
    console.error("Error in direct Perplexity request:", error);
    throw error;
  }
}

/**
 * Direct request to DeepSeek without any intermediary processing
 */
export async function directDeepSeekRequest(instructions: string, onChunk?: (chunk: string) => void): Promise<any> {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY is required but not provided");
  }

  console.log("Sending direct request to DeepSeek");
  
  try {
    const content = await directText("deepseek", instructions, 0.3, onChunk);
    if (content) {
      return {
        content,
        model: "deepseek-chat",
        provider: "DeepSeek"
      };
    } else {
      throw new Error("Unexpected response format from DeepSeek API");
    }
  } catch (error) {
    console.error("Error in direct DeepSeek request:", error);
    throw error;
  }
}

/**
 * Direct multi-model request sending the same instructions to multiple AI models
 */
export async function directMultiModelRequest(
  instructions: string, 
  models: string[] = ['openai', 'claude', 'perplexity', 'deepseek'],
  onChunk?: (model: string, chunk: string) => void,
): Promise<Record<string, any>> {
  console.log(`Direct multi-model request to: ${models.join(', ')}`);
  console.log(`Instructions: ${instructions.substring(0, 100)}...`);
  
  const results: Record<string, any> = {};
  const promises: Promise<void>[] = [];
  
  // Process OpenAI request if included
  if (models.includes('openai')) {
    const promise = directOpenAIRequest(instructions, chunk => onChunk?.("openai", chunk))
      .then(result => { results.openai = result; })
      .catch(error => { 
        console.error("OpenAI request failed:", error);
        results.openai = { error: error.message, provider: "OpenAI" };
      });
    promises.push(promise);
  }
  
  // Process Claude request if included
  if (models.includes('claude')) {
    const promise = directClaudeRequest(instructions, chunk => onChunk?.("claude", chunk))
      .then(result => { results.claude = result; })
      .catch(error => {
        console.error("Claude request failed:", error);
        results.claude = { error: error.message, provider: "Anthropic (Claude)" };
      });
    promises.push(promise);
  }
  
  // Process Perplexity request if included
  if (models.includes('perplexity')) {
    const promise = directPerplexityRequest(instructions, chunk => onChunk?.("perplexity", chunk))
      .then(result => { results.perplexity = result; })
      .catch(error => {
        console.error("Perplexity request failed:", error);
        results.perplexity = { error: error.message, provider: "Perplexity" };
      });
    promises.push(promise);
  }
  
  // Process DeepSeek request if included
  if (models.includes('deepseek')) {
    const promise = directDeepSeekRequest(instructions, chunk => onChunk?.("deepseek", chunk))
      .then(result => { results.deepseek = result; })
      .catch(error => {
        console.error("DeepSeek request failed:", error);
        results.deepseek = { error: error.message, provider: "DeepSeek" };
      });
    promises.push(promise);
  }
  
  // Wait for all promises to complete
  await Promise.all(promises);
  
  return results;
}