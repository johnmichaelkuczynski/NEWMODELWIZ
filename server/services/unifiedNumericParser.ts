/**
 * UNIFIED NUMERIC PARSER
 * 
 * Single function to extract numbers from any finance input format:
 * - Currency: "$1.25B", "$870m", "$900 million", "1.4bn", "750k"
 * - Multiples: "8x", "6.5x EBITDA", "4.0 ×", "4x revenue"
 * - Percentages: "17%", "12.5 %", "fifteen percent"
 * - Ranges: "$28–$32", "28-32" (returns midpoint)
 * - Shares: "4.5M shares", "90 million shares"
 * 
 * All outputs normalized to raw floats with type metadata.
 */

export type ParsedValueType = 'currency' | 'multiple' | 'percent' | 'shares' | 'raw';
export type ParsedValueUnit = 'EBITDA' | 'revenue' | 'EV' | 'shares' | null;

export interface ParsedNumericValue {
  raw: number;
  type: ParsedValueType;
  unit: ParsedValueUnit;
  original: string;
}

// Unit multipliers (convert to raw values, not millions)
const UNIT_MULTIPLIERS: Record<string, number> = {
  'b': 1_000_000_000,
  'bn': 1_000_000_000,
  'billion': 1_000_000_000,
  'm': 1_000_000,
  'mm': 1_000_000,
  'million': 1_000_000,
  'k': 1_000,
  'thousand': 1_000,
};

// Unit multipliers for "in millions" context (most finance models use millions internally)
const UNIT_MULTIPLIERS_MILLIONS: Record<string, number> = {
  'b': 1_000,      // 1B = 1000M
  'bn': 1_000,
  'billion': 1_000,
  'm': 1,          // 1M = 1M
  'mm': 1,
  'million': 1,
  'k': 0.001,      // 1K = 0.001M
  'thousand': 0.001,
};

/**
 * Parse a single numeric value from text, returning structured metadata
 */
export function parseNumericValue(text: string): ParsedNumericValue | null {
  if (!text || typeof text !== 'string') return null;
  
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Try each parser in order of specificity
  return parsePercentage(trimmed) 
    || parseMultiple(trimmed) 
    || parseCurrency(trimmed) 
    || parseShares(trimmed)
    || parseRange(trimmed)
    || parseRawNumber(trimmed);
}

/**
 * Parse percentage: "17%", "12.5 %", "0.17"
 */
function parsePercentage(text: string): ParsedNumericValue | null {
  // Pattern: number followed by % (with optional space)
  const percentMatch = text.match(/^([\d,.]+)\s*%$/i);
  if (percentMatch) {
    const value = parseFloat(percentMatch[1].replace(/,/g, ''));
    if (!isNaN(value)) {
      return {
        raw: value > 1 ? value / 100 : value, // Normalize to decimal
        type: 'percent',
        unit: null,
        original: text
      };
    }
  }
  
  // Pattern: "X percent"
  const percentWordMatch = text.match(/^([\d,.]+)\s*percent$/i);
  if (percentWordMatch) {
    const value = parseFloat(percentWordMatch[1].replace(/,/g, ''));
    if (!isNaN(value)) {
      return {
        raw: value > 1 ? value / 100 : value,
        type: 'percent',
        unit: null,
        original: text
      };
    }
  }
  
  return null;
}

/**
 * Parse multiple: "8x", "6.5x EBITDA", "4.0 ×", "4x revenue"
 */
function parseMultiple(text: string): ParsedNumericValue | null {
  // Pattern: number followed by x/× with optional unit
  const multipleMatch = text.match(/^([\d,.]+)\s*[x×]\s*(ebitda|revenue|ev)?$/i);
  if (multipleMatch) {
    const value = parseFloat(multipleMatch[1].replace(/,/g, ''));
    if (!isNaN(value)) {
      const unitStr = multipleMatch[2]?.toUpperCase();
      let unit: ParsedValueUnit = null;
      if (unitStr === 'EBITDA') unit = 'EBITDA';
      else if (unitStr === 'REVENUE') unit = 'revenue';
      else if (unitStr === 'EV') unit = 'EV';
      
      return {
        raw: value,
        type: 'multiple',
        unit,
        original: text
      };
    }
  }
  
  // Pattern: "X times EBITDA"
  const timesMatch = text.match(/^([\d,.]+)\s*times?\s*(ebitda|revenue|ev)?$/i);
  if (timesMatch) {
    const value = parseFloat(timesMatch[1].replace(/,/g, ''));
    if (!isNaN(value)) {
      const unitStr = timesMatch[2]?.toUpperCase();
      let unit: ParsedValueUnit = null;
      if (unitStr === 'EBITDA') unit = 'EBITDA';
      else if (unitStr === 'REVENUE') unit = 'revenue';
      else if (unitStr === 'EV') unit = 'EV';
      
      return {
        raw: value,
        type: 'multiple',
        unit,
        original: text
      };
    }
  }
  
  return null;
}

/**
 * Parse currency: "$1.25B", "$870m", "$900 million", "1.4bn", "750k"
 * Returns value in raw units (not millions)
 */
function parseCurrency(text: string): ParsedNumericValue | null {
  // Pattern: optional $ + number + unit (B/M/K/billion/million/thousand)
  const currencyMatch = text.match(/^\$?\s*([\d,.]+)\s*(b|bn|billion|m|mm|million|k|thousand)?$/i);
  if (currencyMatch) {
    let value = parseFloat(currencyMatch[1].replace(/,/g, ''));
    if (!isNaN(value)) {
      const unit = currencyMatch[2]?.toLowerCase();
      if (unit && UNIT_MULTIPLIERS[unit]) {
        value *= UNIT_MULTIPLIERS[unit];
      }
      return {
        raw: value,
        type: 'currency',
        unit: null,
        original: text
      };
    }
  }
  
  // Pattern: "X dollars"
  const dollarsMatch = text.match(/^\$?\s*([\d,.]+)\s*(b|bn|billion|m|mm|million|k|thousand)?\s*dollars?$/i);
  if (dollarsMatch) {
    let value = parseFloat(dollarsMatch[1].replace(/,/g, ''));
    if (!isNaN(value)) {
      const unit = dollarsMatch[2]?.toLowerCase();
      if (unit && UNIT_MULTIPLIERS[unit]) {
        value *= UNIT_MULTIPLIERS[unit];
      }
      return {
        raw: value,
        type: 'currency',
        unit: null,
        original: text
      };
    }
  }
  
  return null;
}

/**
 * Parse shares: "4.5M shares", "90 million shares"
 */
function parseShares(text: string): ParsedNumericValue | null {
  const sharesMatch = text.match(/^([\d,.]+)\s*(b|bn|billion|m|mm|million|k|thousand)?\s*shares?$/i);
  if (sharesMatch) {
    let value = parseFloat(sharesMatch[1].replace(/,/g, ''));
    if (!isNaN(value)) {
      const unit = sharesMatch[2]?.toLowerCase();
      if (unit && UNIT_MULTIPLIERS[unit]) {
        value *= UNIT_MULTIPLIERS[unit];
      }
      return {
        raw: value,
        type: 'shares',
        unit: 'shares',
        original: text
      };
    }
  }
  return null;
}

/**
 * Parse range: "$28–$32", "28-32" (returns midpoint)
 */
function parseRange(text: string): ParsedNumericValue | null {
  // Pattern: number dash/en-dash number
  const rangeMatch = text.match(/^\$?\s*([\d,.]+)\s*[-–—]\s*\$?\s*([\d,.]+)$/);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1].replace(/,/g, ''));
    const high = parseFloat(rangeMatch[2].replace(/,/g, ''));
    if (!isNaN(low) && !isNaN(high)) {
      return {
        raw: (low + high) / 2,
        type: 'currency',
        unit: null,
        original: text
      };
    }
  }
  return null;
}

/**
 * Parse raw number without units
 */
function parseRawNumber(text: string): ParsedNumericValue | null {
  const numMatch = text.match(/^([\d,.]+)$/);
  if (numMatch) {
    const value = parseFloat(numMatch[1].replace(/,/g, ''));
    if (!isNaN(value)) {
      return {
        raw: value,
        type: 'raw',
        unit: null,
        original: text
      };
    }
  }
  return null;
}


// ============ EXTRACTION FUNCTIONS FOR FINANCE MODELS ============

/**
 * Extract a numeric value from text using regex patterns
 * Returns raw value (in base units, e.g., actual dollars)
 */
export function extractValue(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const parsed = parseNumericValue(match[1]);
      if (parsed) return parsed.raw;
      
      // Fallback: direct parse with unit detection from full match
      let value = parseFloat(match[1].replace(/,/g, ''));
      if (isNaN(value)) continue;
      
      const fullMatch = match[0].toLowerCase();
      // Apply unit multipliers based on context
      if (fullMatch.includes('billion') || fullMatch.includes('bn') || /[\d.]+\s*b(?:[^a-z]|$)/i.test(fullMatch)) {
        value *= 1_000_000_000;
      } else if (fullMatch.includes('million') || /[\d.]+\s*m(?:m)?(?:[^a-z]|$)/i.test(fullMatch)) {
        value *= 1_000_000;
      } else if (fullMatch.includes('thousand') || /[\d.]+\s*k(?:[^a-z]|$)/i.test(fullMatch)) {
        value *= 1_000;
      }
      
      return value;
    }
  }
  return null;
}

/**
 * Extract money value from text, returning value IN MILLIONS
 * This is the primary function for finance models that work in millions
 */
export function extractMoney(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      let value = parseFloat(match[1].replace(/,/g, ''));
      if (isNaN(value)) continue;
      
      const fullMatch = match[0].toLowerCase();
      // B/billion: multiply by 1000 to get millions
      if (fullMatch.includes('billion') || fullMatch.includes('bn') || /[\d.]+\s*b(?:[^a-z]|$)/i.test(fullMatch)) {
        value *= 1000;
      }
      // M/million: already in millions, no change needed
      // K/thousand: divide by 1000 to get millions
      else if (fullMatch.includes('thousand') || /[\d.]+\s*k(?:[^a-z]|$)/i.test(fullMatch)) {
        value /= 1000;
      }
      
      return value;
    }
  }
  return null;
}

/**
 * Extract money with automatic unit detection (no patterns needed)
 * Returns value IN MILLIONS
 */
export function extractMoneyAuto(text: string): number | null {
  // Pattern for billions: $X.XXB, X.XXbn, X.XX billion
  const billionPatterns = [
    /\$?([\d,.]+)\s*[Bb](?:illion|n)?(?![a-z])/,
    /([\d,.]+)\s*billion/i,
  ];
  
  // Pattern for millions: $X.XXM, X.XXm, X.XX million
  const millionPatterns = [
    /\$?([\d,.]+)\s*[Mm](?:illion)?(?![a-z])/,
    /([\d,.]+)\s*million/i,
  ];
  
  // Pattern for thousands: $X.XXK, X.XXk, X.XX thousand
  const thousandPatterns = [
    /\$?([\d,.]+)\s*[Kk](?:thousand)?(?![a-z])/,
    /([\d,.]+)\s*thousand/i,
  ];

  // Check billions first (highest priority)
  for (const pattern of billionPatterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(value)) return value * 1000; // Convert to millions
    }
  }

  // Check millions
  for (const pattern of millionPatterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(value)) return value; // Already in millions
    }
  }
  
  // Check thousands
  for (const pattern of thousandPatterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(value)) return value / 1000; // Convert to millions
    }
  }

  return null;
}

/**
 * Extract a percentage from text
 * Returns decimal (e.g., 0.17 for 17%)
 */
export function extractPercent(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      let value = parseFloat(match[1].replace(/,/g, ''));
      if (isNaN(value)) continue;
      
      // Normalize: if > 1, assume it's a percentage and divide by 100
      if (value > 1) value /= 100;
      return value;
    }
  }
  return null;
}

/**
 * Extract a multiple from text (e.g., "8x EBITDA")
 * Returns the numeric multiple and optional unit
 */
export function extractMultiple(text: string, patterns: RegExp[]): { value: number; unit: ParsedValueUnit } | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const value = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(value)) {
        // Try to detect unit from full match
        const fullMatch = match[0].toLowerCase();
        let unit: ParsedValueUnit = null;
        if (fullMatch.includes('ebitda')) unit = 'EBITDA';
        else if (fullMatch.includes('revenue')) unit = 'revenue';
        else if (fullMatch.includes('ev')) unit = 'EV';
        
        return { value, unit };
      }
    }
  }
  return null;
}

/**
 * Extract a raw number from text (no unit conversion)
 */
export function extractNumber(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const value = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(value)) return value;
    }
  }
  return null;
}

/**
 * Extract shares count from text
 * Returns number of shares IN MILLIONS
 */
export function extractShares(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      let value = parseFloat(match[1].replace(/,/g, ''));
      if (isNaN(value)) continue;
      
      const fullMatch = match[0].toLowerCase();
      // Check for unit indicators
      if (fullMatch.includes('billion') || fullMatch.includes('bn') || /[\d.]+\s*b(?:[^a-z]|$)/i.test(fullMatch)) {
        value *= 1000; // Convert to millions
      } else if (fullMatch.includes('thousand') || /[\d.]+\s*k(?:[^a-z]|$)/i.test(fullMatch)) {
        value /= 1000; // Convert to millions
      }
      // M/million already in millions
      
      return value;
    }
  }
  return null;
}


// ============ UNIT TESTS ============

export function runUnifiedParserTests(): { passed: number; failed: number; results: string[] } {
  const tests: Array<{ input: string; expected: any; description: string }> = [
    // Currency tests
    { input: "$1.2B", expected: 1_200_000_000, description: "$1.2B → 1,200,000,000" },
    { input: "750m", expected: 750_000_000, description: "750m → 750,000,000" },
    { input: "$450 million", expected: 450_000_000, description: "$450 million → 450,000,000" },
    { input: "1.4bn", expected: 1_400_000_000, description: "1.4bn → 1,400,000,000" },
    { input: "750k", expected: 750_000, description: "750k → 750,000" },
    
    // Multiple tests
    { input: "8x EBITDA", expected: { raw: 8, type: 'multiple', unit: 'EBITDA' }, description: "8x EBITDA → {raw: 8, type: 'multiple', unit: 'EBITDA'}" },
    { input: "6.5x", expected: { raw: 6.5, type: 'multiple', unit: null }, description: "6.5x → {raw: 6.5, type: 'multiple'}" },
    { input: "4x revenue", expected: { raw: 4, type: 'multiple', unit: 'revenue' }, description: "4x revenue → {raw: 4, unit: 'revenue'}" },
    
    // Percentage tests
    { input: "9%", expected: 0.09, description: "9% → 0.09" },
    { input: "17%", expected: 0.17, description: "17% → 0.17" },
    { input: "12.5 %", expected: 0.125, description: "12.5 % → 0.125" },
    
    // Shares tests
    { input: "4.5M shares", expected: 4_500_000, description: "4.5M shares → 4,500,000" },
    { input: "90 million shares", expected: 90_000_000, description: "90 million shares → 90,000,000" },
    
    // Range tests
    { input: "$28–$32", expected: 30, description: "$28–$32 → 30 (midpoint)" },
  ];
  
  let passed = 0;
  let failed = 0;
  const results: string[] = [];
  
  for (const test of tests) {
    const parsed = parseNumericValue(test.input);
    let success = false;
    
    if (typeof test.expected === 'object') {
      // Object comparison for multiples
      success = parsed !== null && 
        parsed.raw === test.expected.raw && 
        parsed.type === test.expected.type &&
        parsed.unit === test.expected.unit;
    } else {
      // Simple number comparison
      success = parsed !== null && Math.abs(parsed.raw - test.expected) < 0.001;
    }
    
    if (success) {
      passed++;
      results.push(`✓ ${test.description}`);
    } else {
      failed++;
      results.push(`✗ ${test.description} - got ${parsed ? JSON.stringify({ raw: parsed.raw, type: parsed.type, unit: parsed.unit }) : 'null'}`);
    }
  }
  
  return { passed, failed, results };
}
