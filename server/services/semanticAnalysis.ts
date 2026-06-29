import { createHash } from 'crypto';

export interface TextUnit {
  id: string;
  index: number;
  content: string;
  type: 'sentence' | 'paragraph';
  semanticDensity: number;
  tokenEntropy: number;
  lexicalRarity: number;
  embeddingDistinctiveness: number;
}

export interface SemanticAnalysisResult {
  sentences: TextUnit[];
  paragraphs: TextUnit[];
  statistics: {
    sentences: UnitStatistics;
    paragraphs: UnitStatistics;
  };
}

export interface UnitStatistics {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  densest: TextUnit[];
  flabbiest: TextUnit[];
}

/**
 * Split text into sentences using a simple but effective approach
 */
function splitIntoSentences(text: string): string[] {
  // Handle common abbreviations that shouldn't end sentences
  const abbreviations = /\b(?:Dr|Mr|Mrs|Ms|Prof|Sr|Jr|vs|etc|i\.e|e\.g|cf|al|Inc|Ltd|Corp|Co|St|Ave|Blvd|Rd|Ph\.D|M\.D|B\.A|M\.A|D\.D\.S|R\.N|C\.P\.A|U\.S|U\.K|U\.N|N\.Y|L\.A|D\.C|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Mon|Tue|Wed|Thu|Fri|Sat|Sun|a\.m|p\.m|A\.M|P\.M)\./gi;
  
  // Replace abbreviations with temporary placeholders
  const placeholders: { [key: string]: string } = {};
  let placeholderIndex = 0;
  
  const textWithPlaceholders = text.replace(abbreviations, (match) => {
    const placeholder = `__ABBREV_${placeholderIndex++}__`;
    placeholders[placeholder] = match;
    return placeholder;
  });
  
  // Split on sentence-ending punctuation followed by whitespace or end of string
  const sentences = textWithPlaceholders
    .split(/[.!?]+(?=\s+[A-Z]|$)/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  // Restore abbreviations
  return sentences.map(sentence => {
    let restored = sentence;
    Object.entries(placeholders).forEach(([placeholder, original]) => {
      restored = restored.replace(new RegExp(placeholder, 'g'), original);
    });
    return restored;
  });
}

/**
 * Split text into paragraphs
 */
function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map(p => p.trim().replace(/\n/g, ' '))
    .filter(p => p.length > 0);
}

/**
 * Compute Shannon entropy of token distribution
 */
function computeTokenEntropy(text: string): number {
  const tokens = text.toLowerCase().match(/\b\w+\b/g) || [];
  if (tokens.length === 0) return 0;
  
  const tokenCounts: { [key: string]: number } = {};
  tokens.forEach(token => {
    tokenCounts[token] = (tokenCounts[token] || 0) + 1;
  });
  
  const totalTokens = tokens.length;
  let entropy = 0;
  
  Object.values(tokenCounts).forEach(count => {
    const probability = count / totalTokens;
    entropy -= probability * Math.log2(probability);
  });
  
  return entropy;
}

/**
 * Compute lexical rarity score based on word frequency
 * Uses a simplified frequency model based on common English words
 */
function computeLexicalRarity(text: string): number {
  const tokens = text.toLowerCase().match(/\b\w+\b/g) || [];
  if (tokens.length === 0) return 0;
  
  // Common English words frequency tiers (simplified model)
  const commonWords = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 
    'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 
    'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my',
    'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if',
    'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like',
    'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year',
    'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then',
    'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back',
    'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
    'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us'
  ]);
  
  const frequentWords = new Set([
    'man', 'own', 'old', 'here', 'right', 'still', 'should', 'around', 'such',
    'through', 'where', 'much', 'before', 'move', 'three', 'being', 'public',
    'put', 'end', 'why', 'turn', 'every', 'start', 'place', 'made', 'live',
    'general', 'being', 'here', 'case', 'most', 'week', 'company', 'where',
    'system', 'each', 'right', 'program', 'hear', 'question', 'during', 'work',
    'play', 'government', 'run', 'small', 'number', 'off', 'always', 'move',
    'night', 'live', 'point', 'today', 'bring', 'happen', 'next', 'without',
    'before', 'large', 'all', 'million', 'must', 'home', 'under', 'water',
    'might', 'last', 'another', 'while', 'where', 'every', 'right', 'study',
    'book', 'eye', 'job', 'word', 'though', 'business', 'issue', 'side',
    'kind', 'head', 'house', 'service', 'friend', 'father', 'power', 'hour',
    'game', 'line', 'end', 'member', 'law', 'car', 'city', 'community',
    'name', 'president', 'team', 'minute', 'idea', 'kid', 'body', 'information',
    'back', 'parent', 'face', 'others', 'level', 'office', 'door', 'health',
    'person', 'art', 'war', 'history', 'party', 'within', 'grow', 'result',
    'open', 'change', 'morning', 'walk', 'reason', 'low', 'win', 'research',
    'girl', 'guy', 'early', 'food', 'before', 'moment', 'himself', 'air',
    'teacher', 'force', 'offer'
  ]);
  
  let totalRarity = 0;
  tokens.forEach(token => {
    if (commonWords.has(token)) {
      totalRarity += 0.1; // Very common words
    } else if (frequentWords.has(token)) {
      totalRarity += 0.3; // Frequent words
    } else if (token.length <= 3) {
      totalRarity += 0.4; // Short words tend to be common
    } else if (token.length >= 8) {
      totalRarity += 0.8; // Long words tend to be rare
    } else {
      totalRarity += 0.5; // Medium rarity
    }
  });
  
  return totalRarity / tokens.length;
}

/**
 * Compute embedding distinctiveness using a simple heuristic
 * In a real implementation, this would use actual embeddings
 */
function computeEmbeddingDistinctiveness(text: string): number {
  // Simple heuristic based on text characteristics
  const tokens = text.toLowerCase().match(/\b\w+\b/g) || [];
  if (tokens.length === 0) return 0;
  
  // Factors that contribute to distinctiveness
  let distinctiveness = 0;
  
  // Vocabulary diversity
  const uniqueTokens = new Set(tokens);
  const vocabularyRatio = uniqueTokens.size / tokens.length;
  distinctiveness += vocabularyRatio * 0.3;
  
  // Sentence complexity (punctuation density)
  const punctuationCount = (text.match(/[.,;:!?]/g) || []).length;
  const punctuationDensity = punctuationCount / text.length;
  distinctiveness += Math.min(punctuationDensity * 50, 0.3);
  
  // Word length variation
  const wordLengths = tokens.map(t => t.length);
  const avgLength = wordLengths.reduce((a, b) => a + b, 0) / wordLengths.length;
  const lengthVariance = wordLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / wordLengths.length;
  distinctiveness += Math.min(lengthVariance / 10, 0.4);
  
  return Math.min(distinctiveness, 1.0);
}

/**
 * Compute semantic density score for a text unit
 */
function computeSemanticDensity(text: string): {
  semanticDensity: number;
  tokenEntropy: number;
  lexicalRarity: number;
  embeddingDistinctiveness: number;
} {
  const tokenEntropy = computeTokenEntropy(text);
  const lexicalRarity = computeLexicalRarity(text);
  const embeddingDistinctiveness = computeEmbeddingDistinctiveness(text);
  
  // Normalize token entropy (typical range 0-8, normalize to 0-1)
  const normalizedEntropy = Math.min(tokenEntropy / 8, 1.0);
  
  const semanticDensity = 
    0.4 * normalizedEntropy +
    0.3 * lexicalRarity +
    0.3 * embeddingDistinctiveness;
  
  return {
    semanticDensity: Math.min(semanticDensity, 1.0),
    tokenEntropy: normalizedEntropy,
    lexicalRarity,
    embeddingDistinctiveness
  };
}

/**
 * Compute statistics for a collection of text units
 */
function computeStatistics(units: TextUnit[]): UnitStatistics {
  if (units.length === 0) {
    return {
      mean: 0,
      stdDev: 0,
      min: 0,
      max: 0,
      densest: [],
      flabbiest: []
    };
  }
  
  const scores = units.map(u => u.semanticDensity);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  
  // Sort for top/bottom units
  const sorted = [...units].sort((a, b) => b.semanticDensity - a.semanticDensity);
  const densest = sorted.slice(0, 3);
  const flabbiest = sorted.slice(-3).reverse();
  
  return {
    mean,
    stdDev,
    min,
    max,
    densest,
    flabbiest
  };
}

/**
 * Main function to analyze semantic density of text
 */
export async function analyzeSemanticDensity(text: string): Promise<SemanticAnalysisResult> {
  // Split text into units
  const sentenceTexts = splitIntoSentences(text);
  const paragraphTexts = splitIntoParagraphs(text);
  
  // Process sentences
  const sentences: TextUnit[] = sentenceTexts.map((content, index) => {
    const scores = computeSemanticDensity(content);
    return {
      id: `sentence_${index + 1}`,
      index: index + 1,
      content,
      type: 'sentence' as const,
      ...scores
    };
  });
  
  // Process paragraphs
  const paragraphs: TextUnit[] = paragraphTexts.map((content, index) => {
    const scores = computeSemanticDensity(content);
    return {
      id: `paragraph_${index + 1}`,
      index: index + 1,
      content,
      type: 'paragraph' as const,
      ...scores
    };
  });
  
  // Compute statistics
  const statistics = {
    sentences: computeStatistics(sentences),
    paragraphs: computeStatistics(paragraphs)
  };
  
  return {
    sentences,
    paragraphs,
    statistics
  };
}