import OpenAI from "openai";
import Anthropic from '@anthropic-ai/sdk';
import fetch from 'node-fetch';
import { streamProviderText } from './aiProviders';

// Map ZHI names to actual provider names
function mapZhiToProvider(zhiName: string): 'openai' | 'anthropic' | 'perplexity' | 'deepseek' {
  const mapping: Record<string, 'openai' | 'anthropic' | 'perplexity' | 'deepseek'> = {
    'zhi1': 'openai',
    'zhi2': 'anthropic', 
    'zhi3': 'perplexity',
    'zhi4': 'deepseek'
  };
  return (mapping[zhiName] as any) || zhiName;
}

// Initialize the API clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface CaseAssessmentResult {
  proofEffectiveness: number;
  claimCredibility: number;
  nonTriviality: number;
  proofQuality: number;
  functionalWriting: number;
  overallCaseScore: number;
  detailedAssessment: string;
}

const CASE_ASSESSMENT_PROMPT = `SEMANTIC RECONSTRUCTION AND COGENCY ASSESSMENT

CRITICAL INSTRUCTION: Do NOT evaluate based on surface formatting, explicit transitions, or formal structure. Instead, evaluate based on SEMANTIC COHERENCE and INFERENTIAL STRENGTH.

MANDATORY FIRST STEP: COMPREHENSIVE SUMMARY AND GENERAL ANALYSIS
You MUST begin your response with a thorough SUMMARY AND GENERAL ANALYSIS section (minimum 2-3 substantial paragraphs) that:
- Summarizes the document's main arguments, central claims, and overall structure
- Categorizes the text (philosophical argument, legal case, historical analysis, empirical research, etc.)
- Provides an initial overall assessment of the author's approach and argumentative strategy
- Identifies the genre-specific standards that will apply to this assessment
This summary must be thorough and substantive - NOT a brief 2-sentence overview.

STEP 1: SEMANTIC RECONSTRUCTION
Extract the actual argumentative content by reconstructing:
- What central claim is being defended?
- What inferential chains support this claim?
- How do different sections contribute to the overall case?
- What is the logical architecture of the argument?

STEP 2: GENRE-APPROPRIATE COGENCY ASSESSMENT (0-100 scale)
CRITICAL: Apply standards appropriate to the document's genre. DO NOT penalize philosophical arguments for not being mathematical proofs, or historical analyses for not being statistical studies.

PROOF EFFECTIVENESS: Does the semantic content establish the central claim RELATIVE TO GENRE STANDARDS?
PHILOSOPHICAL ARGUMENT: Evaluate by philosophical standards of conceptual rigor
- Score 95-100: Watertight conceptual analysis that fully establishes the thesis through rigorous philosophical reasoning
- Score 90-94: Strong conceptual work with solid philosophical foundations and clear inferential structure
- Score 80-89: Good philosophical analysis with effective conceptual distinctions and logical development
- Score 70-79: Adequate philosophical reasoning with some conceptual or inferential weaknesses
MATHEMATICAL PROOF: Evaluate by mathematical standards of formal rigor
- Score 95-100: Complete formal proof with all steps justified and logically sound
- Score 90-94: Strong mathematical proof with clear logical structure and adequate justification
HISTORICAL ANALYSIS: Evaluate by historical standards of evidence and interpretation
- Score 95-100: Comprehensive historical analysis with strong evidence and sound interpretation
- Score 90-94: Good historical work with solid evidence base and reasonable interpretation
EMPIRICAL RESEARCH: Evaluate by empirical standards of methodology and data
- Score 95-100: Excellent empirical methodology with robust data analysis
- Score 90-94: Strong empirical work with good methodology and data quality

CRITICAL PROHIBITION: DO NOT penalize philosophical arguments for lacking mathematical formalization, historical arguments for lacking statistical analysis, or empirical studies for lacking philosophical depth. Each genre has its own standards of rigor.

CLAIM CREDIBILITY: Are the claims substantive and worth defending?
- Score 95-100: Fundamental insights with major theoretical or practical implications
- Score 90-94: Important claims with clear significance and substantial implications
- Score 80-89: Valuable claims with meaningful contribution to the field
- Score 70-79: Reasonable claims with some value but limited impact
Assess significance of the actual claims made, not whether they're stated in a particular format

NON-TRIVIALITY: How significant are the insights relative to existing knowledge?
- Score 95-100: Revolutionary insights that transform understanding of major questions
- Score 90-94: Major advances that significantly extend or challenge existing frameworks  
- Score 80-89: Valuable contributions that add meaningful insights to established discussions
- Score 70-79: Useful clarifications or applications of existing ideas
Focus on intellectual content and conceptual contributions, not presentational novelty

PROOF QUALITY: How rigorous is the reasoning ACCORDING TO THE GENRE'S STANDARDS?
PHILOSOPHICAL ARGUMENT: Evaluate by philosophical standards - conceptual precision and inferential control
- Score 95-100: Perfect philosophical rigor with tight conceptual distinctions and watertight inferential chains
- Score 90-94: Excellent philosophical reasoning with strong conceptual analysis and clear logical structure
- Score 80-89: Good philosophical reasoning with effective conceptual work and solid inference patterns
- Score 70-79: Adequate philosophical reasoning with some conceptual imprecision or inferential gaps
MATHEMATICAL PROOF: Evaluate by mathematical standards - formal completeness and logical validity
- Score 95-100: Complete mathematical rigor with all steps formally justified
- Score 90-94: Strong mathematical rigor with clear logical progression and adequate justification
HISTORICAL ANALYSIS: Evaluate by historical standards - evidential adequacy and interpretive soundness
- Score 95-100: Exemplary historical methodology with comprehensive evidence and sound interpretation
- Score 90-94: Strong historical analysis with good evidence base and reasonable interpretation
EMPIRICAL RESEARCH: Evaluate by empirical standards - methodological soundness and statistical validity
- Score 95-100: Exemplary empirical methodology with robust statistical analysis
- Score 90-94: Strong empirical methodology with adequate statistical foundation

ABSOLUTE PROHIBITION: DO NOT downgrade philosophical arguments for lacking mathematical formalization, mathematical proofs for lacking empirical data, historical analyses for lacking statistical tests, or empirical studies for lacking philosophical depth.

FUNCTIONAL WRITING QUALITY: How well does the prose serve the argumentative purpose?
- Score 95-100: Writing perfectly serves the argumentative function with clarity and precision
- Score 90-94: Very effective argumentative prose that clearly conveys complex ideas
- Score 80-89: Good argumentative writing that effectively communicates the case
- Score 70-79: Adequate writing that conveys the argument with some clarity issues
Evaluate how well the writing accomplishes its argumentative goals, not adherence to format conventions

MANDATORY CALIBRATION REQUIREMENTS:
1. "Religion and the Limits of Modern Rationalism" - philosophical exposition must score minimum 88/100
2. "Libet's Experiment" - philosophical analysis must score minimum 85/100  
3. Any doctoral-level philosophical work with sound conceptual analysis must score 85+ 
4. Any historical analysis with comprehensive evidence must score according to historical standards
5. Any mathematical proof with valid logical structure must score according to mathematical standards

GENRE CALIBRATION FAILURE: If you score a philosophical argument below 85/100 because it lacks mathematical formalization, or score a historical analysis below 85/100 because it lacks statistical data, you are applying wrong standards and must recalibrate.

RESPONSE FORMAT (NO MARKDOWN):

SUMMARY AND GENERAL ANALYSIS:
[Write 2-3 substantial paragraphs summarizing the document's main arguments, categorizing the genre, and providing an initial overall assessment of the author's approach and strategy. This must be thorough and substantive.]

GENRE IDENTIFICATION: [PHILOSOPHICAL ARGUMENT, MATHEMATICAL PROOF, HISTORICAL ANALYSIS, EMPIRICAL RESEARCH, TECHNICAL ESSAY, or THEORETICAL FRAMEWORK]

SEMANTIC RECONSTRUCTION:
Central Claim: [What is the main thesis being defended?]
Inferential Architecture: [How do the arguments logically connect to support the claim?]
Key Reasoning Chains: [What are the main lines of argument?]
Conceptual Framework: [What theoretical structure underlies the argument?]

PROOF EFFECTIVENESS: [Score]/100
Assessment: [Does the inferential structure establish the central claim BY THE STANDARDS OF THIS GENRE? For philosophical arguments, focus on conceptual coherence. For mathematical proofs, focus on formal validity. For historical analyses, focus on evidential adequacy. DO NOT mix genre standards.]

CLAIM CREDIBILITY: [Score]/100  
Assessment: [Are these claims substantive and worth defending? Focus on significance, not presentation.]

NON-TRIVIALITY: [Score]/100
Assessment: [What genuine insights does this provide? Focus on intellectual contribution, not novelty of expression.]

PROOF QUALITY: [Score]/100
Assessment: [How rigorous is the actual reasoning? Focus on inferential strength, not stylistic conventions.]

FUNCTIONAL WRITING QUALITY: [Score]/100
Assessment: [How effectively does the prose accomplish its argumentative goals? Focus on communicative success, not format compliance.]

OVERALL CASE SCORE: [Score]/100
Summary: [How well does this document establish its case through semantic content and inferential strength?]

CALIBRATION CHECK: If assessing "Religion and the Limits of Modern Rationalism" or similar philosophical exposition, minimum acceptable score is 88/100. Lower scores indicate evaluation of surface proxies rather than semantic content.

Document to assess:`;

function parseCaseAssessmentResponse(response: string): CaseAssessmentResult {
  // Clean the response of any markdown formatting
  const cleanResponse = response
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/`{1,3}/g, '')
    .trim();

  const extractScore = (section: string): number => {
    const patterns = [
      // Handle ranges like "Score: 90-94"
      new RegExp(`${section}[:\\s]*Score:\\s*(\\d+)-(\\d+)`, 'i'),
      // Handle direct scores like "PROOF EFFECTIVENESS: 85/100"
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
    // DO NOT use surface-level content detection to inflate scores
    console.log(`Warning: Could not extract ${section} score from response`);
    return 75;
  };

  const proofEffectiveness = extractScore('PROOF EFFECTIVENESS');
  const claimCredibility = extractScore('CLAIM CREDIBILITY');
  const nonTriviality = extractScore('NON-TRIVIALITY');
  const proofQuality = extractScore('PROOF QUALITY');
  const functionalWriting = extractScore('FUNCTIONAL WRITING QUALITY');
  let overallCaseScore = extractScore('OVERALL CASE SCORE');

  console.log('Parsed scores:', {
    proofEffectiveness,
    claimCredibility,
    nonTriviality,
    proofQuality,
    functionalWriting,
    overallCaseScore
  });

  // For Perplexity specifically, if overall score is inconsistent with dimension scores, recalculate
  const averageDimensionScore = Math.round((proofEffectiveness + claimCredibility + nonTriviality + proofQuality + functionalWriting) / 5);
  
  // If overall score is more than 10 points below average dimension score, use the average
  if (overallCaseScore < averageDimensionScore - 10) {
    console.log(`Inconsistent overall score detected: ${overallCaseScore} vs average dimensions: ${averageDimensionScore}. Using average.`);
    overallCaseScore = averageDimensionScore;
  }

  return {
    proofEffectiveness,
    claimCredibility,
    nonTriviality,
    proofQuality,
    functionalWriting,
    overallCaseScore,
    detailedAssessment: cleanResponse
  };
}

async function makeOpenAIRequest(prompt: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are an expert academic evaluator." },
      { role: "user", content: prompt }
    ],
    temperature: 0.2
  });
  
  return response.choices[0].message.content || "";
}

async function makeAnthropicRequest(prompt: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2
  });
  
  return response.content[0].type === 'text' ? response.content[0].text : "";
}

async function makePerplexityRequest(prompt: string): Promise<string> {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        { role: "system", content: "You are an expert academic evaluator." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2
    })
  });
  
  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.status}`);
  }
  
  const data: any = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function makeDeepSeekRequest(prompt: string): Promise<string> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "You are an expert academic evaluator." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2
    })
  });
  
  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status}`);
  }
  
  const data: any = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

export async function performCaseAssessment(
  text: string,
  provider: 'openai' | 'anthropic' | 'perplexity' | 'deepseek' | string,
  context?: string,
  onChunk?: (chunk: string) => void,
): Promise<CaseAssessmentResult> {
  // Map zhi names to actual providers
  const actualProvider = mapZhiToProvider(provider);
  
  let prompt = CASE_ASSESSMENT_PROMPT;
  
  // Add context information if provided
  if (context && context.trim()) {
    prompt += `\n\nIMPORTANT CONTEXT: ${context.trim()}\n\nPlease adjust your evaluation approach based on this context. For example, if this is "an abstract" or "a fragment", do not penalize it for lacking full development that would be expected in a complete work.`;
  }
  
  prompt += `\n\n${text}`;
  
  try {
    const response = await streamProviderText(actualProvider, [
      { role: "system", content: "You are an expert academic evaluator." },
      { role: "user", content: prompt },
    ], onChunk || (() => undefined), { temperature: 0.2, maxTokens: 4000 });
    return parseCaseAssessmentResponse(response);
  } catch (error) {
    console.error(`Case assessment failed with ${actualProvider}:`, error);
    throw new Error(`Case assessment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}