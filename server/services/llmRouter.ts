import OpenAI from "openai";
import Anthropic from '@anthropic-ai/sdk';

// Initialize API clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Define response types for different models
interface ModelResponse {
  content: string;
  model: string;
}

interface LLMRouterOptions {
  useMultiModel?: boolean;  // If false, falls back to just OpenAI
  preventFallback?: boolean; // If true, throws error instead of falling back
}

/**
 * Multi-model LLM router that can distribute requests across different providers
 * for more accurate and comprehensive evaluations
 */
export class LLMRouter {
  private options: LLMRouterOptions;

  constructor(options: LLMRouterOptions = {}) {
    this.options = {
      useMultiModel: true,
      preventFallback: false,
      ...options
    };
  }

  /**
   * Evaluate semantic compression using OpenAI
   * This focuses specifically on information density and meaning-per-word ratio
   */
  async evaluateSemanticCompression(text: string): Promise<{
    score: number;
    analysis: string;
  }> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `You are SIGMA (Semantic Intelligence Grading and Measurement Analyzer), a specialized system focused exclusively on rating semantic compression in text.
            
            CRITICAL MISSION: Evaluate how efficiently information is packed into words. High semantic compression means maximum meaning with minimum verbiage.
            
            SCORING GUIDELINES:
            10: Exceptional compression - Each word carries multiple layers of meaning, recursive structures, minimal redundancy
            8-9: Very high compression - Precise language, strong concept-to-word ratio, no fluff
            6-7: Good compression - Clear and efficient but some unnecessary elements
            4-5: Moderate compression - Gets the point across but verbose in places
            2-3: Low compression - Unnecessarily wordy, lots of filler
            1: Minimal compression - Extremely verbose with little substance
            
            Focus EXCLUSIVELY on information density - not style, correctness, or any other dimension.
            
            Respond with a JSON object with this structure:
            {
              "score": <1-10 numeric score>,
              "analysis": "<brief explanation focusing on specific examples of compression or verbosity>"
            }`
          },
          {
            role: "user",
            content: text
          }
        ],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return {
        score: result.score || 5,
        analysis: result.analysis || "No analysis provided"
      };
    } catch (error) {
      console.error("Error evaluating semantic compression:", error);
      return { 
        score: 5, 
        analysis: "Error evaluating compression: " + (error as Error).message 
      };
    }
  }

  /**
   * Evaluate recursive reasoning structure using Anthropic Claude
   * This focuses on logical scaffolding, inferential continuity, and argument structure
   */
  async evaluateRecursiveReasoning(text: string): Promise<{
    score: number;
    analysis: string;
    layerCount: number;
  }> {
    if (!this.options.useMultiModel) {
      // Fall back to OpenAI
      return this.fallbackEvaluateRecursiveReasoning(text);
    }
    
    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-5", // the newest Anthropic model is "claude-sonnet-4-5" which was released February 24, 2025
        max_tokens: 1000,
        system: `You are RECURSIVE (Reasoning Evaluation Circuit Utilizing Recursive Structure in Intellectual Verification Engine), specialized in analyzing the recursive scaffolding of arguments.
        
        FOCUS EXCLUSIVELY on:
        1. Logical layering - how many levels of claims build on each other
        2. Inferential continuity - how tightly each claim depends on previous ones
        3. Self-referential loops - whether later arguments enhance or validate earlier ones
        4. Definitional scaffolding - how concepts are defined and then extended
        
        SCORING GUIDELINES:
        10: Exceptional recursion - Complex multi-level structure with consistent self-reinforcement
        8-9: Strong recursion - Multiple layers of claims that build coherently
        6-7: Good recursion - Clear progression of ideas with some layering
        4-5: Basic recursion - Simple progression without much depth
        2-3: Minimal recursion - Mostly flat with little building on previous ideas
        1: No recursion - Disconnected statements with no scaffolding
        
        You MUST identify specific examples of recursive structure and count the number of distinct logical layers.
        
        Respond with JSON in this exact format:
        {
          "score": <1-10 numeric score>,
          "analysis": "<brief explanation of recursive structure>",
          "layerCount": <number of distinct logical layers identified>
        }`,
        messages: [
          {
            role: "user",
            content: text
          }
        ]
      });

      // Parse the JSON from Claude's response
      const responseContent = response.content[0].type === 'text' 
        ? response.content[0].text 
        : JSON.stringify({score: 5, analysis: "Unable to process content", layerCount: 1});
        
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          score: result.score || 5,
          analysis: result.analysis || "No analysis provided",
          layerCount: result.layerCount || 1
        };
      } else {
        throw new Error("Failed to parse JSON from Claude response");
      }
    } catch (error) {
      console.error("Error evaluating recursive reasoning with Claude:", error);
      // Fall back to OpenAI if Claude fails
      return this.fallbackEvaluateRecursiveReasoning(text);
    }
  }

  /**
   * Fallback to use OpenAI if Anthropic is not available
   */
  private async fallbackEvaluateRecursiveReasoning(text: string): Promise<{
    score: number;
    analysis: string;
    layerCount: number;
  }> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
        messages: [
          {
            role: "system",
            content: `You are RECURSIVE (Reasoning Evaluation Circuit Utilizing Recursive Structure in Intellectual Verification Engine), specialized in analyzing the recursive scaffolding of arguments.
            
            FOCUS EXCLUSIVELY on:
            1. Logical layering - how many levels of claims build on each other
            2. Inferential continuity - how tightly each claim depends on previous ones
            3. Self-referential loops - whether later arguments enhance or validate earlier ones
            4. Definitional scaffolding - how concepts are defined and then extended
            
            SCORING GUIDELINES:
            10: Exceptional recursion - Complex multi-level structure with consistent self-reinforcement
            8-9: Strong recursion - Multiple layers of claims that build coherently
            6-7: Good recursion - Clear progression of ideas with some layering
            4-5: Basic recursion - Simple progression without much depth
            2-3: Minimal recursion - Mostly flat with little building on previous ideas
            1: No recursion - Disconnected statements with no scaffolding
            
            You MUST identify specific examples of recursive structure and count the number of distinct logical layers.
            
            Respond with JSON in this exact format:
            {
              "score": <1-10 numeric score>,
              "analysis": "<brief explanation of recursive structure>",
              "layerCount": <number of distinct logical layers identified>
            }`
          },
          {
            role: "user",
            content: text
          }
        ],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return {
        score: result.score || 5,
        analysis: result.analysis || "No analysis provided",
        layerCount: result.layerCount || 1
      };
    } catch (error) {
      console.error("Error in fallback recursive reasoning evaluation:", error);
      return { 
        score: 5, 
        analysis: "Error evaluating recursive structure: " + (error as Error).message,
        layerCount: 1
      };
    }
  }

  /**
   * Evaluate definitional clarity using a specialized OpenAI prompt
   */
  async evaluateDefinitionalClarity(text: string): Promise<{
    score: number;
    analysis: string;
  }> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
        messages: [
          {
            role: "system",
            content: `You are DEFCON (Definition Clarity Operational Network), a specialized system focused exclusively on evaluating definition precision in text.
            
            CRITICAL MISSION: Evaluate how clearly, precisely, and operationally key concepts are defined. High definition clarity means concepts have sharp boundaries, minimal ambiguity, and operational utility.
            
            SCORING GUIDELINES:
            10: Exceptional clarity - Concepts defined with mathematical precision, razor-sharp distinctions
            8-9: Very high clarity - Clear operational definitions with minimal ambiguity
            6-7: Good clarity - Concepts well-defined but some room for interpretation
            4-5: Moderate clarity - Basic definitions present but some fuzziness
            2-3: Low clarity - Many terms used without clear definitions
            1: Minimal clarity - Key concepts left undefined or highly ambiguous
            
            Focus EXCLUSIVELY on definitional precision - not style, correctness, or any other dimension.
            
            Respond with a JSON object with this structure:
            {
              "score": <1-10 numeric score>,
              "analysis": "<brief explanation focusing on specific examples of definition clarity or ambiguity>"
            }`
          },
          {
            role: "user",
            content: text
          }
        ],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return {
        score: result.score || 5,
        analysis: result.analysis || "No analysis provided"
      };
    } catch (error) {
      console.error("Error evaluating definitional clarity:", error);
      return { 
        score: 5, 
        analysis: "Error evaluating definitional clarity: " + (error as Error).message 
      };
    }
  }

  /**
   * Perform comprehensive multi-model evaluation of intelligence metrics
   * This distributes evaluation tasks across multiple models for more accurate assessments
   */
  async evaluateComprehensive(text: string): Promise<{
    semanticCompression: { score: number; analysis: string; };
    recursiveReasoning: { score: number; analysis: string; layerCount: number; };
    definitionalClarity: { score: number; analysis: string; };
    compositeScore: number;
  }> {
    // Run evaluations in parallel for efficiency
    const [
      semanticCompression,
      recursiveReasoning,
      definitionalClarity
    ] = await Promise.all([
      this.evaluateSemanticCompression(text),
      this.evaluateRecursiveReasoning(text),
      this.evaluateDefinitionalClarity(text)
    ]);

    // Calculate composite score with weighted emphasis on semantic compression and recursive reasoning
    // These are the most critical indicators of high intelligence
    const compositeScore = Math.round(
      (semanticCompression.score * 0.5) +  // 50% weight on semantic compression
      (recursiveReasoning.score * 0.3) +   // 30% weight on recursive reasoning
      (definitionalClarity.score * 0.2)    // 20% weight on definitional clarity
    );

    return {
      semanticCompression,
      recursiveReasoning,
      definitionalClarity,
      compositeScore
    };
  }

  /**
   * Collaborative rewrite using OpenAI with optional Claude assistance
   * This implements a multi-stage rewrite process for optimal results
   */
  async rewriteText(
    originalText: string,
    instruction: string,
    preserveLength: boolean = true
  ): Promise<{
    rewrittenText: string;
    stats: {
      originalLength: number;
      rewrittenLength: number;
      lengthChange: number;
      similarityPercentage?: number;
      instructionFollowed: string;
    };
  }> {
    const MAX_CHUNK_SIZE = 6000; // Maximum size for each chunk
    
    // If text is small enough, use collaborative rewrite
    if (originalText.length <= MAX_CHUNK_SIZE && this.options.useMultiModel) {
      return this.collaborativeRewrite(originalText, instruction, preserveLength);
    } else {
      // For longer texts, use chunked processing
      return this.chunkedRewrite(originalText, instruction, preserveLength);
    }
  }

  /**
   * Collaborative rewrite using both OpenAI and Claude (when available)
   */
  private async collaborativeRewrite(
    originalText: string,
    instruction: string,
    preserveLength: boolean = true
  ): Promise<{
    rewrittenText: string;
    stats: {
      originalLength: number;
      rewrittenLength: number;
      lengthChange: number;
      similarityPercentage?: number;
      instructionFollowed: string;
    };
  }> {
    try {
      let structuralRewrite = originalText;
      let finalRewrite = originalText;
      
      // STEP 1: Use Claude for structural rewriting (if available)
      if (this.options.useMultiModel) {
        try {
          const claudeResponse = await anthropic.messages.create({
            model: "claude-sonnet-4-5", // the newest Anthropic model is "claude-sonnet-4-5" which was released February 24, 2025
            max_tokens: Math.ceil(originalText.length * 1.2), // Allow for some expansion
            system: `You are a structural rewriter focused on RECURSIVE STRUCTURE improvement.
            
            MISSION: Restructure the following text to enhance its logical scaffolding, definitional clarity, and inferential continuity.
            
            FOCUS ON:
            - Creating cleaner recursive chains of inference
            - Strengthening operational definitions
            - Enhancing logical dependencies between claims
            - Adding minimal self-referential structures where helpful
            
            CRITICAL RULES:
            - NEVER add academic verbosity or jargon
            - NEVER make sentences longer without adding information
            - NEVER replace direct language with indirect language
            - PRESERVE all core information and claims
            
            SPECIFIC INSTRUCTION: ${instruction}
            
            ${preserveLength ? 'CRITICAL: Final text MUST be within 98-102% of original length.' : ''}
            
            Provide ONLY the rewritten text without comments or explanations.`,
            messages: [
              {
                role: "user",
                content: originalText
              }
            ]
          });
          
          // Extract text from Claude response safely
          const firstContent = claudeResponse.content[0];
          if (firstContent && 'type' in firstContent && firstContent.type === 'text' && 'text' in firstContent) {
            structuralRewrite = firstContent.text;
          }
        } catch (error) {
          console.warn("Claude structural rewrite failed, falling back to OpenAI:", error);
          // Continue with OpenAI only if Claude fails
        }
      }
      
      // STEP 2: Use GPT-4 for final compression and polishing
      const gpt4Response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
        messages: [
          {
            role: "system",
            content: `You are a semantic compression specialist focused on enhancing the intelligence of text.
            
            YOUR MISSION: Rewrite the following text to maximize semantic density, definitional clarity, and logical structure.
            
            INTELLIGENCE AMPLIFICATION TECHNIQUES:
            - Replace fuzzy definitions with razor-sharp operational boundaries
            - Remove redundancies while preserving all unique content
            - Connect logically disjoint ideas with minimal scaffolding
            - Strengthen distinction-making between related concepts
            - Replace ambiguous terms with precise ones
            - Convert circular reasoning to directional inference
            - Add recursive self-reference only where it genuinely clarifies
            
            FORBIDDEN BEHAVIORS:
            - ACADEMIC VERBOSITY: Adding words that don't add cognitive content
            - SCHOLARLY FILLER: Adding phrases like "it is important to note"
            - VERBOSITY: Using more words where fewer would suffice
            - ABSTRACTION CREEP: Replacing concrete language with abstraction
            - COMPLEXITY INFLATION: Making sentence structure more complex
            
            SPECIFIC INSTRUCTION: ${instruction}
            
            ${preserveLength ? 'CRITICAL: Final text MUST be within 98-102% of original length.' : ''}
            
            Provide ONLY the rewritten text without comments or explanations.`
          },
          {
            role: "user",
            content: this.options.useMultiModel ? structuralRewrite : originalText
          }
        ]
      });
      
      finalRewrite = gpt4Response.choices[0].message.content || originalText;
      
      // Similarity check
      let similarityPercentage = this.calculateSimilarityPercentage(originalText, finalRewrite);
      
      // If rewrite is too similar, make another attempt with stronger instruction
      if (similarityPercentage > 95) {
        console.log(`Initial rewrite too similar (${similarityPercentage}%). Making second attempt with stronger instruction.`);
        
        const secondAttemptResponse = await openai.chat.completions.create({
          model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
          messages: [
            {
              role: "system",
              content: `You are a semantic compression specialist focused on enhancing the intelligence of text.
              
              URGENT: Your previous rewrite was ${similarityPercentage}% similar to the original text. You MUST make more substantial changes.
              
              YOUR MISSION: Rewrite the following text to maximize semantic density, definitional clarity, and logical structure.
              
              INTELLIGENCE AMPLIFICATION TECHNIQUES:
              - REARRANGE entire sentences and paragraphs for better logical flow
              - RESTRUCTURE arguments to create clearer inferential chains
              - REDEFINE key concepts with more precise language
              - REFRAME key points to highlight logical relationships
              - SIMPLIFY complex phrasing without losing meaning
              
              FORBIDDEN BEHAVIORS:
              - ACADEMIC VERBOSITY: Adding words that don't add cognitive content
              - SCHOLARLY FILLER: Adding phrases like "it is important to note"
              - VERBOSITY: Using more words where fewer would suffice
              - ABSTRACTION CREEP: Replacing concrete language with abstraction
              - COMPLEXITY INFLATION: Making sentence structure more complex
              
              SPECIFIC INSTRUCTION: ${instruction}
              
              ${preserveLength ? 'LENGTH: Final text MUST be within 98-102% of original length.' : ''}
              
              Provide ONLY the rewritten text without comments or explanations.`
            },
            {
              role: "user",
              content: originalText
            }
          ]
        });
        
        finalRewrite = secondAttemptResponse.choices[0].message.content || finalRewrite;
        similarityPercentage = this.calculateSimilarityPercentage(originalText, finalRewrite);
      }
      
      return {
        rewrittenText: finalRewrite,
        stats: {
          originalLength: originalText.length,
          rewrittenLength: finalRewrite.length,
          lengthChange: finalRewrite.length - originalText.length,
          similarityPercentage: similarityPercentage,
          instructionFollowed: instruction + (
            similarityPercentage > 95 
              ? ` [WARNING: Output is ${similarityPercentage}% similar to input despite multiple attempts]`
              : ` [Rewrite complete, ${similarityPercentage}% similar to original]`
          )
        }
      };
    } catch (error) {
      console.error("Collaborative rewrite error:", error);
      return {
        rewrittenText: originalText,
        stats: {
          originalLength: originalText.length,
          rewrittenLength: originalText.length,
          lengthChange: 0,
          instructionFollowed: instruction + ` [ERROR: Rewrite failed - ${(error as Error).message}]`
        }
      };
    }
  }
  
  /**
   * Chunked rewrite for longer texts, processing segments and maintaining context
   */
  private async chunkedRewrite(
    originalText: string,
    instruction: string,
    preserveLength: boolean = true
  ): Promise<{
    rewrittenText: string;
    stats: {
      originalLength: number;
      rewrittenLength: number;
      lengthChange: number;
      similarityPercentage?: number;
      instructionFollowed: string;
    };
  }> {
    try {
      // Break text into manageable chunks
      const MAX_CHUNK_SIZE = 6000;
      const chunks = this.splitIntoChunks(originalText, MAX_CHUNK_SIZE);
      
      console.log(`Original text split into ${chunks.length} chunks for processing`);
      
      // Process each chunk
      const rewrittenChunks = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`Processing chunk ${i+1} of ${chunks.length}...`);
        
        // Create context-aware prompt
        const contextPrompt = `This is part ${i+1} of ${chunks.length} from a larger text. ${
          i > 0 ? 'Maintain the style and continuity from previous parts. ' : ''
        }`;
        
        const chunkResponse = await openai.chat.completions.create({
          model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
          messages: [
            {
              role: "system",
              content: `You are a semantic compression specialist focused on enhancing the intelligence of text.
              
              ${contextPrompt}
              
              YOUR MISSION: Rewrite the following text to maximize semantic density, definitional clarity, and logical structure.
              
              INTELLIGENCE AMPLIFICATION TECHNIQUES:
              - Replace fuzzy definitions with razor-sharp operational boundaries
              - Remove redundancies while preserving all unique content
              - Connect logically disjoint ideas with minimal scaffolding
              - Strengthen distinction-making between related concepts
              - Replace ambiguous terms with precise ones
              - Convert circular reasoning to directional inference
              - Add recursive self-reference only where it genuinely clarifies
              
              FORBIDDEN BEHAVIORS:
              - ACADEMIC VERBOSITY: Adding words that don't add cognitive content
              - SCHOLARLY FILLER: Adding phrases like "it is important to note"
              - VERBOSITY: Using more words where fewer would suffice
              - ABSTRACTION CREEP: Replacing concrete language with abstraction
              - COMPLEXITY INFLATION: Making sentence structure more complex
              
              SPECIFIC INSTRUCTION: ${instruction}
              
              ${preserveLength ? 'CRITICAL: Final text MUST be within 98-102% of original chunk length.' : ''}
              
              Provide ONLY the rewritten text without comments or explanations.`
            },
            {
              role: "user",
              content: chunk
            }
          ]
        });
        
        rewrittenChunks.push(chunkResponse.choices[0].message.content || chunk);
      }
      
      // Combine chunks
      const finalRewrite = rewrittenChunks.join('\n\n');
      const similarityPercentage = this.calculateSimilarityPercentage(originalText, finalRewrite);
      
      return {
        rewrittenText: finalRewrite,
        stats: {
          originalLength: originalText.length,
          rewrittenLength: finalRewrite.length,
          lengthChange: finalRewrite.length - originalText.length,
          similarityPercentage: similarityPercentage,
          instructionFollowed: instruction + (
            similarityPercentage > 95 
              ? ` [WARNING: Output is ${similarityPercentage}% similar to input]`
              : ` [Rewrite complete, ${similarityPercentage}% similar to original]`
          )
        }
      };
    } catch (error) {
      console.error("Chunked rewrite error:", error);
      return {
        rewrittenText: originalText,
        stats: {
          originalLength: originalText.length,
          rewrittenLength: originalText.length,
          lengthChange: 0,
          instructionFollowed: instruction + ` [ERROR: Rewrite failed - ${(error as Error).message}]`
        }
      };
    }
  }
  
  /**
   * Helper method to split text into manageable chunks
   */
  private splitIntoChunks(text: string, maxChunkSize: number): string[] {
    const chunks: string[] = [];
    const paragraphs = text.split(/\n\s*\n/);
    
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
      // If adding this paragraph would exceed the limit
      if (currentChunk.length + paragraph.length + 2 > maxChunkSize) {
        // If the current chunk is already too big, we need to split the paragraph
        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = '';
        }
        
        // If the paragraph itself is too big, split it into sentences
        if (paragraph.length > maxChunkSize) {
          const sentenceSplit = paragraph.split(/(?<=[.!?])\s+/);
          let sentenceChunk = '';
          
          for (const sentence of sentenceSplit) {
            if ((sentenceChunk + sentence).length > maxChunkSize) {
              if (sentenceChunk) {
                chunks.push(sentenceChunk);
                sentenceChunk = sentence;
              } else {
                chunks.push(sentence);
              }
            } else {
              sentenceChunk += (sentenceChunk ? ' ' : '') + sentence;
            }
          }
          
          if (sentenceChunk) {
            chunks.push(sentenceChunk);
          }
        } else {
          currentChunk = paragraph;
        }
      } else {
        // Add paragraph to current chunk
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }
    
    // Add the last chunk if it exists
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }
  
  /**
   * Calculate similarity percentage between two strings
   */
  private calculateSimilarityPercentage(str1: string, str2: string): number {
    if (str1 === str2) return 100;
    if (str1.length === 0 || str2.length === 0) return 0;
    
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return Math.round((1 - distance / maxLength) * 100);
  }
  
  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    
    // Create a matrix of size (m+1) x (n+1)
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    // Initialize the first row and column
    for (let i = 0; i <= m; i++) {
      dp[i][0] = i;
    }
    for (let j = 0; j <= n; j++) {
      dp[0][j] = j;
    }
    
    // Fill the matrix
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(
            dp[i - 1][j],     // deletion
            dp[i][j - 1],     // insertion
            dp[i - 1][j - 1]  // substitution
          );
        }
      }
    }
    
    return dp[m][n];
  }
}

// Export a default instance
export const llmRouter = new LLMRouter();