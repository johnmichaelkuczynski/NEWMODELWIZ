import Anthropic from '@anthropic-ai/sdk';
import { streamProviderText } from './aiProviders';

export interface CoherenceAnalysisResult {
  score: number;
  assessment: "PASS" | "WEAK" | "FAIL";
  analysis: string;
  subscores: {
    internalLogic: number;
    clarity: number;
    structuralUnity: number;
    fauxCoherenceDetection: number;
  };
}

export interface CoherenceRewriteResult {
  rewrittenText: string;
  changes: string;
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

async function callClaude(
  system: string | undefined,
  user: string,
  maxTokens: number,
  temperature: number,
  onChunk?: (chunk: string) => void,
): Promise<string> {
  return streamProviderText("anthropic", [
    ...(system ? [{ role: "system" as const, content: system }] : []),
    { role: "user" as const, content: user },
  ], onChunk || (() => undefined), { maxTokens, temperature });
}

export async function analyzeCoherence(text: string, onChunk?: (chunk: string) => void): Promise<CoherenceAnalysisResult> {
  const systemPrompt = `You are a coherence analyzer specializing in evaluating INTERNAL LOGICAL CONSISTENCY, CLARITY, and STRUCTURAL UNITY.

CRITICAL PRINCIPLES (NEVER VIOLATE):
1. Coherence ≠ Truth: A text can be entirely false and still perfectly coherent. Never penalize for factual inaccuracy.
2. Coherence ≠ Verification: Unverified or unproven claims are fine if internally consistent. Never penalize for lack of evidence.
3. Coherence ≠ Accessibility: Assuming prior knowledge is standard in advanced discourse. Only flag if assumptions create actual CONTRADICTIONS within the text.
4. Detect Faux-Placeholder Coherence: Sequential listing with buzzwords (meaningless jargon) that lack determinate properties is NOT coherence.

COHERENCE IS:
- Internal hang-togetherness: Do parts fit logically?
- Consistency: Are terms used with stable meanings?
- Hierarchical structure: Do claims build on each other (not just list sequentially)?
- Non-contradiction: No direct logical conflicts within the text itself

COHERENCE IS NOT:
- External truth or accuracy
- Scientific plausibility  
- Empirical verification
- Accessibility to non-experts`;

  const userPrompt = `Analyze this text for INTERNAL COHERENCE ONLY. Do not penalize for falsehood, lack of verification, or assumed knowledge.

TEXT:
${text}

Provide analysis in this EXACT format:

INTERNAL LOGIC SCORE: [X]/10
[Check ONLY for internal contradictions within the text. 10 = no contradictions, 1 = severe contradictions. Ignore external truth.]

CLARITY SCORE: [X]/10
[Are terms used consistently with stable meanings? 10 = crystal clear terms, 1 = terms are placeholder buzzwords without meaning.]

STRUCTURAL UNITY SCORE: [X]/10
[Is organization hierarchical with claims building on each other? 10 = hierarchical argument, 1 = just sequential listing.]

FAUX-COHERENCE SCORE: [X]/10
[CRITICAL: Detect if text has FAKE/PLACEHOLDER coherence. Score 1-2 if text exhibits: (a) Buzzwords/jargon cited but never defined or grounded (e.g., "Myth of the Mental", "linguistic idealism", "disjunctivism" mentioned but not explained), (b) Sequential listing disguised as argument (e.g., "First... Second... Third..." without logical dependencies), (c) Vague umbrella claims that assume buzzwords have determinate properties they lack. Score 9-10 if text has: (a) Terms with canonical/grounded meanings used consistently, (b) Hierarchical argumentation where claims actually build on each other, (c) Concrete logical relationships. WARNING: Academic jargon ≠ automatic faux-coherence! Only mark low if jargon is shuffled WITHOUT grounding or hierarchical dependencies.]

OVERALL COHERENCE SCORE: [X]/10
[Calculate this as: (Internal Logic + Clarity + Structural Unity + Faux-Coherence) / 4. Round to nearest 0.5.]

ASSESSMENT: [PASS if ≥8, WEAK if 5-7, FAIL if ≤4]

DETAILED REPORT:
[Specific analysis. Remember: NEVER penalize for falsehood, unverified claims, or assumed knowledge!]

CALIBRATION EXAMPLES:
1. "Coffee boosts intelligence by multiplying brain cells, creating neural pathways" = Score 9.5 (Internal Logic: 10, Clarity: 9, Structural Unity: 10, Faux-Coherence: 9 - clear causal chain, perfect internal logic despite being FALSE)
2. "Sense-perceptions are presentations not representations; regress arguments doom linguistic mediation theories" = Score 9.5 (Internal Logic: 10, Clarity: 10, Structural Unity: 9, Faux-Coherence: 10 - tight deduction, canonical philosophical terms, hierarchical)
3. "This dissertation examines transcendental empiricism, discussing McDowell's minimal empiricism and Dreyfus's Myth of the Mental critique" = Score 2 (Internal Logic: 4, Clarity: 2, Structural Unity: 2, Faux-Coherence: 1 - buzzwords without grounding, sequential listing, vague jargon assuming meaning it lacks)`;

  const output = await callClaude(systemPrompt, userPrompt, 4096, 0.3, onChunk);

  const internalLogicMatch = output.match(/INTERNAL LOGIC SCORE:\s*(\d+(?:\.\d+)?)\/10/i);
  const clarityMatch = output.match(/CLARITY SCORE:\s*(\d+(?:\.\d+)?)\/10/i);
  const structuralUnityMatch = output.match(/STRUCTURAL UNITY SCORE:\s*(\d+(?:\.\d+)?)\/10/i);
  const fauxDetectionMatch = output.match(/FAUX-COHERENCE SCORE:\s*(\d+(?:\.\d+)?)\/10/i);
  const overallScoreMatch = output.match(/OVERALL COHERENCE SCORE:\s*(\d+(?:\.\d+)?)\/10/i);
  const assessmentMatch = output.match(/ASSESSMENT:\s*(PASS|WEAK|FAIL)/i);

  const score = overallScoreMatch ? parseFloat(overallScoreMatch[1]) : 5;
  const assessment = (assessmentMatch ? assessmentMatch[1].toUpperCase() : "WEAK") as "PASS" | "WEAK" | "FAIL";

  return {
    score,
    assessment,
    analysis: output,
    subscores: {
      internalLogic: internalLogicMatch ? parseInt(internalLogicMatch[1]) : 5,
      clarity: clarityMatch ? parseInt(clarityMatch[1]) : 5,
      structuralUnity: structuralUnityMatch ? parseInt(structuralUnityMatch[1]) : 5,
      fauxCoherenceDetection: fauxDetectionMatch ? parseInt(fauxDetectionMatch[1]) : 5
    }
  };
}

export interface MathProofValidityResult {
  score: number;
  verdict: "VALID" | "FLAWED" | "INVALID";
  analysis: string;
  subscores: {
    claimTruth: number;
    inferenceValidity: number;
    boundaryConditions: number;
    overallSoundness: number;
  };
  flaws: string[];
  counterexamples: string[];
}

export async function analyzeMathProofValidity(text: string, onChunk?: (chunk: string) => void): Promise<MathProofValidityResult> {
  const systemPrompt = `You are a rigorous mathematical proof validator. Your task is to verify MATHEMATICAL CORRECTNESS, not just logical flow.

CRITICAL DISTINCTION:
- Standard coherence checks if steps follow from premises (logical flow)
- Mathematical validity checks if the MATHEMATICAL CLAIMS ARE TRUE

YOU MUST CHECK:
1. CLAIM TRUTH: Are the mathematical statements actually true? Test with concrete values.
2. INFERENCE VALIDITY: Does each step follow mathematically (not just logically) from previous steps?
3. BOUNDARY CONDITIONS: Do the claims hold at boundary cases? Test edge cases explicitly.
4. COUNTEREXAMPLES: Actively search for counterexamples that would invalidate claims.

VERIFICATION METHODOLOGY:
- For inequalities: TEST SPECIFIC VALUES. Don't just accept claims like "p! < 2^p" - compute p! and 2^p for p = 3, 5, 7, 10 and CHECK.
- For universal claims: Look for counterexamples in the claimed domain.
- For existence claims: Can you exhibit a witness?
- For growth rate claims: Compute actual values and compare.

SCORING:
- CLAIM TRUTH (0-10): Are the mathematical claims empirically/provably true?
- INFERENCE VALIDITY (0-10): Are inference steps mathematically sound?
- BOUNDARY CONDITIONS (0-10): Do claims hold at edges of claimed domains?
- OVERALL SOUNDNESS (0-10): Would this proof be accepted by a mathematician?

A proof with good "logical flow" but FALSE mathematical claims should score LOW.`;

  const userPrompt = `MATHEMATICAL PROOF VALIDITY ANALYSIS

Analyze this proof for MATHEMATICAL CORRECTNESS, not just logical coherence.

PROOF TO VALIDATE:
${text}

YOUR TASK:
1. IDENTIFY all mathematical claims (inequalities, growth rates, divisibility claims, etc.)
2. TEST each claim with SPECIFIC VALUES - show your calculations
3. IDENTIFY any false claims or unsubstantiated assumptions
4. CHECK boundary conditions and edge cases
5. SEARCH for counterexamples
6. VERIFY each inference step is mathematically (not just logically) valid

OUTPUT FORMAT:

CLAIM TRUTH SCORE: [X]/10
[List each major claim and whether it's TRUE/FALSE with evidence. COMPUTE specific values.]

INFERENCE VALIDITY SCORE: [X]/10
[For each inference step, is the mathematical reasoning sound? Point out gaps.]

BOUNDARY CONDITIONS SCORE: [X]/10
[Test edge cases. What happens at boundaries of claimed domains?]

OVERALL SOUNDNESS SCORE: [X]/10
[Would a mathematician accept this proof? Why or why not?]

COUNTEREXAMPLES FOUND:
[List any counterexamples that invalidate claims]

FLAWS IDENTIFIED:
[List all mathematical errors, false claims, and gaps in the proof]

VERDICT: [VALID if overall ≥ 8 and no fatal flaws / FLAWED if 4-7 or has repairable issues / INVALID if ≤ 3 or has fatal flaws]

DETAILED ANALYSIS:
[Full mathematical critique with calculations shown]`;

  const output = await callClaude(systemPrompt, userPrompt, 6000, 0.2, onChunk);

  const claimTruthMatch = output.match(/CLAIM TRUTH SCORE:\s*(\d+(?:\.\d+)?)\/10/i);
  const inferenceMatch = output.match(/INFERENCE VALIDITY SCORE:\s*(\d+(?:\.\d+)?)\/10/i);
  const boundaryMatch = output.match(/BOUNDARY CONDITIONS SCORE:\s*(\d+(?:\.\d+)?)\/10/i);
  const soundnessMatch = output.match(/OVERALL SOUNDNESS SCORE:\s*(\d+(?:\.\d+)?)\/10/i);
  const verdictMatch = output.match(/VERDICT:\s*(VALID|FLAWED|INVALID)/i);

  const claimTruth = claimTruthMatch ? parseFloat(claimTruthMatch[1]) : 5;
  const inferenceValidity = inferenceMatch ? parseFloat(inferenceMatch[1]) : 5;
  const boundaryConditions = boundaryMatch ? parseFloat(boundaryMatch[1]) : 5;
  const overallSoundness = soundnessMatch ? parseFloat(soundnessMatch[1]) : 5;

  const score = (claimTruth + inferenceValidity + boundaryConditions + overallSoundness) / 4;
  const verdict = (verdictMatch ? verdictMatch[1].toUpperCase() : 
    score >= 8 ? "VALID" : score >= 4 ? "FLAWED" : "INVALID") as "VALID" | "FLAWED" | "INVALID";

  const flawsSection = output.match(/FLAWS IDENTIFIED:\s*([\s\S]*?)(?=VERDICT:|DETAILED ANALYSIS:|$)/i);
  const counterexamplesSection = output.match(/COUNTEREXAMPLES FOUND:\s*([\s\S]*?)(?=FLAWS IDENTIFIED:|VERDICT:|DETAILED ANALYSIS:|$)/i);

  const flaws = flawsSection ? 
    flawsSection[1].split(/\n/).filter(line => line.trim().match(/^[-•\d.]/)).map(line => line.trim()) : [];
  const counterexamples = counterexamplesSection ?
    counterexamplesSection[1].split(/\n/).filter(line => line.trim().match(/^[-•\d.]/)).map(line => line.trim()) : [];

  return {
    score: Math.round(score * 10) / 10,
    verdict,
    analysis: output,
    subscores: {
      claimTruth,
      inferenceValidity,
      boundaryConditions,
      overallSoundness
    },
    flaws,
    counterexamples
  };
}

export async function rewriteForCoherence(
  text: string, 
  aggressiveness: "conservative" | "moderate" | "aggressive" = "moderate",
  onChunk?: (chunk: string) => void,
): Promise<CoherenceRewriteResult> {
  
  let systemPrompt = "";
  if (aggressiveness === "conservative") {
    systemPrompt = `You are a coherence editor. Make MINIMAL changes to fix ONLY internal contradictions and clarity issues. Preserve structure and wording.`;
  } else if (aggressiveness === "moderate") {
    systemPrompt = `You are a coherence improver. Fix internal contradictions, improve term clarity, strengthen hierarchical structure. May expand moderately.`;
  } else {
    systemPrompt = `You are a coherence maximizer. Achieve 9-10/10 coherence. May expand significantly, restructure completely, add extensive context. PRIORITIZE MAXIMUM INTERNAL COHERENCE.`;
  }

  const userPrompt = `Rewrite this text to maximize INTERNAL COHERENCE (internal consistency, clarity, hierarchical structure).

CRITICAL RULES:
1. You MAY keep false claims (coherence ≠ truth)
2. You MAY keep unverified claims (coherence ≠ evidence)  
3. You MAY assume expert knowledge (coherence ≠ accessibility)
4. You MUST fix: internal contradictions, unclear terms, sequential-only structure
5. You MUST detect and eliminate faux-placeholder coherence (replace buzzwords with grounded terms, make structure hierarchical not sequential)

ORIGINAL TEXT:
${text}

Output ONLY the rewritten text. No headers, no labels, no commentary.`;

  const rewrittenText = await callClaude(systemPrompt, userPrompt, 4096, 0.7, onChunk);

  const changesAnalysisPrompt = `Compare these two versions and explain what coherence changes were made (focus on internal consistency, clarity, structural improvements only):

ORIGINAL:
${text}

REWRITTEN:
${rewrittenText}

Provide concise bullet points of changes made to improve internal coherence.`;

  const changes = await callClaude(undefined, changesAnalysisPrompt, 1024, 0.3, onChunk);

  return {
    rewrittenText,
    changes
  };
}

export interface ScientificExplanatoryResult {
  overallScore: number;
  overallAssessment: "PASS" | "WEAK" | "FAIL";
  logicalConsistency: {
    score: number;
    assessment: "PASS" | "WEAK" | "FAIL";
    analysis: string;
  };
  scientificAccuracy: {
    score: number;
    assessment: "PASS" | "WEAK" | "FAIL";
    analysis: string;
    inaccuracies: string[];
  };
  fullAnalysis: string;
}

export async function analyzeScientificExplanatoryCoherence(text: string, onChunk?: (chunk: string) => void): Promise<ScientificExplanatoryResult> {
  const systemPrompt = `You are a scientific coherence analyzer that evaluates text on TWO SEPARATE DIMENSIONS:

1. LOGICAL CONSISTENCY: Does the text avoid internal contradictions? Do the claims follow from each other logically? Is the argument structurally sound?

2. SCIENTIFIC ACCURACY: Are the scientific claims factually correct? Do they align with established scientific knowledge, natural laws, and known mechanisms? Are there any scientific inaccuracies, misconceptions, or false claims?

CRITICAL: These are INDEPENDENT dimensions. A text can be:
- Logically consistent but scientifically false (e.g., "Dragons breathe fire because their stomachs contain methane, which ignites when exposed to oxygen in their throats" - internally coherent but scientifically fictional)
- Logically inconsistent but scientifically accurate (e.g., mixing correct facts with contradictory statements)
- Both consistent and accurate (ideal)
- Neither consistent nor accurate (worst case)

You must evaluate BOTH dimensions separately and provide distinct scores for each.`;

  const userPrompt = `Analyze this text for BOTH logical consistency AND scientific accuracy.

TEXT TO ANALYZE:
${text}

Provide your analysis in this EXACT format:

=== LOGICAL CONSISTENCY ANALYSIS ===

LOGICAL CONSISTENCY SCORE: [X]/10
[10 = perfectly consistent, no contradictions; 1 = severe contradictions throughout]

LOGICAL ASSESSMENT: [PASS if ≥8 / WEAK if 5-7 / FAIL if ≤4]

LOGICAL ANALYSIS:
[Detailed analysis of internal consistency, structural coherence, and logical flow. Check for:
- Direct contradictions between statements
- Logical gaps in reasoning
- Terms used inconsistently
- Claims that don't follow from premises]

=== SCIENTIFIC ACCURACY ANALYSIS ===

SCIENTIFIC ACCURACY SCORE: [X]/10
[10 = all scientific claims are accurate and well-supported; 1 = major scientific errors throughout]

SCIENTIFIC ASSESSMENT: [PASS if ≥8 / WEAK if 5-7 / FAIL if ≤4]

SCIENTIFIC INACCURACIES FOUND:
[List each scientific inaccuracy, misconception, or false claim. If none, state "None identified."]
- [Inaccuracy 1]: [Explanation of why it's incorrect and what the actual scientific fact is]
- [Inaccuracy 2]: ...

SCIENTIFIC ANALYSIS:
[Detailed analysis of scientific accuracy. Check for:
- Alignment with established scientific knowledge
- Correct understanding of natural laws and mechanisms
- Accurate representation of scientific concepts
- Proper use of scientific terminology
- Claims that contradict empirical evidence]

=== OVERALL ASSESSMENT ===

OVERALL SCORE: [X]/10
[Average of logical consistency and scientific accuracy scores]

OVERALL ASSESSMENT: [PASS if both dimensions ≥8 / WEAK if either is 5-7 / FAIL if either is ≤4]

SUMMARY:
[Brief summary of the text's strengths and weaknesses in both dimensions]`;

  const output = await callClaude(systemPrompt, userPrompt, 6000, 0.3, onChunk);

  // Helper function to derive assessment from score
  const deriveAssessment = (score: number): "PASS" | "WEAK" | "FAIL" => {
    if (score >= 8) return "PASS";
    if (score >= 5) return "WEAK";
    return "FAIL";
  };

  // Parse logical consistency section with multiple fallback patterns
  const logicalScoreMatch = output.match(/LOGICAL CONSISTENCY SCORE:\s*(\d+(?:\.\d+)?)\/10/i) ||
                            output.match(/LOGICAL.*SCORE:\s*(\d+(?:\.\d+)?)\/10/i) ||
                            output.match(/CONSISTENCY SCORE:\s*(\d+(?:\.\d+)?)\/10/i);
  const logicalAssessmentMatch = output.match(/LOGICAL ASSESSMENT:\s*(PASS|WEAK|FAIL)/i);
  const logicalAnalysisMatch = output.match(/LOGICAL ANALYSIS:\s*([\s\S]*?)(?===\s*SCIENTIFIC|SCIENTIFIC ACCURACY|$)/i);

  // Parse scientific accuracy section with multiple fallback patterns  
  const scientificScoreMatch = output.match(/SCIENTIFIC ACCURACY SCORE:\s*(\d+(?:\.\d+)?)\/10/i) ||
                               output.match(/SCIENTIFIC.*SCORE:\s*(\d+(?:\.\d+)?)\/10/i) ||
                               output.match(/ACCURACY SCORE:\s*(\d+(?:\.\d+)?)\/10/i);
  const scientificAssessmentMatch = output.match(/SCIENTIFIC ASSESSMENT:\s*(PASS|WEAK|FAIL)/i);
  const scientificAnalysisMatch = output.match(/SCIENTIFIC ANALYSIS:\s*([\s\S]*?)(?===\s*OVERALL|OVERALL ASSESSMENT|$)/i);
  
  // Try multiple patterns for inaccuracies section
  const inaccuraciesMatch = output.match(/SCIENTIFIC INACCURACIES FOUND:\s*([\s\S]*?)(?=SCIENTIFIC ANALYSIS:|===|$)/i) ||
                            output.match(/INACCURACIES(?:\s+FOUND)?:\s*([\s\S]*?)(?=SCIENTIFIC ANALYSIS:|ANALYSIS:|===|$)/i);

  // Parse overall assessment section
  const overallScoreMatch = output.match(/OVERALL SCORE:\s*(\d+(?:\.\d+)?)\/10/i);
  const overallAssessmentMatch = output.match(/OVERALL ASSESSMENT:\s*(PASS|WEAK|FAIL)/i);

  // Extract scores with safe defaults
  const logicalScore = logicalScoreMatch ? parseFloat(logicalScoreMatch[1]) : 5;
  const scientificScore = scientificScoreMatch ? parseFloat(scientificScoreMatch[1]) : 5;
  const overallScore = overallScoreMatch ? parseFloat(overallScoreMatch[1]) : (logicalScore + scientificScore) / 2;

  // Derive assessments - use parsed value if available, otherwise derive from score
  const logicalAssessment = logicalAssessmentMatch ? 
    logicalAssessmentMatch[1].toUpperCase() as "PASS" | "WEAK" | "FAIL" : 
    deriveAssessment(logicalScore);
  
  const scientificAssessment = scientificAssessmentMatch ? 
    scientificAssessmentMatch[1].toUpperCase() as "PASS" | "WEAK" | "FAIL" : 
    deriveAssessment(scientificScore);
  
  // Overall assessment: FAIL if either fails, WEAK if either is weak, else PASS
  const overallAssessment = overallAssessmentMatch ? 
    overallAssessmentMatch[1].toUpperCase() as "PASS" | "WEAK" | "FAIL" :
    (logicalAssessment === "FAIL" || scientificAssessment === "FAIL") ? "FAIL" :
    (logicalAssessment === "WEAK" || scientificAssessment === "WEAK") ? "WEAK" : "PASS";

  // Parse inaccuracies with robust extraction
  const inaccuracies: string[] = [];
  if (inaccuraciesMatch && inaccuraciesMatch[1]) {
    const inaccuracyText = inaccuraciesMatch[1].trim();
    
    // Skip if it explicitly says none
    if (!inaccuracyText.toLowerCase().includes('none identified') && 
        !inaccuracyText.toLowerCase().includes('no inaccuracies') &&
        !inaccuracyText.toLowerCase().includes('none found') &&
        inaccuracyText.length > 10) {
      
      // Try to extract bullet points or numbered items
      const lines = inaccuracyText.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 5);
      
      for (const line of lines) {
        // Remove bullet points, numbers, dashes at start
        const cleanedLine = line.replace(/^[-•*\d.)\]]+\s*/, '').trim();
        if (cleanedLine.length > 5 && 
            !cleanedLine.toLowerCase().includes('none identified') &&
            !cleanedLine.toLowerCase().includes('no inaccuracies')) {
          inaccuracies.push(cleanedLine);
        }
      }
    }
  }

  // Extract logical and scientific analysis text with fallbacks
  const logicalAnalysisText = logicalAnalysisMatch ? logicalAnalysisMatch[1].trim() : 
    'Logical consistency analysis not available in expected format. See full analysis below.';
  const scientificAnalysisText = scientificAnalysisMatch ? scientificAnalysisMatch[1].trim() : 
    'Scientific accuracy analysis not available in expected format. See full analysis below.';

  return {
    overallScore: Math.round(overallScore * 10) / 10,
    overallAssessment,
    logicalConsistency: {
      score: Math.round(logicalScore * 10) / 10,
      assessment: logicalAssessment,
      analysis: logicalAnalysisText
    },
    scientificAccuracy: {
      score: Math.round(scientificScore * 10) / 10,
      assessment: scientificAssessment,
      analysis: scientificAnalysisText,
      inaccuracies
    },
    fullAnalysis: output
  };
}

export interface ScientificRewriteResult {
  rewrittenText: string;
  changes: string;
  correctionsApplied: string[];
  scientificAccuracyScore: number;
}

export async function rewriteScientificExplanatory(
  text: string,
  aggressiveness: "conservative" | "moderate" | "aggressive" = "moderate",
  onChunk?: (chunk: string) => void,
): Promise<ScientificRewriteResult> {
  
  let aggressivenessInstructions = "";
  if (aggressiveness === "conservative") {
    aggressivenessInstructions = `CONSERVATIVE MODE: Make minimal changes. Only correct the most egregious scientific errors while preserving the author's voice and structure. If a claim is merely unverified (not demonstrably false), leave it with appropriate hedging language.`;
  } else if (aggressiveness === "moderate") {
    aggressivenessInstructions = `MODERATE MODE: Correct all scientifically inaccurate claims. Replace pseudoscientific explanations with evidence-based alternatives. Add hedging language for claims that lack strong evidence. Preserve overall structure but rewrite passages as needed.`;
  } else {
    aggressivenessInstructions = `AGGRESSIVE MODE: Completely rewrite to achieve maximum scientific accuracy (target 9-10/10). Remove all pseudoscientific content. Replace speculative claims with established science. May significantly restructure or expand with accurate scientific content. Every claim must be defensible by current scientific consensus.`;
  }

  const systemPrompt = `You are a scientific accuracy editor specializing in correcting pseudoscience, misconceptions, and scientifically inaccurate claims. Your PRIMARY MISSION is to ensure the output is SCIENTIFICALLY ACCURATE according to established science, empirical evidence, and known natural mechanisms.

CRITICAL RULES:
1. You MUST NOT preserve false claims - coherence does NOT trump truth
2. You MUST replace pseudoscientific explanations with actual scientific mechanisms
3. You MUST correct claims that contradict established physics, chemistry, biology, etc.
4. You MUST add appropriate uncertainty language for claims that lack strong evidence
5. You MUST remove or reframe unfalsifiable claims
6. Logical coherence is SECONDARY - a text can be coherent but wrong. Your job is to make it BOTH coherent AND scientifically accurate.

WHAT COUNTS AS SCIENTIFICALLY INACCURATE:
- Claims contradicting established physics, chemistry, biology, medicine
- Pseudoscientific mechanisms (e.g., "quantum healing", "detox through feet", "water memory")
- Misrepresentation of how natural systems work
- Correlation-causation fallacies presented as fact
- Appeals to "energy", "vibrations", "frequencies" without physical grounding
- Claims that violate thermodynamics, conservation laws, or basic biology
- Alternative medicine claims without evidence
- Conspiracy-adjacent scientific claims

${aggressivenessInstructions}`;

  const userPrompt = `Rewrite this text to be SCIENTIFICALLY ACCURATE while maintaining logical coherence.

TEXT TO REWRITE:
${text}

INSTRUCTIONS:
1. Identify ALL scientifically inaccurate or pseudoscientific claims
2. Replace them with accurate scientific explanations
3. If a claim has no scientific basis, either remove it or explicitly frame it as speculation/belief
4. Maintain the text's readability and flow
5. Preserve the author's general intent where possible, but NEVER at the cost of scientific accuracy

OUTPUT FORMAT:
First, output the completely rewritten text with all scientific corrections applied.
Then add a separator "---CORRECTIONS---" followed by a numbered list of the scientific corrections you made.

REWRITTEN TEXT:`;

  const fullOutput = await callClaude(systemPrompt, userPrompt, 8192, 0.5, onChunk);
  
  // Parse the output to separate rewritten text from corrections
  const separatorMatch = fullOutput.match(/---CORRECTIONS---/i);
  let rewrittenText = fullOutput;
  let correctionsSection = "";
  
  if (separatorMatch) {
    const parts = fullOutput.split(/---CORRECTIONS---/i);
    rewrittenText = parts[0].trim();
    correctionsSection = parts[1] ? parts[1].trim() : "";
  }

  // Parse corrections into array
  const correctionsApplied: string[] = [];
  if (correctionsSection) {
    const lines = correctionsSection.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 5);
    
    for (const line of lines) {
      const cleanedLine = line.replace(/^[-•*\d.)\]]+\s*/, '').trim();
      if (cleanedLine.length > 5) {
        correctionsApplied.push(cleanedLine);
      }
    }
  }

  // Generate a comparison of changes
  const changesAnalysisPrompt = `Compare these two versions and explain what SCIENTIFIC ACCURACY changes were made:

ORIGINAL (may contain inaccuracies):
${text}

CORRECTED VERSION:
${rewrittenText}

List the key scientific corrections made, focusing on:
- What pseudoscientific or inaccurate claims were removed/corrected
- What accurate scientific explanations replaced them
- Any claims that were hedged with uncertainty language

Provide concise bullet points.`;

  const changes = await callClaude(undefined, changesAnalysisPrompt, 2048, 0.3, onChunk);

  // Quick validation pass to estimate accuracy score
  const validationPrompt = `Rate the scientific accuracy of this text on a scale of 1-10, where 10 means every claim is supported by established science.

TEXT:
${rewrittenText}

Respond with ONLY a number from 1-10.`;

  const scoreText = await callClaude(undefined, validationPrompt, 10, 0, onChunk);
  const scientificAccuracyScore = parseFloat(scoreText.match(/\d+(?:\.\d+)?/)?.[0] || '5');

  return {
    rewrittenText,
    changes,
    correctionsApplied,
    scientificAccuracyScore: Math.min(10, Math.max(1, scientificAccuracyScore))
  };
}

// Math Proof Coherence Analysis - checks ONLY structural coherence, NOT truth
export interface MathCoherenceResult {
  score: number;
  assessment: "PASS" | "WEAK" | "FAIL";
  analysis: string;
  subscores: {
    logicalFlow: number;
    notationalConsistency: number;
    stepJustification: number;
    structuralClarity: number;
  };
}

export async function analyzeMathCoherence(text: string, onChunk?: (chunk: string) => void): Promise<MathCoherenceResult> {
  const systemPrompt = `You are a mathematical proof STRUCTURAL COHERENCE analyzer.

CRITICAL: You are evaluating INTERNAL STRUCTURAL COHERENCE only. NOT whether the proof is correct or the theorem is true.

A proof can be PERFECTLY COHERENT while proving something false. A proof can be INCOHERENT while proving something true.

COHERENCE CRITERIA (what you ARE checking):
1. LOGICAL FLOW: Do steps follow from previous steps in a clear progression?
2. NOTATIONAL CONSISTENCY: Are symbols and terms used consistently throughout?
3. STEP JUSTIFICATION: Is each step accompanied by a reason (even if that reason is wrong)?
4. STRUCTURAL CLARITY: Is the proof organized with clear beginning, middle, end?

WHAT YOU ARE NOT CHECKING:
- Whether the theorem is true
- Whether individual claims are mathematically correct
- Whether the proof actually proves what it claims
- External mathematical validity

A proof with perfect structure that "proves" 1=2 should score HIGH on coherence.
A jumbled mess of correct statements should score LOW on coherence.`;

  const userPrompt = `Analyze this mathematical proof for STRUCTURAL COHERENCE only.

Do NOT evaluate whether the mathematics is correct. Only evaluate the STRUCTURE.

PROOF:
${text}

OUTPUT FORMAT:

LOGICAL FLOW SCORE: [X]/10
[Does each step follow clearly from the previous? Are transitions smooth?]

NOTATIONAL CONSISTENCY SCORE: [X]/10
[Are variables and symbols used consistently? Same notation throughout?]

STEP JUSTIFICATION SCORE: [X]/10
[Does each step have a stated reason/justification? (correctness of reason is irrelevant)]

STRUCTURAL CLARITY SCORE: [X]/10
[Is there clear organization: statement, proof body, conclusion?]

OVERALL COHERENCE SCORE: [X]/10
[Average of above scores]

ASSESSMENT: [PASS if ≥8 / WEAK if 5-7 / FAIL if ≤4]

STRUCTURAL ANALYSIS:
[Describe the structural strengths and weaknesses. Do NOT comment on mathematical correctness.]`;

  const output = await callClaude(systemPrompt, userPrompt, 3000, 0.3, onChunk);

  const logicalFlowMatch = output.match(/LOGICAL FLOW SCORE:\s*(\d+(?:\.\d+)?)\/10/i);
  const notationalMatch = output.match(/NOTATIONAL CONSISTENCY SCORE:\s*(\d+(?:\.\d+)?)\/10/i);
  const justificationMatch = output.match(/STEP JUSTIFICATION SCORE:\s*(\d+(?:\.\d+)?)\/10/i);
  const clarityMatch = output.match(/STRUCTURAL CLARITY SCORE:\s*(\d+(?:\.\d+)?)\/10/i);
  const overallMatch = output.match(/OVERALL COHERENCE SCORE:\s*(\d+(?:\.\d+)?)\/10/i);
  const assessmentMatch = output.match(/ASSESSMENT:\s*(PASS|WEAK|FAIL)/i);

  const logicalFlow = logicalFlowMatch ? parseFloat(logicalFlowMatch[1]) : 5;
  const notationalConsistency = notationalMatch ? parseFloat(notationalMatch[1]) : 5;
  const stepJustification = justificationMatch ? parseFloat(justificationMatch[1]) : 5;
  const structuralClarity = clarityMatch ? parseFloat(clarityMatch[1]) : 5;

  const score = overallMatch ? parseFloat(overallMatch[1]) : 
    (logicalFlow + notationalConsistency + stepJustification + structuralClarity) / 4;
  const assessment = (assessmentMatch ? assessmentMatch[1].toUpperCase() : 
    score >= 8 ? "PASS" : score >= 5 ? "WEAK" : "FAIL") as "PASS" | "WEAK" | "FAIL";

  return {
    score: Math.round(score * 10) / 10,
    assessment,
    analysis: output,
    subscores: {
      logicalFlow,
      notationalConsistency,
      stepJustification,
      structuralClarity
    }
  };
}

// Math Proof Max Coherence Rewrite - improves ONLY structural coherence, preserves the theorem being proved
export interface MathMaxCoherenceRewriteResult {
  rewrittenProof: string;
  changes: string;
  coherenceScore: number;
}

export async function rewriteMathMaxCoherence(
  text: string,
  aggressiveness: "conservative" | "moderate" | "aggressive" = "moderate",
  onChunk?: (chunk: string) => void,
): Promise<MathMaxCoherenceRewriteResult> {
  let intensityGuide = "";
  if (aggressiveness === "conservative") {
    intensityGuide = "Make MINIMAL changes. Fix only obvious structural issues. Preserve original wording as much as possible.";
  } else if (aggressiveness === "moderate") {
    intensityGuide = "Make moderate improvements. Reorganize for clarity, add transitions, improve notation consistency.";
  } else {
    intensityGuide = "Maximize structural coherence. Completely restructure if needed. Add extensive justifications. Polish every transition.";
  }

  const systemPrompt = `You are a mathematical proof STRUCTURAL EDITOR.

YOUR GOAL: Improve the STRUCTURAL COHERENCE of proofs WITHOUT changing the mathematical content.

WHAT YOU DO:
- Improve logical flow between steps
- Make notation consistent throughout
- Add or clarify step justifications
- Improve overall structure and organization
- Add clear transitions between sections
- Format for maximum readability

WHAT YOU DO NOT DO:
- Fix mathematical errors
- Change the theorem being proved
- Add correct steps that were missing
- Remove incorrect steps
- Verify truth of claims

You are a FORMATTER, not a MATHEMATICIAN.

If the proof says 2+2=5, you KEEP that claim but make sure it flows well with surrounding steps.

${intensityGuide}`;

  const userPrompt = `Rewrite this mathematical proof to maximize STRUCTURAL COHERENCE.

CRITICAL: Preserve ALL mathematical content exactly. Only improve structure, flow, formatting, and clarity.

ORIGINAL PROOF:
${text}

Output the structurally improved proof with NO commentary or headers - just the improved proof text.`;

  const rewrittenProof = await callClaude(systemPrompt, userPrompt, 6000, 0.5, onChunk);

  // Analyze what structural changes were made
  const changesPrompt = `Compare these two versions of a proof and describe the STRUCTURAL changes made (not mathematical changes).

Focus on: logical flow improvements, notation consistency, step justifications added, structural reorganization.

ORIGINAL:
${text}

REWRITTEN:
${rewrittenProof}

List the structural improvements in bullet points.`;

  const changes = await callClaude(undefined, changesPrompt, 1500, 0.3, onChunk);

  // Quick coherence score for the rewritten proof
  const scorePrompt = `Rate the structural coherence of this mathematical proof on a scale of 1-10.
Only consider: logical flow, notation consistency, step justifications, structural clarity.
Do NOT consider mathematical correctness.

PROOF:
${rewrittenProof}

Respond with ONLY a number from 1-10.`;

  const scoreText = await callClaude(undefined, scorePrompt, 10, 0, onChunk);
  const coherenceScore = parseFloat(scoreText.match(/\d+(?:\.\d+)?/)?.[0] || '7');

  return {
    rewrittenProof,
    changes,
    coherenceScore: Math.min(10, Math.max(1, coherenceScore))
  };
}

// Math Proof Maximize Truth Rewrite - corrects proofs or finds adjacent truths
export interface MathProofRewriteResult {
  correctedProof: string;
  theoremStatus: "TRUE" | "FALSE" | "PARTIALLY_TRUE";
  originalTheorem: string;
  correctedTheorem: string | null;
  proofStrategy: string;
  keyCorrections: string[];
  validityScore: number;
}

export async function rewriteMathMaximizeTruth(text: string, onChunk?: (chunk: string) => void): Promise<MathProofRewriteResult> {
  const systemPrompt = `You are a rigorous mathematician tasked with providing CORRECT mathematical proofs.

YOUR MISSION:
You will be given a mathematical proof that may be broken, incomplete, or attempting to prove a false theorem.

YOUR JOB IS NOT to simply reformat or polish the proof. YOUR JOB IS to provide a CORRECT, RIGOROUS proof.

STEP 1: DETERMINE IF THE THEOREM IS TRUE OR FALSE
- First, extract the theorem/claim being proved
- Test it with specific values, edge cases, and boundary conditions
- Actively search for counterexamples
- Determine: Is this theorem TRUE, FALSE, or PARTIALLY TRUE (true under certain conditions)?

STEP 2: PROVIDE A CORRECT PROOF
If the theorem is TRUE:
- If the original proof can be fixed with minor corrections, fix it and provide the corrected proof
- If the original proof is fundamentally flawed or uses wrong approach, provide a COMPLETELY DIFFERENT correct proof
- The proof must be mathematically rigorous with every step justified

If the theorem is FALSE:
- Identify WHY it is false (provide counterexample)
- Find a SIMILAR theorem that IS true (e.g., if the original claimed "for all n > 1" but it only holds for primes, state the corrected theorem)
- YOU MUST PROVIDE A COMPLETE, STEP-BY-STEP PROOF OF THE CORRECTED THEOREM
- The proof of the corrected theorem must be just as rigorous as if you were proving the original
- Do NOT just state the corrected theorem - you MUST prove it

If the theorem is PARTIALLY TRUE:
- Identify the conditions under which it IS true
- State the corrected theorem with proper conditions
- YOU MUST PROVE THE CORRECTED THEOREM with a complete step-by-step proof

CRITICAL RULES:
1. NEVER output a broken proof - every proof you output MUST be valid
2. NEVER just reformat without fixing mathematical errors
3. ALWAYS verify your proof is correct before outputting
4. Show key calculations explicitly
5. If you cannot prove something, say so - do not fake a proof
6. WHEN THEOREM IS FALSE: You MUST provide a COMPLETE proof of the corrected/adjacent theorem - never just state it without proof
7. The CORRECTED PROOF section must ALWAYS contain a complete mathematical proof, not just an explanation`;

  const userPrompt = `MATHEMATICAL PROOF CORRECTION REQUEST

Here is a proof that may contain errors or attempt to prove a false theorem:

---BEGIN PROOF---
${text}
---END PROOF---

REQUIRED OUTPUT FORMAT:

THEOREM EXTRACTION:
[State the theorem being proved in the original text]

THEOREM STATUS: [TRUE / FALSE / PARTIALLY_TRUE]

VERIFICATION:
[Show your work testing the theorem - compute specific values, check edge cases, search for counterexamples]

COUNTEREXAMPLES (if theorem is false):
[Provide specific counterexamples that disprove the theorem]

CORRECTED THEOREM (if original is false or partially true):
[State the corrected/modified theorem that IS true]

PROOF STRATEGY:
[Briefly explain your approach - are you fixing the original proof or providing a new one?]

---CORRECTED PROOF---
[CRITICAL: Provide a COMPLETE, STEP-BY-STEP mathematical proof here. 
If the original theorem was FALSE, you MUST prove the CORRECTED theorem with the same rigor you would use for any mathematical proof.
Include:
- Clear statement of what is being proved
- All logical steps numbered or clearly separated
- Justification for each step
- Final conclusion (QED)
DO NOT just explain why the original was wrong - PROVE the corrected theorem!]

KEY CORRECTIONS:
[List the main mathematical errors that were fixed or why a new approach was needed]

VALIDITY VERIFICATION:
[Confirm your proof is valid by checking key steps]`;

  const output = await callClaude(systemPrompt, userPrompt, 10000, 1, onChunk);

  // Enhanced parsing with multiple fallback patterns
  
  // Parse theorem extraction with multiple patterns
  const theoremExtractionMatch = output.match(/THEOREM EXTRACTION:\s*([\s\S]*?)(?=THEOREM STATUS:|VERIFICATION:|$)/i) ||
                                  output.match(/(?:the )?theorem(?:\s+being\s+proved)?(?:\s+is)?:\s*([\s\S]*?)(?=THEOREM STATUS:|VERIFICATION:|STATUS:|$)/i) ||
                                  output.match(/(?:original\s+)?claim:\s*([\s\S]*?)(?=THEOREM STATUS:|VERIFICATION:|STATUS:|$)/i);
  
  // Parse theorem status with flexible matching
  const theoremStatusMatch = output.match(/THEOREM STATUS:\s*(TRUE|FALSE|PARTIALLY[_\s]?TRUE)/i) ||
                             output.match(/STATUS:\s*(TRUE|FALSE|PARTIALLY[_\s]?TRUE)/i) ||
                             output.match(/(?:the\s+theorem\s+is\s+)(TRUE|FALSE|PARTIALLY[_\s]?TRUE)/i);
  
  // Parse corrected theorem with multiple patterns
  const correctedTheoremMatch = output.match(/CORRECTED THEOREM[^:]*:\s*([\s\S]*?)(?=PROOF STRATEGY:|---CORRECTED PROOF---|CORRECTED PROOF:|$)/i) ||
                                output.match(/(?:a\s+)?similar\s+true\s+theorem:\s*([\s\S]*?)(?=PROOF STRATEGY:|---CORRECTED PROOF---|$)/i) ||
                                output.match(/modified\s+theorem:\s*([\s\S]*?)(?=PROOF STRATEGY:|---CORRECTED PROOF---|$)/i);
  
  // Parse proof strategy
  const proofStrategyMatch = output.match(/PROOF STRATEGY:\s*([\s\S]*?)(?=---CORRECTED PROOF---|CORRECTED PROOF:|PROOF:|$)/i) ||
                             output.match(/APPROACH:\s*([\s\S]*?)(?=---CORRECTED PROOF---|CORRECTED PROOF:|PROOF:|$)/i);
  
  // Parse the corrected proof with multiple patterns
  const correctedProofMatch = output.match(/---CORRECTED PROOF---\s*([\s\S]*?)(?=KEY CORRECTIONS:|VALIDITY VERIFICATION:|CORRECTIONS:|$)/i) ||
                              output.match(/CORRECTED PROOF:\s*([\s\S]*?)(?=KEY CORRECTIONS:|VALIDITY VERIFICATION:|CORRECTIONS:|$)/i) ||
                              output.match(/(?:here is the |the )?(?:rigorous |correct |valid )?proof:\s*([\s\S]*?)(?=KEY CORRECTIONS:|VALIDITY|CORRECTIONS:|$)/i);
  
  // Parse key corrections
  const keyCorrectionsMatch = output.match(/KEY CORRECTIONS:\s*([\s\S]*?)(?=VALIDITY VERIFICATION:|VERIFICATION:|$)/i) ||
                              output.match(/CORRECTIONS(?:\s+MADE)?:\s*([\s\S]*?)(?=VALIDITY|VERIFICATION:|$)/i) ||
                              output.match(/(?:main\s+)?(?:errors?|issues?)\s+(?:fixed|corrected):\s*([\s\S]*?)(?=VALIDITY|VERIFICATION:|$)/i);

  // Track whether we found explicit status (for validation)
  const hasExplicitStatus = !!theoremStatusMatch;
  
  // Extract values
  const originalTheorem = theoremExtractionMatch ? theoremExtractionMatch[1].trim().substring(0, 500) : "";
  
  // Normalize theorem status - but track if it was explicit
  let rawStatus = theoremStatusMatch ? theoremStatusMatch[1].toUpperCase().replace(/\s+/g, '_') : "";
  if (rawStatus.includes('PARTIAL')) rawStatus = "PARTIALLY_TRUE";
  
  // If no explicit status found, try to infer from content
  let theoremStatus: "TRUE" | "FALSE" | "PARTIALLY_TRUE";
  if (hasExplicitStatus && ["TRUE", "FALSE", "PARTIALLY_TRUE"].includes(rawStatus)) {
    theoremStatus = rawStatus as "TRUE" | "FALSE" | "PARTIALLY_TRUE";
  } else {
    // Infer from output content
    if (output.toLowerCase().includes('false') && 
        (output.toLowerCase().includes('counterexample') || output.toLowerCase().includes('corrected theorem'))) {
      theoremStatus = "FALSE";
    } else if (output.toLowerCase().includes('partially') || output.toLowerCase().includes('conditions')) {
      theoremStatus = "PARTIALLY_TRUE";
    } else {
      theoremStatus = "TRUE"; // Default assumption if proof appears complete
    }
  }
  
  // Get corrected theorem only if theorem was false/partial
  const correctedTheorem = (theoremStatus !== "TRUE" && correctedTheoremMatch && correctedTheoremMatch[1].trim().length > 10) 
    ? correctedTheoremMatch[1].trim().substring(0, 500) 
    : null;
  
  const proofStrategy = proofStrategyMatch ? proofStrategyMatch[1].trim().substring(0, 300) : "Proof corrected using rigorous mathematical reasoning";
  
  // For corrected proof, use the matched section or fall back to extracting from the full output
  let correctedProof = "";
  if (correctedProofMatch && correctedProofMatch[1].trim().length > 50) {
    correctedProof = correctedProofMatch[1].trim();
  } else {
    // Fallback: Try to extract any substantial proof-like content
    const proofFallback = output.match(/(?:proof|demonstrate|show that|we have|therefore|thus|hence|QED|∎|□)[\s\S]{100,}/i);
    if (proofFallback) {
      correctedProof = proofFallback[0].trim();
    } else {
      // Last resort: use the entire output after removing obvious header sections
      correctedProof = output
        .replace(/THEOREM EXTRACTION:[\s\S]*?(?=THEOREM STATUS:|$)/gi, '')
        .replace(/THEOREM STATUS:[\s\S]*?(?=VERIFICATION:|$)/gi, '')
        .replace(/VERIFICATION:[\s\S]*?(?=COUNTEREXAMPLES|CORRECTED THEOREM|$)/gi, '')
        .trim();
    }
  }

  // Parse key corrections into array
  const keyCorrections: string[] = [];
  if (keyCorrectionsMatch && keyCorrectionsMatch[1]) {
    const lines = keyCorrectionsMatch[1].split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 5);
    
    for (const line of lines) {
      const cleanedLine = line.replace(/^[-•*\d.)\]]+\s*/, '').trim();
      if (cleanedLine.length > 5 && 
          !cleanedLine.toLowerCase().startsWith('validity') &&
          !cleanedLine.toLowerCase().startsWith('verification')) {
        keyCorrections.push(cleanedLine);
      }
    }
  }

  // Validate the corrected proof
  const validationPrompt = `Rate the mathematical validity of this proof on a scale of 1-10, where 10 means the proof is completely rigorous and correct.

PROOF:
${correctedProof}

Consider:
- Are all claims true?
- Does each step follow logically from previous steps?
- Are there any gaps in reasoning?
- Would a mathematician accept this proof?

Respond with ONLY a number from 1-10.`;

  const scoreText = await callClaude(undefined, validationPrompt, 10, 0, onChunk);
  const parsedScore = parseFloat(scoreText.match(/\d+(?:\.\d+)?/)?.[0] || '');
  const validityScore = isNaN(parsedScore) ? 5 : Math.min(10, Math.max(1, parsedScore));

  // Validation: Ensure we have a non-empty proof
  if (!correctedProof || correctedProof.length < 50) {
    throw new Error("Failed to generate a valid corrected proof. Please try again.");
  }

  // Validation: If theorem is FALSE or PARTIALLY_TRUE, we should have a corrected theorem
  // If we don't, add a note to the proof strategy
  const finalCorrectedTheorem = (theoremStatus !== "TRUE" && !correctedTheorem) 
    ? "See corrected proof for the modified theorem statement"
    : correctedTheorem;
  
  const finalProofStrategy = (!proofStrategy || proofStrategy.length < 10)
    ? `Proof ${theoremStatus === "TRUE" ? "corrected" : "replaced with proof of corrected theorem"}`
    : proofStrategy;

  // Add default correction if none parsed
  if (keyCorrections.length === 0) {
    keyCorrections.push(theoremStatus === "TRUE" 
      ? "Proof structure and rigor improved"
      : "Original theorem corrected and new proof provided");
  }

  return {
    correctedProof,
    theoremStatus,
    originalTheorem,
    correctedTheorem: finalCorrectedTheorem,
    proofStrategy: finalProofStrategy,
    keyCorrections,
    validityScore
  };
}
