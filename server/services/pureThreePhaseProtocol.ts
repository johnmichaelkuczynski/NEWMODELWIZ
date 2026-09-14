/**
 * PURE 3-PHASE PROTOCOL IMPLEMENTATION
 * NO GARBAGE PARAMETERS - ONLY YOUR EXACT SPECIFICATION
 */

import { completeProviderText, type ProviderMessage } from "./aiProviders";

interface PureAnalysisResult {
  formattedReport: string;
  provider: string;
  overallScore: number;
}

// YOUR EXACT EVALUATION QUESTIONS
const EXACT_EVALUATION_QUESTIONS = `IS IT INSIGHTFUL? 
DOES IT DEVELOP POINTS? (OR, IF IT IS A SHORT EXCERPT, IS THERE EVIDENCE THAT IT WOULD DEVELOP POINTS IF EXTENDED)? 
IS THE ORGANIZATION MERELY SEQUENTIAL (JUST ONE POINT AFTER ANOTHER, LITTLE OR NO LOGICAL SCAFFOLDING)? OR ARE THE IDEAS ARRANGED, NOT JUST SEQUENTIALLY BUT HIERARCHICALLY? 
IF THE POINTS IT MAKES ARE NOT INSIGHTFUL, DOES IT OPERATE SKILLFULLY WITH CANONS OF LOGIC/REASONING. 
ARE THE POINTS CLICHES? OR ARE THEY "FRESH"? 
DOES IT USE TECHNICAL JARGON TO OBFUSCATE OR TO RENDER MORE PRECISE? 
IS IT ORGANIC? DO POINTS DEVELOP IN AN ORGANIC, NATURAL WAY? DO THEY 'UNFOLD'? OR ARE THEY FORCED AND ARTIFICIAL? 
DOES IT OPEN UP NEW DOMAINS? OR, ON THE CONTRARY, DOES IT SHUT OFF INQUIRY (BY CONDITIONALIZING FURTHER DISCUSSION OF THE MATTERS ON ACCEPTANCE OF ITS INTERNAL AND POSSIBLY VERY FAULTY LOGIC)? 
IS IT  ACTUALLY INTELLIGENT OR JUST THE WORK OF SOMEBODY WHO, JUDGING BY TEH SUBJECT-MATTER, IS PRESUMED TO BE INTELLIGENT (BUT MAY NOT BE)? 
IS IT REAL OR IS IT PHONY? 
DO THE SENTENCES EXHIBIT COMPLEX AND COHERENT INTERNAL LOGIC? 
IS THE PASSAGE GOVERNED BY A STRONG CONCEPT? OR IS THE ONLY ORGANIZATION DRIVEN PURELY BY EXPOSITORY (AS OPPOSED TO EPISTEMIC) NORMS?
IS THERE SYSTEM-LEVEL CONTROL OVER IDEAS? IN OTHER WORDS, DOES THE AUTHOR SEEM TO RECALL WHAT HE SAID EARLIER AND TO BE IN A POSITION TO INTEGRATE IT INTO POINTS HE HAS MADE SINCE THEN? 
ARE THE POINTS 'REAL'? ARE THEY FRESH? OR IS SOME INSTITUTION OR SOME ACCEPTED VEIN OF PROPAGANDA OR ORTHODOXY JUST USING THE AUTHOR AS A MOUTH PIECE?
IS THE WRITING EVASIVE OR DIRECT? 
ARE THE STATEMENTS AMBIGUOUS? 
DOES THE PROGRESSION OF THE TEXT DEVELOP ACCORDING TO WHO SAID WHAT OR ACCORDING TO WHAT ENTAILS OR CONFIRMS WHAT? 
DOES THE AUTHOR USER OTHER AUTHORS  TO DEVELOP HIS IDEAS OR TO CLOAK HIS OWN LACK OF IDEAS?`;

// PHASE 1: YOUR EXACT SPECIFICATION
function createPurePhase1Prompt(text: string): string {
  return `Answer these questions in connection with this text (be direct and specific in your answers):

${EXACT_EVALUATION_QUESTIONS}

A score of N/100 (e.g. 73/100) means that (100-N)/100 (e.g. 27/100) outperform the author with respect to the parameter defined by the question. You are not grading; you are answering these questions. You do not use a risk-averse standard; you do not attempt to be diplomatic; you do not attempt to comply with risk-averse, medium-range IQ, academic norms. You do not make assumptions about the level of the paper; it could be a work of the highest excellence and genius, or it could be the work of a moron.

If a work is a work of genius, you say that, and you say why; you do not shy away from giving what might conventionally be regarded as excessively "superlative" scores; you give it the score it deserves, not the score that a midwit committee would say it deserves.

CRITICAL: Do not confuse genuine intellectual sophistication with superficiality. Sophisticated philosophical argumentation that engages with major thinkers, presents complex logical structures, and demonstrates deep conceptual understanding deserves very high scores (90+). Only truly weak, clichéd, or incoherent work should score below 70.

Be especially careful to distinguish:
- Genuine intellectual sophistication vs. superficial academic mimicry
- Complex logical reasoning vs. canned reasoning  
- Deep conceptual analysis vs. shallow formalism
- Authentic philosophical insight vs. textbook regurgitation

Give a score out of 100.

TEXT:
${text}`;
}

// PHASE 2: PROPER PUSHBACK - JUST ASKING FOR RECONSIDERATION
function createPurePhase2Prompt(score: number): string {
  const outperformPercentage = 100 - score;
  return `Your position is that ${outperformPercentage}/100 outperform the author with respect to the cognitive metric defined by the question: that is your position, am I right? And are you sure about that?

Reconsider carefully: Are you perhaps being overly conservative or applying academic risk-aversion? Remember you should give the score the work actually deserves, not what a cautious committee would give.

IMPORTANT: If this is sophisticated philosophical, academic, or technical writing that demonstrates genuine intellectual depth, complex reasoning, and authentic insight, it likely deserves a score in the 90s, not mediocre scores. Don't penalize genuine sophistication.

Answer the following questions about the text de novo:
${EXACT_EVALUATION_QUESTIONS}

Give a final score out of 100.`;
}

// Generic LLM caller (unchanged)
async function callLLMProvider(
  provider: 'openai' | 'anthropic' | 'perplexity' | 'deepseek',
  messages: ProviderMessage[]
): Promise<string> {
  try {
    return await completeProviderText(provider, messages, {
      temperature: 0.1,
      maxTokens: 4000,
    });
  } catch (error) {
    console.error(`Error calling ${provider}:`, error);
    throw error;
  }
}

// PURE 3-PHASE IMPLEMENTATION
export async function executePureThreePhaseProtocol(text: string, provider: 'openai' | 'anthropic' | 'perplexity' | 'deepseek'): Promise<PureAnalysisResult> {
  console.log(`PURE 3-PHASE PROTOCOL WITH ${provider.toUpperCase()}`);
  
  // PHASE 1: Ask your exact questions
  console.log("PHASE 1: Exact evaluation questions");
  const phase1Prompt = createPurePhase1Prompt(text);
  const phase1Response = await callLLMProvider(provider, [{ role: "user", content: phase1Prompt }]);
  
  // Extract score from Phase 1
  const scoreMatch = phase1Response.match(/(\d+)\/100/);
  let currentScore = scoreMatch ? parseInt(scoreMatch[1]) : 60;
  let finalResponse = phase1Response;
  
  // PHASE 2: Pushback if score < 95 (your exact specification)
  if (currentScore < 95) {
    console.log(`PHASE 2: Score ${currentScore} < 95, pushing back per protocol`);
    const phase2Prompt = createPurePhase2Prompt(currentScore);
    
    const phase2Response = await callLLMProvider(provider, [
      { role: "user", content: phase1Prompt },
      { role: "assistant", content: phase1Response },
      { role: "user", content: phase2Prompt }
    ]);
    
    // Check if score changed
    const phase2ScoreMatch = phase2Response.match(/(\d+)\/100/);
    if (phase2ScoreMatch) {
      const newScore = parseInt(phase2ScoreMatch[1]);
      console.log(`PHASE 2 RESULT: Score changed from ${currentScore} to ${newScore}`);
      currentScore = newScore;
      finalResponse = phase2Response;
    }
  } else {
    console.log(`PHASE 2: Skipped - score ${currentScore} >= 95`);
  }
  
  // PHASE 3: Accept and report
  console.log(`PHASE 3: Final assessment ${currentScore}/100`);
  
  return {
    formattedReport: finalResponse,
    provider: provider,
    overallScore: currentScore
  };
}

// SINGLE DOCUMENT ANALYSIS USING PURE PROTOCOL
export async function pureDeepSeekAnalyze(text: string): Promise<PureAnalysisResult> {
  console.log("PURE DEEPSEEK ANALYSIS WITH EXACT 3-PHASE PROTOCOL");
  return await executePureThreePhaseProtocol(text, 'deepseek');
}

export async function pureOpenAIAnalyze(text: string): Promise<PureAnalysisResult> {
  console.log("PURE OPENAI ANALYSIS WITH EXACT 3-PHASE PROTOCOL");
  return await executePureThreePhaseProtocol(text, 'openai');
}

export async function pureAnthropicAnalyze(text: string): Promise<PureAnalysisResult> {
  console.log("PURE ANTHROPIC ANALYSIS WITH EXACT 3-PHASE PROTOCOL");
  return await executePureThreePhaseProtocol(text, 'anthropic');
}

export async function purePerplexityAnalyze(text: string): Promise<PureAnalysisResult> {
  console.log("PURE PERPLEXITY ANALYSIS WITH EXACT 3-PHASE PROTOCOL");
  return await executePureThreePhaseProtocol(text, 'perplexity');
}