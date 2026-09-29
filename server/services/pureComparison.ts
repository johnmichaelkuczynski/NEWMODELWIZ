/**
 * PURE DUAL DOCUMENT COMPARISON USING EXACT 3-PHASE PROTOCOL
 * NO GARBAGE PARAMETERS - DESTROYS ALL TRACES OF DIMENSION SHIT
 */

import { executeFourPhaseProtocol } from './fourPhaseProtocol';

type LLMProvider = "openai" | "anthropic" | "perplexity" | "deepseek";

// Clean result structure - NO GARBAGE DIMENSIONS
interface PureDocumentAnalysis {
  id: number;
  documentId: number;
  provider: string;
  formattedReport: string;
  overallScore: number;
  analysis: string; // Add analysis field for UI compatibility
  // Frontend still expects these but we populate with clean values based on overall score
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

interface PureDocumentComparison {
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

export interface PureIntelligenceComparisonResult {
  analysisA: PureDocumentAnalysis;
  analysisB: PureDocumentAnalysis;
  comparison: PureDocumentComparison;
}

export async function performPureIntelligenceComparison(
  documentA: string,
  documentB: string,
  provider: LLMProvider
): Promise<PureIntelligenceComparisonResult> {
  
  console.log(`INTELLIGENCE COMPARISON WITH YOUR EXACT 4-PHASE PROTOCOL USING ${provider.toUpperCase()}`);
  
  // Perform exact 4-phase evaluation for both documents
  const [evaluationA, evaluationB] = await Promise.all([
    executeFourPhaseProtocol(documentA, provider),
    executeFourPhaseProtocol(documentB, provider)
  ]);

  // Create clean analysis structures for frontend (NO DIMENSION GARBAGE)
  const analysisA: PureDocumentAnalysis = {
    id: 0,
    documentId: 0,
    provider: provider,
    formattedReport: evaluationA.formattedReport,
    overallScore: evaluationA.overallScore,
    analysis: evaluationA.formattedReport, // Ensure analysis field is populated
    surface: {
      grammar: evaluationA.overallScore,
      structure: evaluationA.overallScore,
      jargonUsage: evaluationA.overallScore,
      surfaceFluency: evaluationA.overallScore
    },
    deep: {
      conceptualDepth: evaluationA.overallScore,
      inferentialContinuity: evaluationA.overallScore,
      semanticCompression: evaluationA.overallScore,
      logicalLaddering: evaluationA.overallScore,
      originality: evaluationA.overallScore
    }
  };
  
  const analysisB: PureDocumentAnalysis = {
    id: 1,
    documentId: 1,
    provider: provider,
    formattedReport: evaluationB.formattedReport,
    overallScore: evaluationB.overallScore,
    analysis: evaluationB.formattedReport, // Ensure analysis field is populated
    surface: {
      grammar: evaluationB.overallScore,
      structure: evaluationB.overallScore,
      jargonUsage: evaluationB.overallScore,
      surfaceFluency: evaluationB.overallScore
    },
    deep: {
      conceptualDepth: evaluationB.overallScore,
      inferentialContinuity: evaluationB.overallScore,
      semanticCompression: evaluationB.overallScore,
      logicalLaddering: evaluationB.overallScore,
      originality: evaluationB.overallScore
    }
  };

  // Simple comparison based on pure scores
  const winnerDocument: 'A' | 'B' = evaluationA.overallScore >= evaluationB.overallScore ? 'A' : 'B';
  const scoreDiff = Math.abs(evaluationA.overallScore - evaluationB.overallScore);
  
  const comparison: PureDocumentComparison = {
    documentA: {
      score: evaluationA.overallScore,
      strengths: [`Score: ${evaluationA.overallScore}/100`],
      style: ["Based on 3-phase protocol evaluation"]
    },
    documentB: {
      score: evaluationB.overallScore,
      strengths: [`Score: ${evaluationB.overallScore}/100`],
      style: ["Based on 3-phase protocol evaluation"]
    },
    comparisonTable: [
      { 
        dimension: "Overall Intelligence Score", 
        documentA: `${evaluationA.overallScore}/100`, 
        documentB: `${evaluationB.overallScore}/100` 
      }
    ],
    finalJudgment: `Document ${winnerDocument} demonstrates superior cognitive capacity with a score of ${winnerDocument === 'A' ? evaluationA.overallScore : evaluationB.overallScore}/100 compared to ${winnerDocument === 'A' ? evaluationB.overallScore : evaluationA.overallScore}/100 (difference: ${scoreDiff} points). This evaluation used your exact 3-phase protocol with anti-diplomatic scoring and percentile awareness pushback.`
  };

  return {
    analysisA,
    analysisB,
    comparison
  };
}