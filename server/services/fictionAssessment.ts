import { streamProviderText } from './aiProviders';

export interface FictionAssessmentResult {
  worldCoherence: number;
  emotionalPlausibility: number;
  thematicDepth: number;
  narrativeStructure: number;
  proseControl: number;
  overallFictionScore: number;
  detailedAssessment: string;
}

const FICTION_ASSESSMENT_PROMPT = `RESPOND WITH ONLY THE 6 LINES BELOW, REPLACE [number] WITH ACTUAL SCORES:

WORLD COHERENCE: [number]/100
EMOTIONAL PLAUSIBILITY: [number]/100
THEMATIC DEPTH: [number]/100
NARRATIVE STRUCTURE: [number]/100
PROSE CONTROL: [number]/100
OVERALL FICTION SCORE: [number]/100

DO NOT ADD ANY OTHER TEXT. NO EXPLANATIONS. NO ANALYSIS. ONLY THE 6 SCORE LINES.

Text to score:`;

function parseFictionAssessmentResponse(response: string): FictionAssessmentResult {
  // Use the enhanced cleanAIResponse function for aggressive markdown removal
  const cleanResponse = response
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/`{1,3}/g, '')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/>\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const extractScore = (section: string): number => {
    const patterns = [
      // Handle ranges like "Score: 90-94"
      new RegExp(`${section}[:\\s]*Score:\\s*(\\d+)-(\\d+)`, 'i'),
      // Handle direct scores like "WORLD COHERENCE: 85/100"
      new RegExp(`${section}:\\s*(\\d+)/100`, 'i'),
      // Handle direct scores without /100
      new RegExp(`${section}:\\s*(\\d+)`, 'i'),
      // Handle "Score: X" format
      new RegExp(`Score:\\s*(\\d+)(?:/100)?`, 'i')
    ];
    
    for (const pattern of patterns) {
      const match = cleanResponse.match(pattern);
      if (match) {
        if (match[2]) {
          // Range format - take the middle value
          const low = parseInt(match[1]);
          const high = parseInt(match[2]);
          const score = Math.round((low + high) / 2);
          return Math.min(Math.max(score, 0), 100);
        } else {
          const score = parseInt(match[1]);
          return Math.min(Math.max(score, 0), 100);
        }
      }
    }
    
    // If score extraction fails, return a neutral score
    console.log(`Warning: Could not extract ${section} score from response`);
    return 75;
  };

  const worldCoherence = extractScore('WORLD COHERENCE');
  const emotionalPlausibility = extractScore('EMOTIONAL PLAUSIBILITY');
  const thematicDepth = extractScore('THEMATIC DEPTH');
  const narrativeStructure = extractScore('NARRATIVE STRUCTURE');
  const proseControl = extractScore('PROSE CONTROL');
  let overallFictionScore = extractScore('OVERALL FICTION SCORE');

  console.log('Parsed fiction scores:', {
    worldCoherence,
    emotionalPlausibility,
    thematicDepth,
    narrativeStructure,
    proseControl,
    overallFictionScore
  });

  // Consistency check for fiction scores
  const averageDimensionScore = Math.round((worldCoherence + emotionalPlausibility + thematicDepth + narrativeStructure + proseControl) / 5);
  
  if (overallFictionScore < averageDimensionScore - 10) {
    console.log(`Inconsistent fiction overall score detected: ${overallFictionScore} vs average dimensions: ${averageDimensionScore}. Using average.`);
    overallFictionScore = averageDimensionScore;
  }

  return {
    worldCoherence,
    emotionalPlausibility,
    thematicDepth,
    narrativeStructure,
    proseControl,
    overallFictionScore,
    detailedAssessment: cleanResponse
  };
}

export async function performFictionAssessment(
  text: string,
  provider: string,
  onChunk?: (chunk: string) => void,
): Promise<FictionAssessmentResult> {
  const prompt = FICTION_ASSESSMENT_PROMPT + "\n\n" + text;
  
  console.log(`Starting fiction assessment with ${provider} for text of length: ${text.length}`);
  
  try {
    const response = await streamProviderText(provider, [
      { role: "system", content: "You MUST output ONLY numerical scores in the exact format requested. DO NOT write prose, essays, or analysis. Output ONLY: SECTION NAME: [number]/100" },
      { role: "user", content: prompt },
    ], onChunk || (() => undefined), { maxTokens: 4000, temperature: 0.2 });
    
    const result = parseFictionAssessmentResponse(response);
    console.log(`Fiction assessment complete - Overall score: ${result.overallFictionScore}/100`);
    return result;
    
  } catch (error) {
    console.error(`Fiction assessment failed with ${provider}:`, error);
    throw new Error(`Fiction assessment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}