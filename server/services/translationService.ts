import OpenAI from "openai";
import Anthropic from '@anthropic-ai/sdk';
import fetch from 'node-fetch';

// Initialize API clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface TranslationOptions {
  targetLanguage: string;
  sourceLanguage?: string;
  preserveFormatting?: boolean;
  preserveIntelligence?: boolean;
}

interface TranslationResult {
  originalText: string;
  translatedText: string;
  targetLanguage: string;
  sourceLanguage: string;
  provider: string;
}

/**
 * Translate document to target language
 * @param text Text to translate
 * @param options Translation options
 * @param provider AI provider to use (openai, anthropic, perplexity)
 * @returns Translated text
 */
export async function translateDocument(
  text: string, 
  options: TranslationOptions, 
  provider: string = "openai"
): Promise<TranslationResult> {
  const { 
    targetLanguage, 
    sourceLanguage = "auto-detect", 
    preserveFormatting = true,
    preserveIntelligence = true
  } = options;
  
  const translationPrompt = `
    Please translate the following text from ${sourceLanguage === "auto-detect" ? "its original language" : sourceLanguage} to ${targetLanguage}.
    
    ${preserveFormatting ? "Preserve the original formatting, including paragraphs, bullet points, and any special formatting." : ""}
    
    ${preserveIntelligence ? "IMPORTANT: Preserve the intellectual quality and cognitive fingerprint of the original. Maintain the same level of abstraction, logical control, and definitional clarity." : ""}
    
    Text to translate:
    ${text}
  `;
  
  let result: TranslationResult;
  
  switch (provider.toLowerCase()) {
    case 'anthropic':
      result = await translateWithAnthropic(translationPrompt, text, targetLanguage, sourceLanguage);
      break;
      
    case 'perplexity':
      result = await translateWithPerplexity(translationPrompt, text, targetLanguage, sourceLanguage);
      break;
      
    case 'openai':
    default:
      result = await translateWithOpenAI(translationPrompt, text, targetLanguage, sourceLanguage);
      break;
  }
  
  return result;
}

/**
 * Translate using OpenAI
 */
async function translateWithOpenAI(
  prompt: string, 
  originalText: string, 
  targetLanguage: string, 
  sourceLanguage: string
): Promise<TranslationResult> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a professional translator with expertise in preserving intellectual quality across languages." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2
    });
    
    const translatedText = response.choices[0].message.content || '';
    
    return {
      originalText,
      translatedText,
      targetLanguage,
      sourceLanguage,
      provider: "OpenAI (GPT-4o)"
    };
  } catch (error: any) {
    console.error("Error translating with OpenAI:", error);
    return {
      originalText,
      translatedText: `Error translating text: ${error.message}`,
      targetLanguage,
      sourceLanguage,
      provider: "OpenAI (Error)"
    };
  }
}

/**
 * Translate using Anthropic Claude
 */
async function translateWithAnthropic(
  prompt: string, 
  originalText: string, 
  targetLanguage: string, 
  sourceLanguage: string
): Promise<TranslationResult> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4000,
      temperature: 0.2,
      system: "You are a professional translator with expertise in preserving intellectual quality across languages.",
      messages: [
        { role: "user", content: prompt }
      ]
    });
    
    const translatedText = response.content[0].type === 'text' ? response.content[0].text : '';
    
    return {
      originalText,
      translatedText,
      targetLanguage,
      sourceLanguage,
      provider: "Anthropic (Claude)"
    };
  } catch (error: any) {
    console.error("Error translating with Anthropic:", error);
    return {
      originalText,
      translatedText: `Error translating text: ${error.message}`,
      targetLanguage,
      sourceLanguage,
      provider: "Anthropic (Error)"
    };
  }
}

/**
 * Translate using Perplexity
 */
async function translateWithPerplexity(
  prompt: string, 
  originalText: string, 
  targetLanguage: string, 
  sourceLanguage: string
): Promise<TranslationResult> {
  try {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      throw new Error("PERPLEXITY_API_KEY not found in environment variables");
    }
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { 
            role: "system", 
            content: "You are a professional translator with expertise in preserving intellectual quality across languages." 
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 3000
      })
    });
    
    const data = await response.json() as any;
    
    if (!response.ok) {
      throw new Error(data?.error?.message || "Perplexity API error");
    }
    
    const translatedText = data.choices[0].message.content || '';
    
    return {
      originalText,
      translatedText,
      targetLanguage,
      sourceLanguage,
      provider: "Perplexity (Llama 3.1)"
    };
  } catch (error: any) {
    console.error("Error translating with Perplexity:", error);
    return {
      originalText,
      translatedText: `Error translating text: ${error.message}`,
      targetLanguage,
      sourceLanguage,
      provider: "Perplexity (Error)"
    };
  }
}

export default {
  translateDocument
};