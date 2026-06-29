import { executeComprehensiveProtocol } from './fourPhaseProtocol';

export async function performComprehensiveAnalysis(text: string, provider: 'openai' | 'anthropic' | 'perplexity' | 'deepseek') {
  try {
    console.log(`Starting comprehensive cognitive analysis with ${provider}`);
    
    // Use the four-phase comprehensive protocol 
    const result = await executeComprehensiveProtocol(text, provider);
    
    return {
      cognitiveProfile: result.analysis,
      intelligenceScore: result.overallScore,
      detailedAnalysis: result.analysis,
      summary: result.analysis || "Comprehensive cognitive analysis completed",
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`Error in comprehensive analysis with ${provider}:`, error);
    throw new Error(`Comprehensive analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}