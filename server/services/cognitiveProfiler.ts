import OpenAI from "openai";
import Anthropic from '@anthropic-ai/sdk';
import fetch from 'node-fetch';

// Initialize API clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Define our calibrated intelligence scoring scale
const INTELLIGENCE_SCALE = {
  // 50 is baseline for typical college graduate
  MEDIAN_COLLEGE: 50,
  POPSCI_LEVEL: { min: 60, max: 70 },
  UNDERGRAD_PAPER: { min: 70, max: 80 },
  PHD_LEVEL: { min: 85, max: 95 },
  FORMAL_MATH: { min: 95, max: 100 },
  LLM_FLUFF: { min: 45, max: 60 },
};

// Common system prompt prefix for all services
const COGNITIVE_PROFILER_PREFIX = `You are a FORENSIC COGNITIVE PROFILER analyzing a text sample to determine the intelligence level of its author. 

THIS IS NOT A GRADING SYSTEM. You are NOT evaluating:
- Academic merit
- Novelty or originality of ideas
- Citation practices
- Formatting or presentation
- How "revolutionary" the content is
- Adherence to academic standards
- Whether the author has "seen the full development" of ideas

INSTEAD, you are ONLY identifying cognitive patterns that reveal raw intelligence:
- Complexity of abstract reasoning
- Precision in logical structure
- Ability to manipulate symbolic systems
- Inferential architecture
- Depth of conceptual understanding
- Intellectual control over difficult material

On a scale from 0–100, where 50 reflects the median intelligence of a typical college graduate, estimate the author's intelligence level, based solely on what is demonstrated in this text. Treat the text as forensic evidence, like a detective analyzing a note left by a suspect.

Calibration Points:
- 50: Average college graduate (baseline)
- 60-70: Pop-sci essay on AI ethics
- 70-80: Undergraduate paper with basic arguments
- 85-95: PhD-level philosophical critique 
- 95-100: Formal mathematical/logical work

IMPORTANT: Formal/technical/abstract content that reveals high intelligence should score 90+ EVEN IF it's not "groundbreaking" or "original" in its field. Detecting intelligence is the sole purpose, not academic evaluation.`;

/**
 * Get cognitive profile using OpenAI GPT-4o
 */
export async function getCognitiveProfileOpenAI(text: string): Promise<{
  score: number;
  analysis: string;
  confidenceLevel: number;
}> {
  try {
    // Create the prompt with our specialized profiler instructions
    const prompt = `${COGNITIVE_PROFILER_PREFIX}

SPECIFIC INSTRUCTIONS:
Focus exclusively on the demonstrated cognitive abilities, NOT writing style or presentation.
Evaluate based on:
1. Abstraction level - ability to work with abstract concepts
2. Logical rigor - precision in reasoning
3. Inferential chains - complexity of reasoning steps
4. Conceptual novelty - original thinking vs recitation
5. Symbolic manipulation - handling complex symbol systems
6. Semantic compression - maximum meaning with minimal language

Provide:
1. An intelligence score from 0-100 (where 50 = median college graduate)
2. A concise analysis of the cognitive patterns demonstrated
3. A confidence rating (1-10) for your assessment

Here is the text to evaluate:

${text.slice(0, 8000)}${text.length > 8000 ? '... [text truncated for length]' : ''}`;

    // Call the OpenAI API with our cognitive profiling prompt
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Using the latest OpenAI model
      messages: [
        { role: "system", content: "You are a cognitive profiler focused exclusively on intelligence evaluation." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2, // Lower temperature for consistent, analytical responses
      max_tokens: 1000
    });

    // Extract the response content
    const content = response.choices[0].message.content || '';
    
    // Parse the result, looking for the score
    let score = 0;
    let analysis = content;
    let confidenceLevel = 7; // Default confidence
    
    // Extract score using regex - looking for patterns like "Score: 85" or "Intelligence Score: 85/100"
    const scoreMatch = content.match(/(?:intelligence\s*)?score:?\s*(\d{1,3})(?:\/100)?/i);
    if (scoreMatch && scoreMatch[1]) {
      score = parseInt(scoreMatch[1], 10);
    }
    
    // Extract confidence if present
    const confidenceMatch = content.match(/confidence:?\s*(\d{1,2})(?:\/10)?/i);
    if (confidenceMatch && confidenceMatch[1]) {
      confidenceLevel = parseInt(confidenceMatch[1], 10);
      if (confidenceLevel > 10) confidenceLevel = 10; // Cap at 10
    }
    
    return {
      score: Math.max(0, Math.min(100, score)), // Ensure score is between 0-100
      analysis: analysis,
      confidenceLevel
    };
  } catch (error) {
    console.error('Error in OpenAI cognitive profiling:', error);
    throw error;
  }
}

/**
 * Get cognitive profile using Anthropic Claude
 */
export async function getCognitiveProfileClaude(text: string): Promise<{
  score: number;
  analysis: string;
  confidenceLevel: number;
}> {
  try {
    // Create the prompt with our specialized profiler instructions
    const prompt = `${COGNITIVE_PROFILER_PREFIX}

SPECIFIC INSTRUCTIONS:
Focus exclusively on the demonstrated cognitive abilities, NOT writing style or presentation.
Evaluate based on:
1. Abstraction level - ability to work with abstract concepts
2. Logical rigor - precision in reasoning
3. Inferential chains - complexity of reasoning steps
4. Conceptual novelty - original thinking vs recitation
5. Symbolic manipulation - handling complex symbol systems
6. Semantic compression - maximum meaning with minimal language

Provide:
1. An intelligence score from 0-100 (where 50 = median college graduate)
2. A concise analysis of the cognitive patterns demonstrated
3. A confidence rating (1-10) for your assessment

Here is the text to evaluate:

${text.slice(0, 8000)}${text.length > 8000 ? '... [text truncated for length]' : ''}`;

    // Call the Anthropic API with our cognitive profiling prompt
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5", // Using the latest Claude model
      max_tokens: 1000,
      temperature: 0.2,
      system: "You are a cognitive profiler focused exclusively on intelligence evaluation.",
      messages: [
        { role: "user", content: prompt }
      ]
    });

    // Extract the response content
    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    
    // Parse the result, looking for the score
    let score = 0;
    let analysis = content;
    let confidenceLevel = 7; // Default confidence
    
    // Extract score using regex - looking for patterns like "Score: 85" or "Intelligence Score: 85/100"
    const scoreMatch = content.match(/(?:intelligence\s*)?score:?\s*(\d{1,3})(?:\/100)?/i);
    if (scoreMatch && scoreMatch[1]) {
      score = parseInt(scoreMatch[1], 10);
    }
    
    // Extract confidence if present
    const confidenceMatch = content.match(/confidence:?\s*(\d{1,2})(?:\/10)?/i);
    if (confidenceMatch && confidenceMatch[1]) {
      confidenceLevel = parseInt(confidenceMatch[1], 10);
      if (confidenceLevel > 10) confidenceLevel = 10; // Cap at 10
    }
    
    return {
      score: Math.max(0, Math.min(100, score)), // Ensure score is between 0-100
      analysis: analysis,
      confidenceLevel
    };
  } catch (error) {
    console.error('Error in Claude cognitive profiling:', error);
    throw error;
  }
}

/**
 * Get cognitive profile using Perplexity
 */
export async function getCognitiveProfilePerplexity(text: string): Promise<{
  score: number;
  analysis: string;
  confidenceLevel: number;
}> {
  try {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      throw new Error("PERPLEXITY_API_KEY not found");
    }

    // Create the prompt with our specialized profiler instructions
    const prompt = `${COGNITIVE_PROFILER_PREFIX}

SPECIFIC INSTRUCTIONS:
Focus exclusively on the demonstrated cognitive abilities, NOT writing style or presentation.
Evaluate based on:
1. Abstraction level - ability to work with abstract concepts
2. Logical rigor - precision in reasoning
3. Inferential chains - complexity of reasoning steps
4. Conceptual novelty - original thinking vs recitation
5. Symbolic manipulation - handling complex symbol systems
6. Semantic compression - maximum meaning with minimal language

Provide:
1. An intelligence score from 0-100 (where 50 = median college graduate)
2. A concise analysis of the cognitive patterns demonstrated
3. A confidence rating (1-10) for your assessment

Here is the text to evaluate:

${text.slice(0, 8000)}${text.length > 8000 ? '... [text truncated for length]' : ''}`;

    // Call the Perplexity API
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "sonar", // Using the Perplexity model
        messages: [
          {
            role: "system",
            content: "You are a cognitive profiler focused exclusively on intelligence evaluation."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 1000
      })
    });

    const data = await response.json() as any;
    
    if (!response.ok) {
      throw new Error(data?.error?.message || "Perplexity API error");
    }
    
    // Extract the response content
    const content = data.choices[0].message.content || '';
    
    // Parse the result, looking for the score
    let score = 0;
    let analysis = content;
    let confidenceLevel = 7; // Default confidence
    
    // Extract score using regex - looking for patterns like "Score: 85" or "Intelligence Score: 85/100"
    const scoreMatch = content.match(/(?:intelligence\s*)?score:?\s*(\d{1,3})(?:\/100)?/i);
    if (scoreMatch && scoreMatch[1]) {
      score = parseInt(scoreMatch[1], 10);
    }
    
    // Extract confidence if present
    const confidenceMatch = content.match(/confidence:?\s*(\d{1,2})(?:\/10)?/i);
    if (confidenceMatch && confidenceMatch[1]) {
      confidenceLevel = parseInt(confidenceMatch[1], 10);
      if (confidenceLevel > 10) confidenceLevel = 10; // Cap at 10
    }
    
    return {
      score: Math.max(0, Math.min(100, score)), // Ensure score is between 0-100
      analysis: analysis,
      confidenceLevel
    };
  } catch (error) {
    console.error('Error in Perplexity cognitive profiling:', error);
    throw error;
  }
}

/**
 * Get multi-model cognitive profile (combines all available services)
 */
export async function getMultiModelCognitiveProfile(text: string): Promise<{
  score: number;
  analysis: string;
  modelResults: Record<string, { score: number, analysis: string, confidenceLevel: number }>
}> {
  // Process in parallel for efficiency
  const results = await Promise.allSettled([
    getCognitiveProfileOpenAI(text),
    getCognitiveProfileClaude(text),
    getCognitiveProfilePerplexity(text)
  ]);
  
  // Track successful results
  const modelResults: Record<string, { score: number, analysis: string, confidenceLevel: number }> = {};
  const scores: number[] = [];
  
  // Extract results from each model
  if (results[0].status === 'fulfilled') {
    modelResults.openai = results[0].value;
    scores.push(results[0].value.score);
  }
  
  if (results[1].status === 'fulfilled') {
    modelResults.claude = results[1].value;
    scores.push(results[1].value.score);
  }
  
  if (results[2].status === 'fulfilled') {
    modelResults.perplexity = results[2].value;
    scores.push(results[2].value.score);
  }
  
  // Calculate the consensus score (average of all models)
  let finalScore = 0;
  if (scores.length > 0) {
    finalScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }
  
  // Generate a combined analysis
  let combinedAnalysis = `Cognitive Profile Analysis (Intelligence Score: ${finalScore}/100)\n\n`;
  
  // Add individual model scores to the analysis
  if (modelResults.openai) {
    combinedAnalysis += `OpenAI Score: ${modelResults.openai.score}/100 (Confidence: ${modelResults.openai.confidenceLevel}/10)\n`;
  }
  
  if (modelResults.claude) {
    combinedAnalysis += `Claude Score: ${modelResults.claude.score}/100 (Confidence: ${modelResults.claude.confidenceLevel}/10)\n`;
  }
  
  if (modelResults.perplexity) {
    combinedAnalysis += `Perplexity Score: ${modelResults.perplexity.score}/100 (Confidence: ${modelResults.perplexity.confidenceLevel}/10)\n`;
  }
  
  combinedAnalysis += `\nCognitive Patterns Observed:\n`;
  
  // Find the analysis with highest confidence to highlight
  let bestAnalysis = '';
  let highestConfidence = 0;
  
  for (const [model, result] of Object.entries(modelResults)) {
    if (result.confidenceLevel > highestConfidence) {
      highestConfidence = result.confidenceLevel;
      bestAnalysis = result.analysis;
    }
  }
  
  combinedAnalysis += bestAnalysis;
  
  return {
    score: finalScore,
    analysis: combinedAnalysis,
    modelResults
  };
}

export default {
  getCognitiveProfileOpenAI,
  getCognitiveProfileClaude,
  getCognitiveProfilePerplexity,
  getMultiModelCognitiveProfile
};