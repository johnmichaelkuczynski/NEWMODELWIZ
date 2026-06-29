import OpenAI from "openai";
import Anthropic from '@anthropic-ai/sdk';
import fetch from 'node-fetch';

// Initialize clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
export async function getEnhancementSuggestions(text: string, provider: string): Promise<EnhancementSuggestion[]> {
  try {
    // Extract key topics and themes from the text to generate better suggestions
    const summary = await getSummary(text, provider);
    
    // Get suggestions based on the provider
    switch (provider.toLowerCase()) {
      case 'openai':
        return await getOpenAISuggestions(text, summary);
      case 'anthropic':
        return await getAnthropicSuggestions(text, summary);
      case 'perplexity':
        return await getPerplexitySuggestions(text, summary);
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
async function getSummary(text: string, provider: string): Promise<string> {
  try {
    const prompt = `
    Please analyze the following text and provide a brief summary of the key topics, 
    themes, and potential areas where additional information or enhancements would be valuable.
    Focus on the main subject matter that could benefit from factual enrichment or conceptual expansion.
    Keep your response under 200 words.

    TEXT:
    ${text.slice(0, 3000)} ${text.length > 3000 ? '...' : ''}
    `;

    switch (provider.toLowerCase()) {
      case 'openai': {
        const response = await openai.chat.completions.create({
          model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 300
        });
        return response.choices[0].message.content || "";
      }
      case 'anthropic': {
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-5", // the newest Anthropic model is "claude-sonnet-4-5" which was released February 24, 2025
          max_tokens: 300,
          temperature: 0.3,
          messages: [{ role: 'user', content: prompt }]
        });
        const content = response.content[0];
        return content.type === 'text' ? content.text : "";
      }
      case 'perplexity': {
        const apiKey = process.env.PERPLEXITY_API_KEY;
        if (!apiKey) throw new Error("PERPLEXITY_API_KEY not found");

        const response = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "sonar",
            messages: [
              {
                role: "system",
                content: "Be precise and concise."
              },
              {
                role: "user",
                content: prompt
              }
            ],
            temperature: 0.3,
            max_tokens: 300
          })
        });

        const data = await response.json();
        return data.choices[0].message.content;
      }
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  } catch (error) {
    console.error('Error generating summary:', error);
    return ""; // Return empty string on failure
  }
}

async function getOpenAISuggestions(text: string, summary: string): Promise<EnhancementSuggestion[]> {
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
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) return [];
    
    const parsed = JSON.parse(content);
    return parsed.suggestions || [];
  } catch (error) {
    console.error('Error getting OpenAI suggestions:', error);
    return [];
  }
}

async function getAnthropicSuggestions(text: string, summary: string): Promise<EnhancementSuggestion[]> {
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
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      system: "You are a helpful expert that generates precise, intellectually valuable enhancement suggestions for text. Respond only with valid JSON.",
      max_tokens: 1000,
      temperature: 0.5,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].text;
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

async function getPerplexitySuggestions(text: string, summary: string): Promise<EnhancementSuggestion[]> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error("PERPLEXITY_API_KEY not found");

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
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: "You are a helpful expert that generates precise, intellectually valuable enhancement suggestions for text. Respond only with valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.5,
        max_tokens: 1000
      })
    });

    const data = await response.json();
    const content = data.choices[0].message.content;
    
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