import { completeProviderText } from "./aiProviders";

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
    const translatedText = await completeProviderText(
      "openai",
      [
        { role: "system", content: "You are a professional translator with expertise in preserving intellectual quality across languages." },
        { role: "user", content: prompt },
      ],
      { temperature: 0.2 },
    );
    
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
    const translatedText = await completeProviderText("anthropic", [
        { role: "system", content: "You are a professional translator with expertise in preserving intellectual quality across languages." },
        { role: "user", content: prompt }
      ], { temperature: 0.2, maxTokens: 4000 });
    
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
    const translatedText = await completeProviderText("perplexity", [
      {
        role: "system",
        content: "You are a professional translator with expertise in preserving intellectual quality across languages."
      },
      { role: "user", content: prompt }
    ], { temperature: 0.2, maxTokens: 3000 });
    
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