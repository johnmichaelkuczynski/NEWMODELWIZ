import { streamProviderText } from "../services/aiProviders";

export interface EnhancementSuggestion {
  title: string;
  content: string;
  source: string;
  relevanceScore: number; // 1-10 score of how relevant the suggestion is
}

/**
 * Get AI-based enhancement suggestions for a text
 * @param text The text to enhance
 * @param provider The AI provider to use ('openai', 'anthropic', 'perplexity')
 * @returns Array of enhancement suggestions
 */
export async function getEnhancementSuggestions(
  text: string,
  provider: string,
  onChunk?: (chunk: string) => void,
): Promise<EnhancementSuggestion[]> {
  try {
    // Extract key topics and themes from the text to generate better suggestions
    const summary = await getSummary(text, provider, onChunk);
    
    // Get suggestions based on the provider
    switch (provider.toLowerCase()) {
      case 'openai':
        return await getOpenAISuggestions(text, summary, onChunk);
      case 'anthropic':
        return await getAnthropicSuggestions(text, summary, onChunk);
      case 'perplexity':
        return await getPerplexitySuggestions(text, summary, onChunk);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  } catch (error) {
    console.error('Error getting enhancement suggestions:', error);
    throw error;
  }
}

/**
 * Generate a summary of the text to help focus the enhancement suggestions
 */
async function getSummary(text: string, provider: string, onChunk?: (chunk: string) => void): Promise<string> {
  try {
    const prompt = `
    Please analyze the following text and provide a brief summary of the key topics, 
    themes, and potential areas where additional information or enhancements would be valuable.
    Focus on the main subject matter that could benefit from factual enrichment or conceptual expansion.
    Keep your response under 200 words.

    TEXT:
    ${text.slice(0, 3000)} ${text.length > 3000 ? '...' : ''}
    `;

    return streamProviderText(provider, [{ role: "user", content: prompt }], onChunk || (() => undefined), {
      temperature: 0.3,
      maxTokens: 300,
    });
  } catch (error) {
    console.error('Error generating summary:', error);
    return ""; // Return empty string on failure
  }
}

async function getOpenAISuggestions(text: string, summary: string, onChunk?: (chunk: string) => void): Promise<EnhancementSuggestion[]> {
  const prompt = `
  Based on the following text and its summary, generate 3-5 specific enhancement suggestions.
  Each suggestion should add intellectual value to the text without changing its style or voice.
  Include factual, conceptual, or analytical enhancements that would increase the intelligence reflected in the writing.

  For each suggestion, provide:
  1. A clear title describing the enhancement
  2. A concise explanation of what information to add and why it's valuable
  3. A relevance score from 1-10 indicating how important this enhancement is

  TEXT SUMMARY:
  ${summary}

  TEXT EXCERPT (first part):
  ${text.slice(0, 1000)}...
  
  Format your response as a valid JSON array with objects containing "title", "content", "source" (which should be "OpenAI"), and "relevanceScore" fields.
  `;

  try {
    const content = await streamProviderText("openai", [{ role: "user", content: prompt }], onChunk || (() => undefined), {
      temperature: 0.5,
      responseFormat: { type: "json_object" },
    });
    if (!content) return [];
    
    const parsed = JSON.parse(content);
    return parsed.suggestions || [];
  } catch (error) {
    console.error('Error getting OpenAI suggestions:', error);
    return [];
  }
}

async function getAnthropicSuggestions(text: string, summary: string, onChunk?: (chunk: string) => void): Promise<EnhancementSuggestion[]> {
  const prompt = `
  Based on the following text and its summary, generate 3-5 specific enhancement suggestions.
  Each suggestion should add intellectual value to the text without changing its style or voice.
  Include factual, conceptual, or analytical enhancements that would increase the intelligence reflected in the writing.

  For each suggestion, provide:
  1. A clear title describing the enhancement
  2. A concise explanation of what information to add and why it's valuable
  3. A relevance score from 1-10 indicating how important this enhancement is

  TEXT SUMMARY:
  ${summary}

  TEXT EXCERPT (first part):
  ${text.slice(0, 1000)}...
  
  Format your response as a valid JSON with a "suggestions" key containing an array of objects with "title", "content", "source" (which should be "Anthropic"), and "relevanceScore" fields.
  `;

  try {
    const content = await streamProviderText("anthropic", [
      {
        role: "system",
        content: "You are a helpful expert that generates precise, intellectually valuable enhancement suggestions for text. Respond only with valid JSON.",
      },
      { role: "user", content: prompt },
    ], onChunk || (() => undefined), { maxTokens: 1000, temperature: 0.5 });
    // Strip any markdown code blocks that Claude might add
    const jsonStr = content.replace(/```json|```/g, '').trim();
    
    try {
      const parsed = JSON.parse(jsonStr);
      return parsed.suggestions || [];
    } catch (parseError) {
      console.error('Error parsing Claude response as JSON:', parseError);
      return [];
    }
  } catch (error) {
    console.error('Error getting Anthropic suggestions:', error);
    return [];
  }
}

async function getPerplexitySuggestions(text: string, summary: string, onChunk?: (chunk: string) => void): Promise<EnhancementSuggestion[]> {
  const prompt = `
  Based on the following text and its summary, generate 3-5 specific enhancement suggestions.
  Each suggestion should add intellectual value to the text without changing its style or voice.
  Include factual, conceptual, or analytical enhancements that would increase the intelligence reflected in the writing.

  For each suggestion, provide:
  1. A clear title describing the enhancement
  2. A concise explanation of what information to add and why it's valuable
  3. A relevance score from 1-10 indicating how important this enhancement is

  TEXT SUMMARY:
  ${summary}

  TEXT EXCERPT (first part):
  ${text.slice(0, 1000)}...
  
  Format your response as a valid JSON with a "suggestions" key containing an array of objects with "title", "content", "source" (which should be "Perplexity"), and "relevanceScore" fields.
  `;

  try {
    const content = await streamProviderText("perplexity", [
      {
        role: "system",
        content: "You are a helpful expert that generates precise, intellectually valuable enhancement suggestions for text. Respond only with valid JSON.",
      },
      { role: "user", content: prompt },
    ], onChunk || (() => undefined), { maxTokens: 1000, temperature: 0.5 });
    
    try {
      // Strip any potential markdown formatting if present
      const jsonStr = content.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      return parsed.suggestions || [];
    } catch (parseError) {
      console.error('Error parsing Perplexity response as JSON:', parseError);
      return [];
    }
  } catch (error) {
    console.error('Error getting Perplexity suggestions:', error);
    return [];
  }
}