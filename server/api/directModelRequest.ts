import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import fetch from 'node-fetch';

/**
 * Direct request to OpenAI without any intermediary processing
 */
export async function directOpenAIRequest(instructions: string): Promise<any> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required but not provided");
  }

  console.log("Sending direct request to OpenAI");
  
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      messages: [
        { role: "system", content: "You are a helpful assistant responding to user instructions. Provide direct, thorough and accurate responses." },
        { role: "user", content: instructions }
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });
    
    return {
      content: response.choices[0].message.content,
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
export async function directClaudeRequest(instructions: string): Promise<any> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is required but not provided");
  }

  console.log("Sending direct request to Claude");
  
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5", // the newest Anthropic model is "claude-sonnet-4-5" which was released February 24, 2025
      system: "You are a helpful assistant responding to user instructions. Provide direct, thorough and accurate responses.",
      messages: [
        { role: "user", content: instructions }
      ],
      max_tokens: 4000,
    });
    
    if (response.content && response.content[0] && 'text' in response.content[0]) {
      return {
        content: response.content[0].text,
        model: "claude-sonnet-4-5",
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
export async function directPerplexityRequest(instructions: string): Promise<any> {
  if (!process.env.PERPLEXITY_API_KEY) {
    throw new Error("PERPLEXITY_API_KEY is required but not provided");
  }

  console.log("Sending direct request to Perplexity");
  
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: "You are a helpful assistant responding to user instructions. Provide direct, thorough and accurate responses." },
          { role: "user", content: instructions }
        ],
        temperature: 0.4,
        max_tokens: 4000,
      })
    });
    
    const data = await response.json() as any;
    
    if (!response.ok) {
      throw new Error(data?.error?.message || "Perplexity API error");
    }
    
    if (data && data.choices && data.choices[0] && data.choices[0].message) {
      return {
        content: data.choices[0].message.content,
        model: "sonar",
        provider: "Perplexity",
        citations: data.citations || []
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
export async function directDeepSeekRequest(instructions: string): Promise<any> {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY is required but not provided");
  }

  console.log("Sending direct request to DeepSeek");
  
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "You are a helpful assistant responding to user instructions. Provide direct, thorough and accurate responses." },
          { role: "user", content: instructions }
        ],
        temperature: 0.3,
        max_tokens: 4000,
      })
    });
    
    const data = await response.json() as any;
    
    if (!response.ok) {
      throw new Error(data?.error?.message || "DeepSeek API error");
    }
    
    if (data && data.choices && data.choices[0] && data.choices[0].message) {
      return {
        content: data.choices[0].message.content,
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
  models: string[] = ['openai', 'claude', 'perplexity', 'deepseek']
): Promise<Record<string, any>> {
  console.log(`Direct multi-model request to: ${models.join(', ')}`);
  console.log(`Instructions: ${instructions.substring(0, 100)}...`);
  
  const results: Record<string, any> = {};
  const promises: Promise<void>[] = [];
  
  // Process OpenAI request if included
  if (models.includes('openai')) {
    const promise = directOpenAIRequest(instructions)
      .then(result => { results.openai = result; })
      .catch(error => { 
        console.error("OpenAI request failed:", error);
        results.openai = { error: error.message, provider: "OpenAI" };
      });
    promises.push(promise);
  }
  
  // Process Claude request if included
  if (models.includes('claude')) {
    const promise = directClaudeRequest(instructions)
      .then(result => { results.claude = result; })
      .catch(error => {
        console.error("Claude request failed:", error);
        results.claude = { error: error.message, provider: "Anthropic (Claude)" };
      });
    promises.push(promise);
  }
  
  // Process Perplexity request if included
  if (models.includes('perplexity')) {
    const promise = directPerplexityRequest(instructions)
      .then(result => { results.perplexity = result; })
      .catch(error => {
        console.error("Perplexity request failed:", error);
        results.perplexity = { error: error.message, provider: "Perplexity" };
      });
    promises.push(promise);
  }
  
  // Process DeepSeek request if included
  if (models.includes('deepseek')) {
    const promise = directDeepSeekRequest(instructions)
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