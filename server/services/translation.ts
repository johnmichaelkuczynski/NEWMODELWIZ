import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Interfaces for translation
interface TranslationOptions {
  sourceLanguage: string;
  targetLanguage: string;
  model?: string;
  useDeepL?: boolean;
}

interface TranslationProgress {
  currentChunk: number;
  totalChunks: number;
  status: 'processing' | 'completed' | 'failed';
  translatedContent?: string;
  error?: string;
}

interface TranslationResult {
  success: boolean;
  translatedContent: string;
  error?: string;
}

interface SubchunkTranslationResult {
  success: boolean;
  translatedContent: string;
  index: number;
  error?: string;
}

// Constants
const WORD_COUNT_REGEX = /\S+/g;
const MACROCHUNK_SIZE = 10000; // words
const SUBCHUNK_SIZE = 800; // words
const MAX_RETRIES = 2;

// Detect language if auto is selected
async function detectLanguage(text: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      messages: [
        {
          role: "system",
          content: "You are a language detection expert. Analyze the text and identify what language it's written in. Respond with just the language name in lowercase (e.g., 'english', 'spanish', 'french', etc)."
        },
        {
          role: "user",
          content: text.substring(0, 300) // Just use the first 300 characters for detection
        }
      ],
      temperature: 0.3,
      max_tokens: 20
    });
    
    const detectedLanguage = response.choices[0].message.content?.toLowerCase().trim() || "english";
    console.log(`Detected language: ${detectedLanguage}`);
    return detectedLanguage;
  } catch (error) {
    console.error("Error detecting language:", error);
    return "english"; // Default to English if detection fails
  }
}

// Helper function to count words
function countWords(text: string): number {
  const matches = text.match(WORD_COUNT_REGEX);
  return matches ? matches.length : 0;
}

// Helper function to split text into chunks while preserving paragraph structure
function splitIntoChunks(text: string, maxWords: number): string[] {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk = '';
  let currentWordCount = 0;

  for (const paragraph of paragraphs) {
    const paragraphWordCount = countWords(paragraph);
    
    // If a single paragraph exceeds the max, split it by sentences
    if (paragraphWordCount > maxWords) {
      const sentences = paragraph.split(/(?<=[.!?])\s+/);
      for (const sentence of sentences) {
        const sentenceWordCount = countWords(sentence);
        
        // Check if adding this sentence would exceed the limit
        if (currentWordCount + sentenceWordCount > maxWords && currentChunk !== '') {
          chunks.push(currentChunk);
          currentChunk = sentence;
          currentWordCount = sentenceWordCount;
        } else {
          currentChunk += (currentChunk ? ' ' : '') + sentence;
          currentWordCount += sentenceWordCount;
        }
        
        // Check again after adding the sentence
        if (currentWordCount >= maxWords) {
          chunks.push(currentChunk);
          currentChunk = '';
          currentWordCount = 0;
        }
      }
    } else {
      // Check if adding this paragraph would exceed the limit
      if (currentWordCount + paragraphWordCount > maxWords && currentChunk !== '') {
        chunks.push(currentChunk);
        currentChunk = paragraph;
        currentWordCount = paragraphWordCount;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        currentWordCount += paragraphWordCount;
      }
      
      // Check again after adding the paragraph
      if (currentWordCount >= maxWords) {
        chunks.push(currentChunk);
        currentChunk = '';
        currentWordCount = 0;
      }
    }
  }
  
  // Add any remaining content
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

/**
 * Translate a subchunk with retry logic
 */
async function translateSubchunk(
  text: string, 
  options: TranslationOptions, 
  retryCount = 0
): Promise<TranslationResult> {
  try {
    if (options.useDeepL && process.env.DEEPL_API_KEY) {
      // Implementation for DeepL would go here
      // For now, falling back to OpenAI
      return await translateWithOpenAI(text, options);
    } else {
      return await translateWithOpenAI(text, options);
    }
  } catch (error: any) {
    console.error(`Translation error (attempt ${retryCount + 1}):`, error.message);
    
    // Retry logic
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying translation (attempt ${retryCount + 2})...`);
      return translateSubchunk(text, options, retryCount + 1);
    }
    
    return {
      success: false,
      translatedContent: '',
      error: error.message
    };
  }
}

/**
 * Translate text using OpenAI
 */
async function translateWithOpenAI(
  text: string, 
  options: TranslationOptions
): Promise<TranslationResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  try {
    const response = await openai.chat.completions.create({
      model: options.model || "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a professional translator. Translate the following text from ${options.sourceLanguage} to ${options.targetLanguage}. Preserve formatting, paragraph structure, and any special characters. Do not add explanations or notes - only include the translated text.`
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.3,
    });

    const translatedContent = response.choices[0].message.content || '';
    
    // Check for HTML-style responses which might indicate an error
    if (translatedContent.includes('<!DOCTYPE html>') || translatedContent.includes('<html>')) {
      throw new Error('Received HTML response instead of translation');
    }

    return {
      success: true,
      translatedContent
    };
  } catch (error: any) {
    console.error('OpenAI translation error:', error);
    throw error;
  }
}

/**
 * Translate a macrochunk by splitting it into subchunks and translating each
 */
async function translateMacrochunk(
  macrochunk: string, 
  options: TranslationOptions,
  startIndex: number,
  totalSubchunks: number
): Promise<TranslationResult> {
  // Split the macrochunk into subchunks
  const subchunks = splitIntoChunks(macrochunk, SUBCHUNK_SIZE);
  const results: SubchunkTranslationResult[] = [];
  
  // Process each subchunk
  for (let i = 0; i < subchunks.length; i++) {
    const currentIndex = startIndex + i;
    console.log(`Translating subchunk ${currentIndex + 1} of ${totalSubchunks}...`);
    
    const result = await translateSubchunk(subchunks[i], options);
    
    results.push({
      ...result,
      index: i
    });
    
    // If translation failed and we've exhausted retries, we'll still continue with other chunks
    if (!result.success) {
      console.warn(`Warning: Failed to translate subchunk ${i + 1}. Using original text for this section.`);
    }
  }
  
  // Combine the results, preserving order
  const sortedResults = results.sort((a, b) => a.index - b.index);
  const translatedMacrochunk = sortedResults
    .map(result => result.success ? result.translatedContent : subchunks[result.index])
    .join('\n\n');
  
  return {
    success: true,
    translatedContent: translatedMacrochunk
  };
}

/**
 * Main function to translate large documents with multi-tier chunking
 */
export async function translateLargeDocument(
  document: string,
  options: TranslationOptions,
  progressCallback?: (progress: TranslationProgress) => void
): Promise<TranslationResult> {
  try {
    // Auto-detect source language if 'auto' is selected
    if (options.sourceLanguage === 'auto') {
      try {
        console.log('Auto-detecting source language...');
        if (progressCallback) {
          progressCallback({
            currentChunk: 0,
            totalChunks: 1,
            status: 'processing'
          });
        }
        
        const detectedLanguage = await detectLanguage(document.substring(0, 1000));
        options = { ...options, sourceLanguage: detectedLanguage };
        console.log(`Using detected language: ${detectedLanguage} for translation`);
      } catch (error) {
        console.error('Language detection failed, defaulting to English:', error);
        options = { ...options, sourceLanguage: 'english' };
      }
    }
    
    const wordCount = countWords(document);
    console.log(`Document word count: ${wordCount}`);
    
    // Determine if we need to use the macrochunk approach
    if (wordCount <= MACROCHUNK_SIZE) {
      // Document is small enough to be treated as a single macrochunk
      if (progressCallback) {
        progressCallback({
          currentChunk: 0,
          totalChunks: 1,
          status: 'processing'
        });
      }
      
      const result = await translateMacrochunk(document, options, 0, 1);
      
      if (progressCallback) {
        progressCallback({
          currentChunk: 1,
          totalChunks: 1,
          status: 'completed',
          translatedContent: result.translatedContent
        });
      }
      
      return result;
    } else {
      // Split into macrochunks for very large documents
      const macrochunks = splitIntoChunks(document, MACROCHUNK_SIZE);
      const results: TranslationResult[] = [];
      let totalSubchunks = 0;
      
      // First, calculate the total number of subchunks for progress reporting
      for (const chunk of macrochunks) {
        const subchunks = splitIntoChunks(chunk, SUBCHUNK_SIZE);
        totalSubchunks += subchunks.length;
      }
      
      let processedSubchunks = 0;
      
      // Process each macrochunk
      for (let i = 0; i < macrochunks.length; i++) {
        console.log(`Processing macrochunk ${i + 1} of ${macrochunks.length}...`);
        
        const result = await translateMacrochunk(
          macrochunks[i], 
          options, 
          processedSubchunks,
          totalSubchunks
        );
        
        results.push(result);
        
        // Update progress after each macrochunk
        const subchunksInThisChunk = splitIntoChunks(macrochunks[i], SUBCHUNK_SIZE).length;
        processedSubchunks += subchunksInThisChunk;
        
        if (progressCallback) {
          progressCallback({
            currentChunk: processedSubchunks,
            totalChunks: totalSubchunks,
            status: i === macrochunks.length - 1 ? 'completed' : 'processing'
          });
        }
      }
      
      // Combine all translated macrochunks
      const translatedDocument = results
        .map(result => result.translatedContent)
        .join('\n\n');
      
      if (progressCallback) {
        progressCallback({
          currentChunk: totalSubchunks,
          totalChunks: totalSubchunks,
          status: 'completed',
          translatedContent: translatedDocument
        });
      }
      
      return {
        success: true,
        translatedContent: translatedDocument
      };
    }
  } catch (error: any) {
    console.error('Translation error:', error);
    
    if (progressCallback) {
      progressCallback({
        currentChunk: 0,
        totalChunks: 0,
        status: 'failed',
        error: error.message
      });
    }
    
    return {
      success: false,
      translatedContent: '',
      error: error.message
    };
  }
}