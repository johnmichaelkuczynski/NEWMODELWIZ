/**
 * Server-side utility functions for text processing and cleanup
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
  
  // Final cleanup - ensure proper sentence spacing and remove extra spaces
  return cleaned
    .replace(/([.!?])\s*([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .replace(/^\s+|\s+$/gm, '')
    .trim();
}

/**
 * Format text for display while preserving meaningful structure
 */
export function formatForDisplay(text: string): string {
  const cleaned = cleanAIResponse(text);
  
  // Preserve paragraph breaks
  return cleaned
    .split('\n\n')
    .map(paragraph => paragraph.trim())
    .filter(paragraph => paragraph.length > 0)
    .join('\n\n');
}