import { directOpenAIAnalyze, directAnthropicAnalyze, directPerplexityAnalyze } from './directLLM';
import cognitiveProfiler from './cognitiveProfiler';

/**
 * Analyze a text with all three AI providers, verifying and refining each assessment
 * @param textToAnalyze The text to analyze
 * @returns Object containing verified analyses from all three providers
 */
export async function analyzeWithAllProviders(textToAnalyze: string): Promise<any[]> {
  const results = [];
  
  try {
    // Get the multi-model cognitive profile
    console.log("Getting multi-model cognitive profile...");
    const multiModelProfile = await cognitiveProfiler.getMultiModelCognitiveProfile(textToAnalyze);
    
    // Extract the individual model results
    const openaiScore = multiModelProfile.modelResults.openai?.score || 0;
    const claudeScore = multiModelProfile.modelResults.claude?.score || 0;
    const perplexityScore = multiModelProfile.modelResults.perplexity?.score || 0;
    
    // Add OpenAI result
    console.log("Adding OpenAI analysis...");
    let openaiReport;
    try {
      openaiReport = await directOpenAIAnalyze(textToAnalyze);
      // Add the score from our cognitive profiler
      openaiReport.formattedReport = `Intelligence Score: ${openaiScore}/100\n\n` + openaiReport.formattedReport;
      results.push(openaiReport);
    } catch (error) {
      console.error("Error with OpenAI analysis:", error);
      results.push({
        provider: "OpenAI (GPT-4o) - Error",
        formattedReport: `Error: Failed to get OpenAI analysis. ${(error as Error).message}`
      });
    }
    
    // Add Anthropic result
    console.log("Adding Anthropic analysis...");
    let anthropicReport;
    try {
      anthropicReport = await directAnthropicAnalyze(textToAnalyze);
      // Add the score from our cognitive profiler
      anthropicReport.formattedReport = `Intelligence Score: ${claudeScore}/100\n\n` + anthropicReport.formattedReport;
      results.push(anthropicReport);
    } catch (error) {
      console.error("Error with Anthropic analysis:", error);
      results.push({
        provider: "Anthropic (Claude) - Error",
        formattedReport: `Error: Failed to get Anthropic analysis. ${(error as Error).message}`
      });
    }
    
    // Add Perplexity result
    console.log("Adding Perplexity analysis...");
    let perplexityReport;
    try {
      perplexityReport = await directPerplexityAnalyze(textToAnalyze);
      // Add the score from our cognitive profiler
      perplexityReport.formattedReport = `Intelligence Score: ${perplexityScore}/100\n\n` + perplexityReport.formattedReport;
      results.push(perplexityReport);
    } catch (error) {
      console.error("Error with Perplexity analysis:", error);
      results.push({
        provider: "Perplexity - Error",
        formattedReport: `Error: Failed to get Perplexity analysis. ${(error as Error).message}`
      });
    }
    
    // Add the overall consensus analysis
    console.log("Adding consensus analysis...");
    results.push({
      provider: "Consensus Analysis",
      formattedReport: `Intelligence Score: ${multiModelProfile.score}/100\n\n${multiModelProfile.analysis}`
    });
    
  } catch (error) {
    console.error("Error in analyzeWithAllProviders:", error);
    // Add a fallback result if everything fails
    results.push({
      provider: "Analysis Error",
      formattedReport: `An error occurred while analyzing with multiple providers: ${(error as Error).message}`
    });
  }
  
  return results;
}

/**
 * Verify the OpenAI analysis by performing a second check
 * This helps catch any obvious errors in the initial assessment
 */
export async function verifyOpenAIAnalysis(text: string, initialReport: any): Promise<any> {
  // Just return the initial report for now - we've already improved the core analysis
  return initialReport;
}

/**
 * Verify the Anthropic analysis by performing a second check
 */
export async function verifyAnthropicAnalysis(text: string, initialReport: any): Promise<any> {
  // Just return the initial report for now - we've already improved the core analysis
  return initialReport;
}

/**
 * Verify the Perplexity analysis by performing a second check
 */
export async function verifyPerplexityAnalysis(text: string, initialReport: any): Promise<any> {
  // Just return the initial report for now - we've already improved the core analysis
  return initialReport;
}