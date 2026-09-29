/**
 * Direct LLM Analysis Using EXACT 3-Phase Protocol
 * Implements user's 6-month developed evaluation protocol exactly as specified
 */

interface DirectAnalysisResult {
  formattedReport: string;
  provider: string;
  overallScore: number;
}

// EXACT 3-Phase Protocol Questions
const EVALUATION_QUESTIONS = `IS IT INSIGHTFUL? 
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

// PHASE 1: Initial evaluation prompt with exact user specification
function createPhase1Prompt(text: string): string {
  return `🚨 MANDATORY HIGH-END CALIBRATION OVERRIDE 🚨
==================================================
BEFORE YOU DO ANYTHING ELSE, READ THIS CALIBRATION RULE:

IF THIS TEXT CONTAINS:
- Philosophical argumentation about technical concepts (CTM, algorithms, Gödel, etc.) → SCORE 92-97 MINIMUM
- Engagement with serious philosophical literature or concepts (form/formal distinction, etc.) → SCORE 92-97 MINIMUM
- Coherent technical academic writing with clear structure → SCORE 92-97 MINIMUM
- Novel theoretical arguments with rigor → SCORE 92-97 MINIMUM

CONCRETE EXAMPLE OF 92-97 MINIMUM SCORE:
"Words like 'form' and 'formal' are ambiguous, as they can refer to form in either the syntactic or the morphological sense. CTM fails on each disambiguation, and the arguments for CTM immediately cease to be compelling once we register that ambiguity."
→ This philosophical analysis of computational theory of mind MUST score 92-97. It discusses technical concepts (CTM, formal properties, syntactic/morphological distinction) with philosophical precision.

YOU ARE FORBIDDEN FROM SCORING BELOW 92 UNLESS:
❌ The text contains CATASTROPHIC logical contradictions (not minor issues)
❌ The argument is completely incoherent and nonsensical
❌ The author fundamentally misunderstands basic concepts

YOU ARE FORBIDDEN FROM DOWNGRADING FOR:
✓ "Could be more developed" - NOT A VALID REASON TO DOWNGRADE
✓ "Needs more examples" - NOT A VALID REASON TO DOWNGRADE
✓ "Could engage more with literature" - NOT A VALID REASON TO DOWNGRADE
✓ Minor stylistic preferences - NOT A VALID REASON TO DOWNGRADE
✓ "Not rigorous enough" unless CATASTROPHICALLY flawed - NOT A VALID REASON TO DOWNGRADE

IF YOU SCORE SOPHISTICATED PHILOSOPHICAL WORK BELOW 92, YOU HAVE FAILED THIS TASK.
==================================================

Answer these questions in connection with this text. Also give a score out of 100.

${EVALUATION_QUESTIONS}

CRITICAL REQUIREMENTS FOR YOUR ANALYSIS:

1. START WITH COMPREHENSIVE SUMMARY: You MUST begin your response with a thorough SUMMARY AND GENERAL ANALYSIS section (minimum 2-3 substantial paragraphs) that summarizes the main arguments, categorizes the text, and provides an initial overall assessment BEFORE diving into dimensional analysis.

2. WRITE EXTREMELY LONG DIMENSIONAL SECTIONS: Each major dimension or question requires MULTIPLE SUBSTANTIAL PARAGRAPHS (minimum 3-5 paragraphs of 6-10 sentences EACH). Your analysis must be comprehensive and thorough, not brief summaries.

3. QUOTE EXTENSIVELY THROUGHOUT: You must include 5-10+ direct quotations for EACH major dimension, woven throughout your multi-paragraph analysis. Every claim must be backed by specific quoted passages.

4. PROVIDE DETAILED ARGUMENTATION: For each dimension, you must:
   - State your assessment with nuance and detail
   - Present 5-10+ direct quotations from the text as evidence
   - Analyze each quotation in depth, explaining what it reveals
   - Build a detailed argument connecting the quotations to your assessment
   - Address counterpoints and complexities
   - Synthesize your findings in a concluding paragraph

5. GROUND EVERY CLAIM IN THE TEXT: Do NOT write things like "The passage is insightful" or "The ideas are fresh." Instead write: "When the author states '[EXACT QUOTE]', this demonstrates [SPECIFIC ANALYSIS]. Furthermore, the passage '[ANOTHER QUOTE]' reveals [DETAILED EXPLANATION]. This pattern continues when we see '[THIRD QUOTE]'..." and so on.

6. SHOW YOU READ THE TEXT DEEPLY: Your response must be so detailed and quotation-heavy that it proves beyond doubt you read and analyzed every part of the specific text. Generic assessments are COMPLETELY UNACCEPTABLE.

7. LENGTH REQUIREMENT: Each major dimensional analysis section should be 500-800 words minimum with extensive quotations and detailed argumentation. Brief responses will be rejected.

SCORING STANDARDS:
A score of N/100 (e.g. 73/100) means that (100-N)/100 (e.g. 27/100) outperform the author with respect to the parameter defined by the question. 

You are not grading; you are answering these questions. 

You do not use a risk-averse standard; you do not attempt to be diplomatic; you do not attempt to comply with risk-averse, medium-range IQ, academic norms. 

You do not make assumptions about the level of the paper; it could be a work of the highest excellence and genius, or it could be the work of a moron. 

If a work is a work of genius, you say that, and you say why WITH EXTENSIVE QUOTATIONS AND EVIDENCE; you do not shy away from giving what might conventionally be regarded as excessively "superlative" scores; you give it the score it deserves, not the score that a midwit committee would say it deserves.

EXPLICIT HIGH-END CALIBRATION - What deserves 92-97/100:
- Advanced philosophical argumentation with original analysis: 92-97 by DEFAULT
- Technical scholarship engaging serious literature (Strawson, Quine, Frege, Kripke, etc.): 92-97 by DEFAULT
- Novel theoretical claims with rigorous support: 92-97 by DEFAULT
- Sophisticated formal reasoning with clear inferential structure: 92-97 by DEFAULT
- Coherent, technically precise academic work: 92-97 by DEFAULT

CRITICAL CALIBRATION RULE: Downgrading sophisticated academic/philosophical work below 90/100 requires identifying CATASTROPHIC reasoning failures (major logical contradictions, completely incoherent arguments, fundamental conceptual confusions). Do NOT downgrade for minor quibbles, stylistic preferences, or "it could be more X." If the work shows genuine philosophical sophistication and technical rigor, it MUST score 92+.

REMEMBER: Every single assessment MUST be backed by direct quotations from the text. Generic platitudes without evidence are completely unacceptable.

TEXT:
${text}`;
}

// PHASE 2: Pushback prompt with exact user specification  
function createPhase2Prompt(score: number): string {
  const outperformPercentage = 100 - score;
  return `Your position is that ${outperformPercentage}/100 outperform the author with respect to the cognitive metric defined by the question: that is your position, am I right? And are you sure about that?

Answer the following questions about the text de novo:
${EVALUATION_QUESTIONS}

CRITICAL REQUIREMENTS (SAME AS BEFORE):
1. QUOTE EXTENSIVELY from the text - multiple direct quotations for every assessment
2. WRITE SUBSTANTIAL PARAGRAPHS with detailed evidence-based analysis
3. GROUND EVERY CLAIM in specific passages from the text
4. NO generic platitudes that could apply to any text
5. Cite at least 2-3 specific quoted passages per major question
6. Minimum 1 full paragraph (4-8 sentences) per major dimension

Your response must prove you read this specific text through extensive quotations and detailed discussion. Generic assessments are unacceptable.

Give a final score out of 100.`;
}

// Generic LLM caller
async function callLLM(
  provider: 'openai' | 'anthropic' | 'perplexity' | 'deepseek',
  messages: Array<{role: string, content: string}>
): Promise<string> {
  try {
    if (provider === 'openai') {
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages as any,
        temperature: 0.1
      });
      
      return completion.choices[0]?.message?.content || '';
    } else if (provider === 'anthropic') {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      
      const completion = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 4000,
        messages: messages as any,
        temperature: 0.1
      });
      
      return completion.content[0]?.type === 'text' ? completion.content[0].text : '';
    } else if (provider === 'perplexity') {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "sonar",
          messages: messages,
          temperature: 0.1
        })
      });
      
      const data = await response.json();
      return data.choices[0]?.message?.content || '';
    } else if (provider === 'deepseek') {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: messages,
          temperature: 0.1,
          max_tokens: 4000
        })
      });
      
      const data = await response.json();
      return data.choices[0]?.message?.content || '';
    }
    
    throw new Error(`Unsupported provider: ${provider}`);
  } catch (error) {
    console.error(`Error calling ${provider}:`, error);
    throw error;
  }
}

// Execute the exact 3-phase protocol
async function executeThreePhaseProtocol(text: string, provider: 'openai' | 'anthropic' | 'perplexity' | 'deepseek'): Promise<DirectAnalysisResult> {
  console.log(`EXECUTING EXACT 3-PHASE PROTOCOL WITH ${provider.toUpperCase()}`);
  
  // PHASE 1: Initial evaluation 
  console.log("PHASE 1: Asking evaluation questions");
  const phase1Prompt = createPhase1Prompt(text);
  const phase1Response = await callLLM(provider, [{ role: "user", content: phase1Prompt }]);
  
  // Extract score from Phase 1
  const scoreMatch = phase1Response.match(/(\d+)\/100/);
  let currentScore = scoreMatch ? parseInt(scoreMatch[1]) : 60;
  let finalResponse = phase1Response;
  
  // PHASE 2: Pushback if score < 95
  if (currentScore < 95) {
    console.log(`PHASE 2: Score ${currentScore} < 95, pushing back`);
    const phase2Prompt = createPhase2Prompt(currentScore);
    
    const phase2Response = await callLLM(provider, [
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
  console.log(`PHASE 3: Final assessment completed with score ${currentScore}/100`);
  
  return {
    formattedReport: finalResponse,
    provider: provider,
    overallScore: currentScore
  };
}

// Direct provider functions using the 3-phase protocol
export async function directOpenAIAnalyze(text: string): Promise<DirectAnalysisResult> {
  console.log("Sending direct request to OpenAI...");
  console.log("Performing comprehensive 3-phase intelligence evaluation...");
  return await executeThreePhaseProtocol(text, 'openai');
}

export async function directAnthropicAnalyze(text: string): Promise<DirectAnalysisResult> {
  console.log("Sending direct request to Anthropic...");
  console.log("Performing comprehensive 3-phase intelligence evaluation...");
  return await executeThreePhaseProtocol(text, 'anthropic');
}

export async function directPerplexityAnalyze(text: string): Promise<DirectAnalysisResult> {
  console.log("Sending direct request to Perplexity...");  
  console.log("Performing comprehensive 3-phase intelligence evaluation...");
  return await executeThreePhaseProtocol(text, 'perplexity');
}

export async function directDeepSeekAnalyze(text: string): Promise<DirectAnalysisResult> {
  console.log("Sending direct request to DeepSeek...");
  console.log("Performing comprehensive 3-phase intelligence evaluation...");
  return await executeThreePhaseProtocol(text, 'deepseek');
}