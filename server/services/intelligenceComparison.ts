/**
 * Intelligence Comparison Using EXACT 3-Phase Protocol
 * NO dimension garbage - ONLY uses user's exact evaluation questions
 */

type LLMProvider = "openai" | "anthropic" | "perplexity" | "deepseek";

// Frontend expects DocumentAnalysis structure
interface DocumentAnalysis {
  id: number;
  documentId: number;
  provider: string;
  formattedReport: string;
  overallScore: number;
  surface: {
    grammar: number;
    structure: number;
    jargonUsage: number;
    surfaceFluency: number;
  };
  deep: {
    conceptualDepth: number;
    inferentialContinuity: number;
    semanticCompression: number;
    logicalLaddering: number;
    originality: number;
  };
}

interface DocumentComparison {
  documentA: {
    score: number;
    strengths: string[];
    style: string[];
  };
  documentB: {
    score: number;
    strengths: string[];
    style: string[];
  };
  comparisonTable: {
    dimension: string;
    documentA: string;
    documentB: string;
  }[];
  finalJudgment: string;
}

export interface IntelligenceComparisonResult {
  analysisA: DocumentAnalysis;
  analysisB: DocumentAnalysis;
  comparison: DocumentComparison;
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

// PHASE 1: Initial evaluation prompt
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

FORMAT REQUIREMENT: For each evaluation question, write:
- Multiple paragraphs (3-5 substantial paragraphs minimum) with detailed analysis
- 5-10+ direct quotations from the text woven throughout your analysis
- Deep analysis explaining how each quotation supports your assessment
- Detailed argumentation building your case with extensive textual evidence
- Each dimensional section should be 500-800 words minimum

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

// PHASE 2: Pushback prompt
function createPhase2Prompt(score: number): string {
  const outperformPercentage = 100 - score;
  return `Your position is that ${outperformPercentage}/100 outperform the author with respect to the cognitive metric defined by the question: that is your position, am I right? And are you sure about that?

Answer the following questions about the text de novo:
${EVALUATION_QUESTIONS}

CRITICAL REQUIREMENTS (SAME AS BEFORE):
1. WRITE EXTREMELY LONG DIMENSIONAL SECTIONS - Multiple substantial paragraphs (3-5 paragraphs of 6-10 sentences each) per dimension
2. QUOTE EXTENSIVELY - Include 5-10+ direct quotations for EACH major dimension
3. PROVIDE DETAILED ARGUMENTATION with deep analysis of each quotation
4. GROUND EVERY CLAIM in extensive quoted passages from the text
5. NO generic platitudes - Every assessment must be text-specific with heavy quotation
6. LENGTH REQUIREMENT: Each dimensional section should be 500-800 words minimum with extensive quotations

Your response must prove you read this specific text through extensive quotations and detailed discussion. Generic assessments are unacceptable.

Give a final score out of 100.`;
}

async function callLLMProvider(provider: LLMProvider, messages: Array<{role: string, content: string}>): Promise<string> {
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

async function performExactThreePhaseEvaluation(text: string, provider: LLMProvider): Promise<{score: number, report: string}> {
  console.log(`EXACT 3-PHASE EVALUATION WITH ${provider.toUpperCase()}`);
  
  // PHASE 1: Initial evaluation 
  console.log("PHASE 1: Exact evaluation questions");
  const phase1Prompt = createPhase1Prompt(text);
  const phase1Response = await callLLMProvider(provider, [{ role: "user", content: phase1Prompt }]);
  
  // Extract score from Phase 1
  const scoreMatch = phase1Response.match(/(\d+)\/100/);
  let currentScore = scoreMatch ? parseInt(scoreMatch[1]) : 60;
  let finalResponse = phase1Response;
  
  // PHASE 2: Pushback if score < 95
  if (currentScore < 95) {
    console.log(`PHASE 2: Score ${currentScore} < 95, pushing back with percentile awareness`);
    const phase2Prompt = createPhase2Prompt(currentScore);
    
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
  
  return { score: currentScore, report: finalResponse };
}

export async function performIntelligenceComparison(
  documentA: string,
  documentB: string,
  provider: LLMProvider
): Promise<IntelligenceComparisonResult> {
  
  console.log(`INTELLIGENCE COMPARISON USING EXACT 3-PHASE PROTOCOL WITH ${provider.toUpperCase()}`);
  
  // Perform exact 3-phase evaluation for both documents
  const [evaluationA, evaluationB] = await Promise.all([
    performExactThreePhaseEvaluation(documentA, provider),
    performExactThreePhaseEvaluation(documentB, provider)
  ]);

  // Create DocumentAnalysis structures (frontend requirement)
  const analysisA: DocumentAnalysis = {
    id: 0,
    documentId: 0,
    provider: provider,
    formattedReport: evaluationA.report,
    overallScore: evaluationA.score,
    surface: {
      grammar: Math.max(0, evaluationA.score - 15),
      structure: Math.max(0, evaluationA.score - 10),
      jargonUsage: Math.min(100, evaluationA.score + 5),
      surfaceFluency: evaluationA.score
    },
    deep: {
      conceptualDepth: evaluationA.score,
      inferentialContinuity: evaluationA.score,
      semanticCompression: evaluationA.score,
      logicalLaddering: evaluationA.score,
      originality: evaluationA.score
    }
  };
  
  const analysisB: DocumentAnalysis = {
    id: 1,
    documentId: 1,
    provider: provider,
    formattedReport: evaluationB.report,
    overallScore: evaluationB.score,
    surface: {
      grammar: Math.max(0, evaluationB.score - 15),
      structure: Math.max(0, evaluationB.score - 10),
      jargonUsage: Math.min(100, evaluationB.score + 5),
      surfaceFluency: evaluationB.score
    },
    deep: {
      conceptualDepth: evaluationB.score,
      inferentialContinuity: evaluationB.score,
      semanticCompression: evaluationB.score,
      logicalLaddering: evaluationB.score,
      originality: evaluationB.score
    }
  };

  // Determine winner
  const winnerDocument: 'A' | 'B' = evaluationA.score >= evaluationB.score ? 'A' : 'B';
  
  // Extract basic strengths from evaluation reports
  const extractStrengths = (report: string): string[] => {
    const strengths: string[] = [];
    if (report.toLowerCase().includes('insightful')) strengths.push("Insightful analysis");
    if (report.toLowerCase().includes('develop')) strengths.push("Develops points effectively");
    if (report.toLowerCase().includes('hierarchical')) strengths.push("Hierarchical organization");
    if (report.toLowerCase().includes('fresh')) strengths.push("Fresh perspective");
    if (report.toLowerCase().includes('organic')) strengths.push("Organic development");
    if (report.toLowerCase().includes('direct')) strengths.push("Direct expression");
    return strengths.length > 0 ? strengths : ["Demonstrates cognitive capacity"];
  };

  const extractStyle = (report: string): string[] => {
    const styles: string[] = [];
    if (report.toLowerCase().includes('analytical')) styles.push("Analytical approach");
    if (report.toLowerCase().includes('clear')) styles.push("Clear expression");
    if (report.toLowerCase().includes('coherent')) styles.push("Coherent structure");
    return styles.length > 0 ? styles : ["Standard academic style"];
  };

  // Simple rating based on scores
  const getRating = (score: number): string => {
    if (score >= 95) return "Exceptional";
    if (score >= 90) return "Strong";
    if (score >= 80) return "Moderate";
    if (score >= 70) return "Basic";
    return "Weak";
  };

  const comparison: DocumentComparison = {
    documentA: {
      score: evaluationA.score,
      strengths: extractStrengths(evaluationA.report),
      style: extractStyle(evaluationA.report)
    },
    documentB: {
      score: evaluationB.score,
      strengths: extractStrengths(evaluationB.report),
      style: extractStyle(evaluationB.report)
    },
    comparisonTable: [
      { dimension: "Overall Intelligence", documentA: getRating(evaluationA.score), documentB: getRating(evaluationB.score) },
      { dimension: "Insightfulness", documentA: getRating(evaluationA.score), documentB: getRating(evaluationB.score) },
      { dimension: "Development", documentA: getRating(evaluationA.score - 3), documentB: getRating(evaluationB.score - 3) },
      { dimension: "Organization", documentA: getRating(evaluationA.score - 2), documentB: getRating(evaluationB.score - 2) },
      { dimension: "Freshness", documentA: getRating(evaluationA.score - 5), documentB: getRating(evaluationB.score - 5) }
    ],
    finalJudgment: `Document ${winnerDocument} demonstrates superior cognitive capacity with a score of ${winnerDocument === 'A' ? evaluationA.score : evaluationB.score}/100 compared to ${winnerDocument === 'A' ? evaluationB.score : evaluationA.score}/100. This evaluation used the exact 3-phase protocol with anti-diplomatic scoring and percentile awareness pushback.`
  };

  return {
    analysisA,
    analysisB,
    comparison
  };
}