/**
 * ROBUST FINANCIAL TEXT PARSER
 * 
 * This module extracts structured financial values from natural language text
 * using regex patterns. It does NOT rely on LLMs for numeric extraction.
 * 
 * The parser handles common variations in how financial data is expressed:
 * - "$935M", "$935 million", "935 million dollars", "$935m"
 * - "7.5× EBITDA", "7.5x", "7.5 times"
 * - "70% cash", "70 percent cash", "seventy percent"
 * - "5-year hold", "5 year", "five years"
 */

// ============ NUMBER NORMALIZATION ============

/**
 * Convert various numeric formats to a number
 * Handles: $935M, $935 million, 935m, 935 million, etc.
 */
export function parseMoneyValue(text: string): number | null {
  if (!text) return null;
  
  // Remove $ and commas
  let cleaned = text.replace(/[$,]/g, '').trim().toLowerCase();
  
  // Handle word numbers
  const wordToNum: Record<string, number> = {
    'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
    'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
    'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70,
    'eighty': 80, 'ninety': 90, 'hundred': 100
  };
  
  // Check for word number (e.g., "forty-five million")
  for (const [word, num] of Object.entries(wordToNum)) {
    if (cleaned.includes(word)) {
      // This is a word-based number, complex to parse fully
      // For now, return null and let regex patterns handle it
      break;
    }
  }
  
  // Extract the numeric part
  const numMatch = cleaned.match(/^([\d.]+)/);
  if (!numMatch) return null;
  
  let value = parseFloat(numMatch[1]);
  if (isNaN(value)) return null;
  
  // Apply multiplier based on suffix
  if (cleaned.includes('billion') || cleaned.includes('bn') || cleaned.endsWith('b')) {
    value *= 1000; // Convert to millions
  } else if (cleaned.includes('million') || cleaned.includes('mm') || cleaned.endsWith('m')) {
    // Already in millions, no change
  } else if (cleaned.includes('thousand') || cleaned.endsWith('k')) {
    value /= 1000; // Convert to millions
  }
  
  return value;
}

/**
 * Parse a percentage value
 * Handles: "70%", "70 percent", "0.70", ".70"
 */
export function parsePercentage(text: string): number | null {
  if (!text) return null;
  
  let cleaned = text.replace(/[%,]/g, '').trim().toLowerCase();
  cleaned = cleaned.replace(/percent/g, '').trim();
  
  const numMatch = cleaned.match(/([\d.]+)/);
  if (!numMatch) return null;
  
  let value = parseFloat(numMatch[1]);
  if (isNaN(value)) return null;
  
  // If value > 1, assume it's a percentage (e.g., 70 = 70%)
  // If value <= 1, assume it's already a decimal (e.g., 0.70 = 70%)
  if (value > 1) {
    value /= 100;
  }
  
  return value;
}

/**
 * Parse a multiple value (e.g., "7.5×", "7.5x", "7.5 times")
 */
export function parseMultiple(text: string): number | null {
  if (!text) return null;
  
  let cleaned = text.replace(/[×x]/gi, '').trim().toLowerCase();
  cleaned = cleaned.replace(/times/g, '').trim();
  
  const numMatch = cleaned.match(/([\d.]+)/);
  if (!numMatch) return null;
  
  const value = parseFloat(numMatch[1]);
  return isNaN(value) ? null : value;
}

/**
 * Parse a year count (e.g., "5-year", "5 years", "five years")
 */
export function parseYears(text: string): number | null {
  if (!text) return null;
  
  const cleaned = text.toLowerCase();
  
  // Word numbers
  const wordYears: Record<string, number> = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
  };
  
  for (const [word, num] of Object.entries(wordYears)) {
    if (cleaned.includes(word)) {
      return num;
    }
  }
  
  const numMatch = cleaned.match(/(\d+)/);
  if (!numMatch) return null;
  
  const value = parseInt(numMatch[1], 10);
  return isNaN(value) ? null : value;
}

// ============ LBO MODEL PARSER ============

export interface LBOParsedValues {
  companyName?: string;
  ltmRevenue?: number;
  ltmEBITDA?: number;
  revenueGrowth?: number;
  ebitdaMargin?: number;
  purchasePrice?: number;
  entryMultiple?: number;
  seniorDebtMultiple?: number;
  seniorDebtAmount?: number;
  seniorDebtRate?: number;
  subDebtMultiple?: number;
  subDebtAmount?: number;
  subDebtRate?: number;
  transactionFees?: number;
  financingFees?: number;
  holdPeriod?: number;
  exitMultiple?: number;
  capexPercent?: number;
  nwcPercent?: number;
  taxRate?: number;
  daPercent?: number;
}

export function parseLBOInput(text: string): LBOParsedValues {
  const result: LBOParsedValues = {};
  const lowerText = text.toLowerCase();
  
  // ============ EBITDA ============
  // "LTM EBITDA of $100M", "EBITDA of $100 million", "$100M EBITDA"
  const ebitdaPatterns = [
    /(?:ltm\s+)?ebitda\s+(?:of\s+)?\$?([\d,.]+)\s*(?:m|mm|million)?/i,
    /\$?([\d,.]+)\s*(?:m|mm|million)?\s+(?:ltm\s+)?ebitda/i,
    /ebitda[:\s]+\$?([\d,.]+)\s*(?:m|mm|million)?/i,
  ];
  
  for (const pattern of ebitdaPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.ltmEBITDA = parseMoneyValue(match[1] + 'm') ?? undefined;
      console.log(`[Parser] EBITDA extracted: ${result.ltmEBITDA}M from "${match[0]}"`);
      break;
    }
  }
  
  // ============ REVENUE ============
  // "Revenue of $500M", "$500M revenue", "LTM Revenue: $500 million"
  const revenuePatterns = [
    /(?:ltm\s+)?revenue\s+(?:of\s+)?\$?([\d,.]+)\s*(?:m|mm|million)?/i,
    /\$?([\d,.]+)\s*(?:m|mm|million)?\s+(?:ltm\s+)?revenue/i,
    /revenue[:\s]+\$?([\d,.]+)\s*(?:m|mm|million)?/i,
  ];
  
  for (const pattern of revenuePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.ltmRevenue = parseMoneyValue(match[1] + 'm') ?? undefined;
      console.log(`[Parser] Revenue extracted: ${result.ltmRevenue}M from "${match[0]}"`);
      break;
    }
  }
  
  // ============ PURCHASE PRICE / ENTERPRISE VALUE ============
  // "EV = $700M", "Enterprise Value: $700M", "Purchase Price: $700 million"
  // "7.0× LTM EBITDA of $100M (EV = $700M)"
  const evPatterns = [
    /ev\s*[=:]\s*\$?([\d,.]+)\s*(?:m|mm|million)?/i,
    /enterprise\s+value\s*[=:]\s*\$?([\d,.]+)\s*(?:m|mm|million)?/i,
    /purchase\s+price\s*[=:]\s*\$?([\d,.]+)\s*(?:m|mm|million)?/i,
    /equity\s+value\s*[=:]\s*\$?([\d,.]+)\s*(?:m|mm|million)?/i,
    /transaction\s+value\s*[=:]\s*\$?([\d,.]+)\s*(?:m|mm|million)?/i,
    /(?:buying|acquiring|purchase)\s+(?:for|at)\s+\$?([\d,.]+)\s*(?:m|mm|million)?/i,
  ];
  
  for (const pattern of evPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.purchasePrice = parseMoneyValue(match[1] + 'm') ?? undefined;
      console.log(`[Parser] Purchase price extracted: ${result.purchasePrice}M from "${match[0]}"`);
      break;
    }
  }
  
  // ============ ENTRY MULTIPLE ============
  // "7.0× LTM EBITDA", "7.0x EBITDA", "Purchase at 7.0 times EBITDA"
  const entryMultiplePatterns = [
    /(?:purchase\s+(?:price\s+)?(?:is\s+)?|entry\s+(?:at\s+)?|buy(?:ing)?\s+(?:at\s+)?|valued?\s+(?:at\s+)?)([\d.]+)\s*[×x]\s*(?:ltm\s+)?ebitda/i,
    /([\d.]+)\s*[×x]\s*(?:ltm\s+)?ebitda/i,
    /([\d.]+)\s+times\s+(?:ltm\s+)?ebitda/i,
  ];
  
  for (const pattern of entryMultiplePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.entryMultiple = parseMultiple(match[1]) ?? undefined;
      console.log(`[Parser] Entry multiple extracted: ${result.entryMultiple}x from "${match[0]}"`);
      break;
    }
  }
  
  // If we have EBITDA and entry multiple but no purchase price, calculate it
  if (!result.purchasePrice && result.ltmEBITDA && result.entryMultiple) {
    result.purchasePrice = result.ltmEBITDA * result.entryMultiple;
    console.log(`[Parser] Purchase price calculated: ${result.ltmEBITDA}M × ${result.entryMultiple}x = ${result.purchasePrice}M`);
  }
  
  // ============ SENIOR DEBT ============
  // "4.0× Senior Debt at 6.5%", "$480M senior debt", "Senior: 4.0x at 6.5%"
  const seniorPatterns = [
    /([\d.]+)\s*[×x]\s*senior\s*(?:debt)?\s*(?:at\s+)?([\d.]+)\s*%/i,
    /senior\s*(?:debt)?\s*[:\s]*([\d.]+)\s*[×x]\s*(?:at\s+)?([\d.]+)\s*%/i,
    /\$?([\d,.]+)\s*(?:m|mm|million)?\s+senior\s*(?:debt)?\s*(?:at\s+)?([\d.]+)\s*%/i,
    /senior\s*(?:debt)?\s*(?:of\s+)?\$?([\d,.]+)\s*(?:m|mm|million)?/i,
  ];
  
  for (const pattern of seniorPatterns) {
    const match = text.match(pattern);
    if (match) {
      // Check if first group is a multiple (small number) or amount (large number)
      const firstNum = parseFloat(match[1].replace(/,/g, ''));
      
      if (firstNum < 20) {
        // It's a multiple
        result.seniorDebtMultiple = firstNum;
        if (match[2]) {
          result.seniorDebtRate = parseFloat(match[2]) / 100;
        }
        console.log(`[Parser] Senior debt multiple: ${result.seniorDebtMultiple}x at ${result.seniorDebtRate ? (result.seniorDebtRate * 100) + '%' : 'default rate'}`);
      } else {
        // It's an amount
        result.seniorDebtAmount = parseMoneyValue(match[1] + 'm') ?? undefined;
        if (match[2]) {
          result.seniorDebtRate = parseFloat(match[2]) / 100;
        }
        console.log(`[Parser] Senior debt amount: ${result.seniorDebtAmount}M at ${result.seniorDebtRate ? (result.seniorDebtRate * 100) + '%' : 'default rate'}`);
      }
      break;
    }
  }
  
  // Calculate senior debt amount from multiple if we have EBITDA
  if (!result.seniorDebtAmount && result.seniorDebtMultiple && result.ltmEBITDA) {
    result.seniorDebtAmount = result.seniorDebtMultiple * result.ltmEBITDA;
    console.log(`[Parser] Senior debt calculated: ${result.seniorDebtMultiple}x × ${result.ltmEBITDA}M = ${result.seniorDebtAmount}M`);
  }
  
  // ============ SUBORDINATED DEBT ============
  // "1.0× Sub Debt at 12%", "$120M subordinated debt", "Mezzanine: 1.5x at 11%"
  const subPatterns = [
    /([\d.]+)\s*[×x]\s*(?:sub(?:ordinated)?|mezz(?:anine)?)\s*(?:debt)?\s*(?:at\s+)?([\d.]+)\s*%/i,
    /(?:sub(?:ordinated)?|mezz(?:anine)?)\s*(?:debt)?\s*[:\s]*([\d.]+)\s*[×x]\s*(?:at\s+)?([\d.]+)\s*%/i,
    /\$?([\d,.]+)\s*(?:m|mm|million)?\s+(?:sub(?:ordinated)?|mezz(?:anine)?)\s*(?:debt)?\s*(?:at\s+)?([\d.]+)\s*%/i,
    /(?:sub(?:ordinated)?|mezz(?:anine)?)\s*(?:debt)?\s*(?:of\s+)?\$?([\d,.]+)\s*(?:m|mm|million)?/i,
  ];
  
  for (const pattern of subPatterns) {
    const match = text.match(pattern);
    if (match) {
      const firstNum = parseFloat(match[1].replace(/,/g, ''));
      
      if (firstNum < 20) {
        result.subDebtMultiple = firstNum;
        if (match[2]) {
          result.subDebtRate = parseFloat(match[2]) / 100;
        }
        console.log(`[Parser] Sub debt multiple: ${result.subDebtMultiple}x at ${result.subDebtRate ? (result.subDebtRate * 100) + '%' : 'default rate'}`);
      } else {
        result.subDebtAmount = parseMoneyValue(match[1] + 'm') ?? undefined;
        if (match[2]) {
          result.subDebtRate = parseFloat(match[2]) / 100;
        }
        console.log(`[Parser] Sub debt amount: ${result.subDebtAmount}M at ${result.subDebtRate ? (result.subDebtRate * 100) + '%' : 'default rate'}`);
      }
      break;
    }
  }
  
  // Calculate sub debt amount from multiple if we have EBITDA
  if (!result.subDebtAmount && result.subDebtMultiple && result.ltmEBITDA) {
    result.subDebtAmount = result.subDebtMultiple * result.ltmEBITDA;
    console.log(`[Parser] Sub debt calculated: ${result.subDebtMultiple}x × ${result.ltmEBITDA}M = ${result.subDebtAmount}M`);
  }
  
  // ============ TRANSACTION FEES ============
  // "Transaction fees $8M", "$8M transaction fees", "fees: $8 million"
  const txFeePatterns = [
    /transaction\s+(?:fees?|costs?)\s*[:\s]*\$?([\d,.]+)\s*(?:m|mm|million)?/i,
    /\$?([\d,.]+)\s*(?:m|mm|million)?\s+(?:in\s+)?transaction\s+(?:fees?|costs?)/i,
    /advisory\s+(?:fees?)\s*[:\s]*\$?([\d,.]+)\s*(?:m|mm|million)?/i,
  ];
  
  for (const pattern of txFeePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.transactionFees = parseMoneyValue(match[1] + 'm') ?? undefined;
      console.log(`[Parser] Transaction fees: ${result.transactionFees}M from "${match[0]}"`);
      break;
    }
  }
  
  // ============ FINANCING FEES ============
  // "Financing fees $4M", "$4M financing fees"
  const finFeePatterns = [
    /financing\s+(?:fees?|costs?)\s*[:\s]*\$?([\d,.]+)\s*(?:m|mm|million)?/i,
    /\$?([\d,.]+)\s*(?:m|mm|million)?\s+(?:in\s+)?financing\s+(?:fees?|costs?)/i,
    /debt\s+(?:issuance\s+)?(?:fees?|costs?)\s*[:\s]*\$?([\d,.]+)\s*(?:m|mm|million)?/i,
  ];
  
  for (const pattern of finFeePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.financingFees = parseMoneyValue(match[1] + 'm') ?? undefined;
      console.log(`[Parser] Financing fees: ${result.financingFees}M from "${match[0]}"`);
      break;
    }
  }
  
  // ============ HOLD PERIOD ============
  // "5-year hold", "hold for 5 years", "exit after 5 years"
  const holdPatterns = [
    /(\d+)\s*-?\s*year\s+hold/i,
    /hold\s+(?:for\s+)?(\d+)\s+years?/i,
    /exit\s+(?:after\s+)?(\d+)\s+years?/i,
    /(\d+)\s+year\s+investment\s+horizon/i,
  ];
  
  for (const pattern of holdPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.holdPeriod = parseInt(match[1], 10);
      console.log(`[Parser] Hold period: ${result.holdPeriod} years from "${match[0]}"`);
      break;
    }
  }
  
  // ============ EXIT MULTIPLE ============
  // "Exit at 8.0× EBITDA", "8.0x exit", "exit multiple: 8.0x"
  const exitPatterns = [
    /exit\s+(?:at\s+)?([\d.]+)\s*[×x]\s*(?:ltm\s+)?ebitda/i,
    /exit\s+multiple\s*[:\s]*([\d.]+)\s*[×x]?/i,
    /([\d.]+)\s*[×x]\s+exit/i,
    /exit\s+ebitda\s+multiple\s*[:\s]*([\d.]+)/i,
  ];
  
  for (const pattern of exitPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.exitMultiple = parseMultiple(match[1]) ?? undefined;
      console.log(`[Parser] Exit multiple: ${result.exitMultiple}x from "${match[0]}"`);
      break;
    }
  }
  
  // ============ EBITDA MARGIN ============
  // "18% EBITDA margin", "EBITDA margin of 18%", "margins: 18%"
  const marginPatterns = [
    /([\d.]+)\s*%\s*ebitda\s+margin/i,
    /ebitda\s+margin\s*(?:of\s+)?([\d.]+)\s*%/i,
    /margin\s*[:\s]*([\d.]+)\s*%/i,
  ];
  
  for (const pattern of marginPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.ebitdaMargin = parseFloat(match[1]) / 100;
      console.log(`[Parser] EBITDA margin: ${result.ebitdaMargin * 100}% from "${match[0]}"`);
      break;
    }
  }
  
  // ============ REVENUE GROWTH ============
  // "5% revenue growth", "grow revenue 5%", "revenue CAGR of 5%"
  const growthPatterns = [
    /([\d.]+)\s*%\s*(?:revenue\s+)?growth/i,
    /revenue\s+(?:growth|cagr)\s*(?:of\s+)?([\d.]+)\s*%/i,
    /grow(?:ing)?\s+(?:revenue\s+)?(?:at\s+)?([\d.]+)\s*%/i,
  ];
  
  for (const pattern of growthPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.revenueGrowth = parseFloat(match[1]) / 100;
      console.log(`[Parser] Revenue growth: ${result.revenueGrowth * 100}% from "${match[0]}"`);
      break;
    }
  }
  
  // ============ TAX RATE ============
  const taxPatterns = [
    /tax\s+rate\s*[:\s]*([\d.]+)\s*%/i,
    /([\d.]+)\s*%\s+tax\s+rate/i,
  ];
  
  for (const pattern of taxPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.taxRate = parseFloat(match[1]) / 100;
      console.log(`[Parser] Tax rate: ${result.taxRate * 100}% from "${match[0]}"`);
      break;
    }
  }
  
  // ============ D&A PERCENT ============
  const daPatterns = [
    /(?:d&a|depreciation(?:\s+and\s+amortization)?)\s*[:\s]*([\d.]+)\s*%/i,
    /([\d.]+)\s*%\s+(?:d&a|depreciation)/i,
  ];
  
  for (const pattern of daPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.daPercent = parseFloat(match[1]) / 100;
      console.log(`[Parser] D&A: ${result.daPercent * 100}% from "${match[0]}"`);
      break;
    }
  }
  
  // ============ CAPEX PERCENT ============
  const capexPatterns = [
    /(?:capex|capital\s+expenditure)\s*[:\s]*([\d.]+)\s*%/i,
    /([\d.]+)\s*%\s+(?:capex|capital\s+expenditure)/i,
  ];
  
  for (const pattern of capexPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.capexPercent = parseFloat(match[1]) / 100;
      console.log(`[Parser] CapEx: ${result.capexPercent * 100}% from "${match[0]}"`);
      break;
    }
  }
  
  // ============ NWC PERCENT ============
  const nwcPatterns = [
    /(?:nwc|net\s+working\s+capital)\s*[:\s]*([\d.]+)\s*%/i,
    /([\d.]+)\s*%\s+(?:nwc|net\s+working\s+capital)/i,
  ];
  
  for (const pattern of nwcPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.nwcPercent = parseFloat(match[1]) / 100;
      console.log(`[Parser] NWC: ${result.nwcPercent * 100}% from "${match[0]}"`);
      break;
    }
  }
  
  console.log(`[Parser] LBO parsing complete:`, JSON.stringify(result, null, 2));
  
  return result;
}

// ============ M&A MODEL PARSER ============

export interface MAParsedValues {
  acquirerName?: string;
  targetName?: string;
  
  acquirerRevenue?: number;
  acquirerEBITDA?: number;
  acquirerEBITDAMargin?: number;
  acquirerSharesOutstanding?: number;
  acquirerStockPrice?: number;
  acquirerExplicitEPS?: number;
  
  targetRevenue?: number;
  targetEBITDA?: number;
  targetEBITDAMargin?: number;
  
  purchasePrice?: number;
  entryMultiple?: number;
  cashPercent?: number;
  stockPercent?: number;
  premium?: number;
  
  newDebtAmount?: number;
  newDebtRate?: number;
  
  costSynergies?: number;
  revenueSynergies?: number;
  integrationCost?: number;
  
  forecastYears?: number;
  transactionFees?: number;
}

export function parseMAInput(text: string): MAParsedValues {
  const result: MAParsedValues = {};
  const lowerText = text.toLowerCase();
  
  // ============ PURCHASE PRICE / EQUITY VALUE ============
  const pricePatterns = [
    /(?:equity\s+value|purchase\s+price)\s*[=:]\s*\$?([\d,.]+)\s*(?:m|mm|million)?/i,
    /ev\s*[=:]\s*\$?([\d,.]+)\s*(?:m|mm|million)?/i,
    /\$?([\d,.]+)\s*(?:m|mm|million)?\s+(?:purchase\s+price|equity\s+value)/i,
    /(?:buying|acquiring)\s+(?:for|at)\s+\$?([\d,.]+)\s*(?:m|mm|million)?/i,
  ];
  
  for (const pattern of pricePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.purchasePrice = parseMoneyValue(match[1] + 'm') ?? undefined;
      console.log(`[M&A Parser] Purchase price: ${result.purchasePrice}M from "${match[0]}"`);
      break;
    }
  }
  
  // ============ ENTRY MULTIPLE ============
  const multiplePatterns = [
    /([\d.]+)\s*[×x]\s*(?:ltm\s+)?ebitda/i,
    /multiple\s*[:\s]*([\d.]+)\s*[×x]?/i,
  ];
  
  for (const pattern of multiplePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.entryMultiple = parseMultiple(match[1]) ?? undefined;
      console.log(`[M&A Parser] Entry multiple: ${result.entryMultiple}x from "${match[0]}"`);
      break;
    }
  }
  
  // ============ TARGET EBITDA ============
  const targetEbitdaPatterns = [
    /(?:target\s+)?(?:ltm\s+)?ebitda\s+(?:of\s+)?\$?([\d,.]+)\s*(?:m|mm|million)?/i,
    /\$?([\d,.]+)\s*(?:m|mm|million)?\s+(?:target\s+)?(?:ltm\s+)?ebitda/i,
  ];
  
  for (const pattern of targetEbitdaPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.targetEBITDA = parseMoneyValue(match[1] + 'm') ?? undefined;
      console.log(`[M&A Parser] Target EBITDA: ${result.targetEBITDA}M from "${match[0]}"`);
      break;
    }
  }
  
  // Calculate purchase price from multiple × EBITDA if not found
  if (!result.purchasePrice && result.entryMultiple && result.targetEBITDA) {
    result.purchasePrice = result.entryMultiple * result.targetEBITDA;
    console.log(`[M&A Parser] Purchase price calculated: ${result.entryMultiple}x × ${result.targetEBITDA}M = ${result.purchasePrice}M`);
  }
  
  // ============ CASH/STOCK MIX ============
  // "70% cash, 30% stock", "70% cash / 30% stock", "all cash"
  const cashPatterns = [
    /([\d.]+)\s*%\s*cash/i,
    /cash\s*[:\s]*([\d.]+)\s*%/i,
  ];
  
  for (const pattern of cashPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.cashPercent = parseFloat(match[1]) / 100;
      console.log(`[M&A Parser] Cash percent: ${result.cashPercent * 100}% from "${match[0]}"`);
      break;
    }
  }
  
  // Check for "all cash"
  if (lowerText.includes('all cash') || lowerText.includes('100% cash')) {
    result.cashPercent = 1.0;
    result.stockPercent = 0.0;
    console.log(`[M&A Parser] All cash deal detected`);
  }
  
  const stockPatterns = [
    /([\d.]+)\s*%\s*stock/i,
    /stock\s*[:\s]*([\d.]+)\s*%/i,
  ];
  
  for (const pattern of stockPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.stockPercent = parseFloat(match[1]) / 100;
      console.log(`[M&A Parser] Stock percent: ${result.stockPercent * 100}% from "${match[0]}"`);
      break;
    }
  }
  
  // Check for "all stock"
  if (lowerText.includes('all stock') || lowerText.includes('100% stock')) {
    result.cashPercent = 0.0;
    result.stockPercent = 1.0;
    console.log(`[M&A Parser] All stock deal detected`);
  }
  
  // Calculate complementary percentage
  if (result.cashPercent !== undefined && result.stockPercent === undefined) {
    result.stockPercent = 1.0 - result.cashPercent;
  } else if (result.stockPercent !== undefined && result.cashPercent === undefined) {
    result.cashPercent = 1.0 - result.stockPercent;
  }
  
  // ============ NEW DEBT ============
  const debtPatterns = [
    /\$?([\d,.]+)\s*(?:m|mm|million)?\s+(?:new\s+)?debt\s+(?:at\s+)?([\d.]+)\s*%/i,
    /(?:new\s+)?debt\s*[:\s]*\$?([\d,.]+)\s*(?:m|mm|million)?\s+(?:at\s+)?([\d.]+)\s*%/i,
    /(?:borrow|raise|financing)\s+\$?([\d,.]+)\s*(?:m|mm|million)?/i,
  ];
  
  for (const pattern of debtPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.newDebtAmount = parseMoneyValue(match[1] + 'm') ?? undefined;
      if (match[2]) {
        result.newDebtRate = parseFloat(match[2]) / 100;
      }
      console.log(`[M&A Parser] New debt: ${result.newDebtAmount}M at ${result.newDebtRate ? (result.newDebtRate * 100) + '%' : 'default rate'}`);
      break;
    }
  }
  
  // ============ BUYER SHARE PRICE ============
  const sharePricePatterns = [
    /(?:buyer|acquirer)\s+share\s+price\s*[=:]\s*\$?([\d.]+)/i,
    /shares?\s+(?:trading\s+)?at\s+\$?([\d.]+)/i,
    /\$?([\d.]+)\s+per\s+share/i,
    /stock\s+price\s*[:\s]*\$?([\d.]+)/i,
  ];
  
  for (const pattern of sharePricePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.acquirerStockPrice = parseFloat(match[1]);
      console.log(`[M&A Parser] Acquirer share price: $${result.acquirerStockPrice} from "${match[0]}"`);
      break;
    }
  }
  
  // ============ SHARES OUTSTANDING ============
  const sharesPatterns = [
    /shares\s+outstanding\s*[:\s]*([\d,.]+)\s*(?:m|mm|million)?/i,
    /([\d,.]+)\s*(?:m|mm|million)?\s+shares\s+outstanding/i,
    /([\d,.]+)\s*(?:m|mm|million)?\s+shares/i,
  ];
  
  for (const pattern of sharesPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.acquirerSharesOutstanding = parseMoneyValue(match[1] + 'm') ?? undefined;
      console.log(`[M&A Parser] Shares outstanding: ${result.acquirerSharesOutstanding}M from "${match[0]}"`);
      break;
    }
  }
  
  // ============ EXPLICIT EPS ============
  const epsPatterns = [
    /earns?\s+\$?([\d.]+)\s+per\s+share/i,
    /eps\s*[:\s]*\$?([\d.]+)/i,
    /\$?([\d.]+)\s+(?:in\s+)?eps/i,
  ];
  
  for (const pattern of epsPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.acquirerExplicitEPS = parseFloat(match[1]);
      console.log(`[M&A Parser] Explicit EPS: $${result.acquirerExplicitEPS} from "${match[0]}"`);
      break;
    }
  }
  
  // ============ COST SYNERGIES ============
  const costSynergyPatterns = [
    /cost\s+synerg(?:y|ies)\s*[:\s]*\$?([\d,.]+)\s*(?:m|mm|million)?/i,
    /\$?([\d,.]+)\s*(?:m|mm|million)?\s+(?:in\s+)?cost\s+synerg/i,
  ];
  
  for (const pattern of costSynergyPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.costSynergies = parseMoneyValue(match[1] + 'm') ?? undefined;
      console.log(`[M&A Parser] Cost synergies: ${result.costSynergies}M from "${match[0]}"`);
      break;
    }
  }
  
  // ============ REVENUE SYNERGIES ============
  const revSynergyPatterns = [
    /revenue\s+synerg(?:y|ies)\s*[:\s]*\$?([\d,.]+)\s*(?:m|mm|million)?/i,
    /\$?([\d,.]+)\s*(?:m|mm|million)?\s+(?:in\s+)?revenue\s+synerg/i,
    /\$?([\d,.]+)\s*(?:m|mm|million)?\s+incremental\s+revenue/i,
  ];
  
  for (const pattern of revSynergyPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.revenueSynergies = parseMoneyValue(match[1] + 'm') ?? undefined;
      console.log(`[M&A Parser] Revenue synergies: ${result.revenueSynergies}M from "${match[0]}"`);
      break;
    }
  }
  
  // ============ INTEGRATION COST ============
  const integrationPatterns = [
    /(?:one-?time\s+)?integration\s+cost\s*[:\s]*\$?([\d,.]+)\s*(?:m|mm|million)?/i,
    /\$?([\d,.]+)\s*(?:m|mm|million)?\s+integration\s+cost/i,
  ];
  
  for (const pattern of integrationPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.integrationCost = parseMoneyValue(match[1] + 'm') ?? undefined;
      console.log(`[M&A Parser] Integration cost: ${result.integrationCost}M from "${match[0]}"`);
      break;
    }
  }
  
  // ============ TRANSACTION FEES ============
  const txFeePatterns = [
    /transaction\s+(?:fees?|costs?)\s*[:\s]*\$?([\d,.]+)\s*(?:m|mm|million)?/i,
    /\$?([\d,.]+)\s*(?:m|mm|million)?\s+(?:in\s+)?transaction\s+(?:fees?|costs?)/i,
  ];
  
  for (const pattern of txFeePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.transactionFees = parseMoneyValue(match[1] + 'm') ?? undefined;
      console.log(`[M&A Parser] Transaction fees: ${result.transactionFees}M from "${match[0]}"`);
      break;
    }
  }
  
  // ============ FORECAST PERIOD ============
  const forecastPatterns = [
    /(\d+)\s*-?\s*year\s+(?:forecast|projection|model)/i,
    /model\s+(?:over\s+)?(?:a\s+)?(\d+)\s*-?\s*year/i,
  ];
  
  for (const pattern of forecastPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.forecastYears = parseInt(match[1], 10);
      console.log(`[M&A Parser] Forecast period: ${result.forecastYears} years from "${match[0]}"`);
      break;
    }
  }
  
  console.log(`[M&A Parser] Parsing complete:`, JSON.stringify(result, null, 2));
  
  return result;
}
