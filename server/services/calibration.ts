import fs from 'fs';
import path from 'path';
import { evaluateIntelligence } from './openai';

interface CalibrationSample {
  name: string;
  filePath: string;
  expectedScore: number;
  reason: string;
  sampleText: string; // Sample text for testing
}

// Define calibration samples with expected scores based on the final calibration pack
const calibrationSamples: CalibrationSample[] = [
  {
    name: "Sample 8: Pragmatism Paper Excerpt (Blueprint-Grade)",
    filePath: "",
    expectedScore: 95, // 94-96 in calibration examples
    reason: "Blueprint-level compression and reframing of pragmatism. Deep recursive structure and high originality.",
    sampleText: "Pragmatism has tremendous value—as a description, not of truth per se, but of our knowledge of it—and, more precisely, of our acquisition of that knowledge. [...] Truth per se is discovered, not made. But knowledge is indeed made."
  },
  {
    name: "Sample 7: The Will to Project (Blueprint-Grade)",
    filePath: "",
    expectedScore: 94,
    reason: "Major compression of psychological and metaphysical concepts into a recursive explanatory model. Demonstrates blueprint-grade cognitive structure.",
    sampleText: "A projected being is ipso facto supernatural. A hallucinated Mr. Spock—in other words, a Mr. Spock who is a case of pure projection—can walk on water, fly like a bird, and walk through walls. A Spock who is projected onto an actual person—a Max-Spock, in other words—is more limited but is still supernatural."
  },
  {
    name: "Sample 5: CTM Critique (Blueprint-Grade)",
    filePath: "",
    expectedScore: 94,
    reason: "Deep structural critique of CTM based on linguistic precision. Major compression and original reframing.",
    sampleText: "Words like 'form' and 'formal' are ambiguous, as they can refer to form in either the syntactic or the morphological sense. CTM fails on each disambiguation, and the arguments for CTM immediately cease to be compelling once we register that ambiguity."
  },
  {
    name: "Sample 6: Revised Dianetics Book Review (Blueprint-Grade)",
    filePath: "",
    expectedScore: 92,
    reason: "Shows independent sociological framing. Strong semantic compression and inferential continuity.",
    sampleText: "In Urban's view, practically everything about the Church is ambiguous. It is ambiguous whether it benefits its own members. It is also ambiguous what it is exactly. In some respects, it is a religion; in others, a corporation. However, Urban contends, it ultimately isn't exactly either; each of those identities was forced on it."
  },
  {
    name: "Sample 4: Ninety Paradoxes (Blueprint-Grade)",
    filePath: "", 
    expectedScore: 90,
    reason: "Original pattern recognition compressed into a sharp conceptual tool. High inferential compression across examples.",
    sampleText: "The more useless a given employee is to the organization that employs her, the more unstintingly she will toe that organization's line. This is a corollary of the loser paradox."
  },
  {
    name: "Sample 3: Market Efficiency Meta-Critique (Strong Analysis)",
    filePath: "",
    expectedScore: 78,
    reason: "Shows solid compression and reframing (meta-predictions destabilizing efficiency), but not full blueprint-grade recursion or density.",
    sampleText: "In economic theory, market efficiency is often idealized as the natural outcome of rational actors optimizing their resources. However, this abstraction ignores the recursive effects of meta-predictions, wherein actors not only optimize based on information but optimize based on others' attempts to optimize. This feedback loop destabilizes classic efficiency models and suggests that genuine equilibrium may be systematically unattainable."
  },
  {
    name: "Sample 2: Free Will Bias Paragraph (Moderate Analysis)",
    filePath: "",
    expectedScore: 55,
    reason: "Basic inferential step is made (action vs. will), but compression is low and structure is relatively flat. Moderate but not blueprint-level thinking.",
    sampleText: "Free will is often said to mean acting without external compulsion. However, even when external pressures are removed, internal constraints such as psychological biases remain. Thus, freedom of action is not equivalent to freedom of will, suggesting that common definitions of free will overlook crucial internal limitations."
  },
  {
    name: "Sample 1: AI-Generated Paragraph (Low Structure)",
    filePath: "",
    expectedScore: 40,
    reason: "Random surface fluency without any conceptual compression or inferential continuity. No meaningful claims or structure.",
    sampleText: "Life is like really strange because like sometimes you just don't know what's happening and sometimes it's good and sometimes it's bad but it's just like that's how it is you know and we just kind of go along with it even though it's crazy and confusing."
  }
];

/**
 * Test the intelligence evaluation on the calibration samples
 */
export async function testCalibrationSamples(): Promise<{
  results: Array<{
    sample: string;
    expectedScore: number;
    actualScore: number;
    difference: number;
    evaluation: any;
  }>;
  summary: {
    averageDifference: number;
    adjustments: Record<string, number>;
  };
}> {
  console.log("Starting calibration tests...");
  const results = [];
  let totalDifference = 0;

  // Test each calibration sample
  for (const sample of calibrationSamples) {
    try {
      console.log(`Testing sample: ${sample.name}`);
      
      // Instead of trying to read files which is problematic in this environment,
      // we'll use the sample text we've included directly in our sample objects
      console.log(`Testing calibration for sample: ${sample.name}`);
      
      // Use the sample text we've included with each calibration sample
      const content = sample.sampleText;
      
      // Evaluate intelligence using OpenAI
      const evaluation = await evaluateIntelligence(content);
      
      // Calculate difference between expected and actual score
      const difference = sample.expectedScore - evaluation.overallScore;
      totalDifference += Math.abs(difference);
      
      // Add result
      results.push({
        sample: sample.name,
        expectedScore: sample.expectedScore,
        actualScore: evaluation.overallScore,
        difference,
        evaluation
      });
    } catch (error: any) {
      console.error(`Error testing sample ${sample.name}:`, error);
      results.push({
        sample: sample.name,
        expectedScore: sample.expectedScore,
        actualScore: 0,
        difference: -sample.expectedScore,
        evaluation: { error: error.message || 'Unknown error' }
      });
      totalDifference += Math.abs(sample.expectedScore);
    }
  }

  // Calculate average difference
  const averageDifference = totalDifference / calibrationSamples.length;
  
  // Calculate adjustments based on results
  const adjustments = calculateScoringAdjustments(results);
  
  return {
    results,
    summary: {
      averageDifference,
      adjustments
    }
  };
}

/**
 * Adjust the scoring algorithm based on calibration results
 * @returns Adjustment factors for scoring algorithm
 */
export function calculateScoringAdjustments(calibrationResults: any[]): {
  surfaceWeight: number;
  deepWeight: number;
  lowScoreAdjustment: number;
  highScoreAdjustment: number;
} {
  // Fixed weights based on calibration pack requirements - NO SMOOTHING TO 80 ALLOWED
  // 100% weight for deep cognitive features
  let surfaceWeight = 0.00; // 0% weight for surface features
  let deepWeight = 1.00;    // 100% weight for deep features
  let lowScoreAdjustment = 0.0;  // No adjustment for lower scores
  let highScoreAdjustment = 0.0; // No adjustment for higher scores
  
  // Analyze specific calibration range mismatches
  if (calibrationResults.length > 0) {
    // Group samples by score ranges
    const blueprintSamples = calibrationResults.filter(r => r.expectedScore >= 90);
    const advancedCritiqueSamples = calibrationResults.filter(r => r.expectedScore >= 80 && r.expectedScore < 90);
    const surfacePolishSamples = calibrationResults.filter(r => r.expectedScore >= 60 && r.expectedScore < 80);
    const fluentShallowSamples = calibrationResults.filter(r => r.expectedScore >= 40 && r.expectedScore < 60);
    const randomNoiseSamples = calibrationResults.filter(r => r.expectedScore < 40);
    
    // Calculate average scoring differences for each range
    const calculateRangeDifference = (samples: any[]): number => {
      if (samples.length === 0) return 0;
      return samples.reduce((sum, r) => sum + r.difference, 0) / samples.length;
    };
    
    const blueprintDiff = calculateRangeDifference(blueprintSamples);
    const advancedCritiqueDiff = calculateRangeDifference(advancedCritiqueSamples);
    const surfacePolishDiff = calculateRangeDifference(surfacePolishSamples);
    const fluentShallowDiff = calculateRangeDifference(fluentShallowSamples);
    const randomNoiseDiff = calculateRangeDifference(randomNoiseSamples);
    
    console.log(`Calibration differences: Blueprint=${blueprintDiff.toFixed(2)}, AdvancedCritique=${advancedCritiqueDiff.toFixed(2)}, SurfacePolish=${surfacePolishDiff.toFixed(2)}, FluentShallow=${fluentShallowDiff.toFixed(2)}, RandomNoise=${randomNoiseDiff.toFixed(2)}`);
    
    // Apply specific adjustments only if substantial differences remain after pattern matching
    if (Math.abs(blueprintDiff) > 3) {
      // Blueprint samples are critical to get right - adjust specifically for this range
      // A small positive boost for blueprint-grade papers specifically
      highScoreAdjustment = 0.02;
      console.log(`Applied blueprint adjustment of ${highScoreAdjustment}`);
    }
    
    // We don't adjust the core weights because the calibrated pattern detection is the primary method
  }
  
  return {
    surfaceWeight,   // Always 0% - no surface features influence the score
    deepWeight,      // Always 100% - only deep cognitive features count
    lowScoreAdjustment,
    highScoreAdjustment
  };
}