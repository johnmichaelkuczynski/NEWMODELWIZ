/**
 * Utility functions for text processing and cleanup
 */

/**
 * Remove markdown and other markup formatting from text
 */
export function stripMarkup(text: string): string {
  if (!text) return '';
  
  return text
    // Remove ALL markdown headers (###, ##, #)
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/#{1,6}\s*/g, '')
    // Remove ALL bold and italic markers (**text**, *text*, __text__, _text_)
    .replace(/\*\*([^*]*?)\*\*/g, '$1')
    .replace(/\*([^*]*?)\*/g, '$1')
    .replace(/__([^_]*?)__/g, '$1')
    .replace(/_([^_]*?)_/g, '$1')
    // Remove any remaining asterisks and underscores
    .replace(/\*+/g, '')
    .replace(/_+/g, '')
    // Remove inline code markers
    .replace(/`([^`]*?)`/g, '$1')
    .replace(/`+/g, '')
    // Remove code block markers
    .replace(/```[\s\S]*?```/g, '')
    .replace(/~~~[\s\S]*?~~~/g, '')
    // Remove strikethrough
    .replace(/~~([^~]*?)~~/g, '$1')
    .replace(/~+/g, '')
    // Remove blockquote markers
    .replace(/^>\s*/gm, '')
    .replace(/>\s*/g, '')
    // Remove list markers
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    .replace(/[-*+]\s+/g, '')
    // Remove link markup but keep text
    .replace(/\[([^\]]*?)\]\([^)]*?\)/g, '$1')
    // Remove reference links
    .replace(/\[([^\]]*?)\]\[[^\]]*?\]/g, '$1')
    // Remove image markup
    .replace(/!\[([^\]]*)\]\([^)]*?\)/g, '$1')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}$/gm, '')
    .replace(/[-*_]{3,}/g, '')
    // Remove HTML tags
    .replace(/<[^>]*?>/g, '')
    // Remove any remaining brackets
    .replace(/\[|\]/g, '')
    .replace(/\(|\)/g, '')
    // Clean up extra whitespace
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .replace(/^\s+|\s+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Clean up AI response text by removing markup and formatting consistently
 */
export function cleanAIResponse(text: string): string {
  if (!text) return '';
  
  // First pass - aggressive markdown removal
  let cleaned = text
    // Remove ALL headers
    .replace(/#{1,6}\s*/g, '')
    // Remove ALL bold/italic markers
    .replace(/\*+/g, '')
    .replace(/_+/g, '')
    // Remove any remaining markdown symbols
    .replace(/[`~>\[\]()]/g, '')
    // Remove any dashes used as bullets
    .replace(/^\s*-\s+/gm, '')
    .replace(/\s+-\s+/g, ' ');
  
  // Second pass - use the main cleanup function
  cleaned = stripMarkup(cleaned);
  
  // Final cleanup - ensure proper sentence spacing but preserve paragraph breaks
  return cleaned
    .replace(/([.!?])\s*([A-Z])/g, '$1 $2')
    .replace(/[ \t]+/g, ' ') // Only replace spaces and tabs, not newlines
    .replace(/\n{3,}/g, '\n\n') // Limit to max 2 consecutive newlines
    .replace(/^\s+|\s+$/gm, '') // Trim each line
    .trim();
}

/**
 * Format text for display while preserving meaningful structure
 */
export function formatForDisplay(text: string): string {
  const cleaned = cleanAIResponse(text);
  
  // Preserve paragraph breaks and improve structure
  return cleaned
    // Convert markdown-style headers to proper formatting
    .replace(/\*\*(.*?)\*\*/g, '$1:') // **Strengths:** -> Strengths:
    // Ensure proper line breaks after sections
    .replace(/(Strengths|Weaknesses|Counterarguments|Conclusion):/gi, '\n\n$1:\n')
    // Clean up bullet points
    .replace(/^[\s]*[-*•]\s*/gm, '• ')
    // Split into paragraphs and clean
    .split('\n\n')
    .map(paragraph => paragraph.trim())
    .filter(paragraph => paragraph.length > 0)
    .join('\n\n');
}

/**
 * Split text into chunks of approximately targetWords words each
 * Attempts to break at sentence boundaries when possible
 */
import { TextChunk } from './types';

export function chunkText(text: string, targetWords: number = 1000): TextChunk[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const words = text.trim().split(/\s+/);
  
  // If text is shorter than target, return as single chunk
  if (words.length <= targetWords) {
    return [{
      id: 'chunk-1',
      content: text.trim(),
      wordCount: words.length,
      startIndex: 0,
      endIndex: text.length,
      preview: text.trim().substring(0, 100) + (text.length > 100 ? '...' : '')
    }];
  }

  const chunks: TextChunk[] = [];
  let currentIndex = 0;
  let chunkNumber = 1;

  while (currentIndex < words.length) {
    // Determine the end index for this chunk
    let endIndex = Math.min(currentIndex + targetWords, words.length);
    
    // Try to end at a sentence boundary if we're not at the very end
    if (endIndex < words.length) {
      // Look backwards from the target end to find a sentence ending
      for (let i = endIndex - 1; i >= currentIndex + Math.floor(targetWords * 0.8); i--) {
        const word = words[i];
        if (word.endsWith('.') || word.endsWith('!') || word.endsWith('?')) {
          endIndex = i + 1;
          break;
        }
      }
    }

    // Extract the chunk text
    const chunkWords = words.slice(currentIndex, endIndex);
    const chunkText = chunkWords.join(' ');
    
    // Create the chunk object
    chunks.push({
      id: `chunk-${chunkNumber}`,
      content: chunkText,
      wordCount: chunkWords.length,
      startIndex: currentIndex,
      endIndex: endIndex,
      preview: chunkText.substring(0, 100) + (chunkText.length > 100 ? '...' : '')
    });

    currentIndex = endIndex;
    chunkNumber++;
  }

  return chunks;
}