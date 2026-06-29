import { Express, Request, Response, NextFunction } from "express";
import multer from "multer";
import { extractTextFromFile } from "./api/documentParser";
import { checkForAI } from "./api/gptZero";
import { searchGoogle, fetchUrlContent } from "./api/googleSearch";
import { conductAdvancedResearch } from "./api/advancedResearch";
import { getEnhancementSuggestions } from "./api/enhancementSuggestions";
import path from "path";

// Define the types here to avoid circular dependencies
interface DocumentInput {
  content: string;
  filename?: string;
  mimeType?: string;
  metadata?: {
    pageCount?: number;
    info?: Record<string, any>;
    version?: string;
    [key: string]: any;
  };
}

interface AIDetectionResult {
  isAI: boolean;
  probability: number;
}

// Set up multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB limit
});

export async function registerRoutes(app: Express): Promise<Express> {
  // Basic API test
  app.get("/api/check-api", async (_req: Request, res: Response) => {
    try {
      // Check if API keys are available (don't expose the actual keys)
      const apiStatus = {
        status: "operational",
        api_keys: {
          openai: process.env.OPENAI_API_KEY ? "configured" : "missing",
          anthropic: process.env.ANTHROPIC_API_KEY ? "configured" : "missing",
          perplexity: process.env.PERPLEXITY_API_KEY ? "configured" : "missing"
        },
        timestamp: new Date().toISOString()
      };
      
      console.log("API Status Check:", {
        openai: process.env.OPENAI_API_KEY ? "✓" : "✗",
        anthropic: process.env.ANTHROPIC_API_KEY ? "✓" : "✗",  
        perplexity: process.env.PERPLEXITY_API_KEY ? "✓" : "✗"
      });
      
      res.json(apiStatus);
    } catch (error: any) {
      console.error("Error checking API status:", error);
      res.status(500).json({ message: error.message || "Error checking API status" });
    }
  });

  // Extract text from an uploaded file
  app.post("/api/extract-text", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const uploadedFile = req.file;
      const documentInput = await extractTextFromFile(uploadedFile);
      res.json(documentInput);
    } catch (error: any) {
      console.error("Error extracting text:", error);
      res.status(500).json({ message: error.message || "Error extracting text from file" });
    }
  });

  // Check if a document is AI-generated
  app.post("/api/check-ai", async (req: Request, res: Response) => {
    try {
      const document: DocumentInput = req.body;
      
      if (!document.content) {
        return res.status(400).json({ message: "Document content is required" });
      }
      
      const result = await checkForAI(document);
      res.json(result);
    } catch (error: any) {
      console.error("Error checking for AI:", error);
      res.status(500).json({ message: error.message || "Error checking for AI" });
    }
  });

  // PURE PASS-THROUGH SINGLE ANALYSIS - Direct to LLM with no custom algorithms
  app.post("/api/analyze", async (req: Request, res: Response) => {
    try {
      const { content, provider = "openai" } = req.body;
      
      if (!content) {
        return res.status(400).json({ 
          error: true, 
          message: "Document content is required",
          formattedReport: "Error: Document content is required",
          provider: provider,
          overallScore: 0,
          surface: { grammar: 0, structure: 0, jargonUsage: 0, surfaceFluency: 0 },
          deep: { conceptualDepth: 0, inferentialContinuity: 0, semanticCompression: 0, logicalLaddering: 0, originality: 0 }
        });
      }
      
      // Import the direct analysis methods
      const { 
        directOpenAIAnalyze, 
        directAnthropicAnalyze, 
        directPerplexityAnalyze 
      } = await import('./services/directLLM');
      
      // Perform direct analysis with the specified provider
      console.log(`DIRECT ${provider.toUpperCase()} PASSTHROUGH FOR ANALYSIS`);
      
      let directResult;
      
      try {
        switch (provider.toLowerCase()) {
          case 'anthropic':
            directResult = await directAnthropicAnalyze(content);
            break;
          case 'perplexity':
            directResult = await directPerplexityAnalyze(content);
            break;
          case 'openai':
          default:
            directResult = await directOpenAIAnalyze(content);
            break;
        }
        
        // Format the result for frontend display
        const extractQuote = (content: string, position: number): string => {
          if (!content) return "";
          const words = content.split(/\s+/);
          const start = Math.max(0, Math.min(Math.floor(words.length * position / 100) - 10, words.length - 20));
          const extract = words.slice(start, start + 20).join(" ");
          return extract || "Sample quote not available";
        };
        
        const getScoreRating = (score: number): string => {
          if (score >= 95) return "Exceptional";
          if (score >= 90) return "Very Strong";
          if (score >= 85) return "Strong";
          if (score >= 80) return "Moderate";
          if (score >= 70) return "Basic";
          if (score >= 60) return "Weak";
          if (score >= 40) return "Very Weak";
          return "Critically Deficient";
        };
        
        const formattedResult = {
          id: 0,
          documentId: 0,
          provider: directResult.provider || provider,
          summary: directResult.analysis?.substring(0, 300) + "..." || "Analysis not available",
          overallScore: directResult.overallScore,
          overallAssessment: directResult.analysis?.substring(0, 500) || "Analysis not available",
          dimensions: {
            definitionCoherence: {
              name: "Definition Coherence",
              rating: getScoreRating(directResult.deep?.claimNecessity || 60),
              description: "How well concepts are defined and build on each other",
              quote: extractQuote(content, 10)
            },
            claimFormation: {
              name: "Claim Formation", 
              rating: getScoreRating(directResult.deep?.conceptualDepth || 60),
              description: "How clearly claims are formulated and supported",
              quote: extractQuote(content, 30)
            },
            inferentialContinuity: {
              name: "Inferential Continuity",
              rating: getScoreRating(directResult.deep?.inferentialContinuity || 60),
              description: "How clearly claims follow from previous claims",
              quote: extractQuote(content, 50)
            },
            semanticLoad: {
              name: "Semantic Compression",
              rating: getScoreRating(directResult.deep?.semanticCompression || 60),
              description: "How much meaning is packed into minimal language",
              quote: extractQuote(content, 70)
            },
            jargonDetection: {
              name: "Jargon Usage",
              rating: getScoreRating(directResult.deep?.originality || 60),
              description: "How appropriately technical language is employed",
              quote: extractQuote(content, 20)
            },
            surfaceComplexity: {
              name: "Surface Structure",
              rating: getScoreRating(directResult.deep?.depthFluency || 60), 
              description: "How well the text is organized at a high level",
              quote: extractQuote(content, 40)
            },
            deepComplexity: {
              name: "Logical Laddering",
              rating: getScoreRating(directResult.deep?.logicalLaddering || 60),
              description: "How well the text builds recursive argument structures",
              quote: extractQuote(content, 60)
            }
          },
          analysis: directResult.analysis,
          rawResponse: directResult,
          createdAt: new Date().toISOString()
        };
        
        // Return the result to the client
        res.json(formattedResult);
      } catch (analysisError: any) {
        console.error(`Error with direct ${provider} analysis:`, analysisError);
        res.status(500).json({ 
          message: `Error analyzing document with direct ${provider} passthrough`, 
          error: analysisError.message 
        });
      }
    } catch (error: any) {
      console.error("Error starting document analysis:", error);
      res.status(500).json({ message: error.message || "Error starting document analysis" });
    }
  });

  // PURE PASS-THROUGH COMPARISON - Direct LLM with no custom algorithms
  app.post("/api/compare", async (req: Request, res: Response) => {
    try {
      const { documentA, documentB, provider = "openai" } = req.body;
      
      if (!documentA?.content || !documentB?.content) {
        return res.status(400).json({ message: "Two documents with content are required" });
      }
      
      // Import the direct analysis methods
      const { 
        directOpenAIAnalyze, 
        directAnthropicAnalyze, 
        directPerplexityAnalyze 
      } = await import('./services/directLLM');
      
      try {
        // Analyze both documents with the specified provider
        console.log(`DIRECT ${provider.toUpperCase()} PASSTHROUGH FOR COMPARISON`);
        
        let analyzeWithProvider;
        
        switch (provider.toLowerCase()) {
          case 'anthropic':
            analyzeWithProvider = directAnthropicAnalyze;
            break;
          case 'perplexity':
            analyzeWithProvider = directPerplexityAnalyze;
            break;
          case 'openai':
          default:
            analyzeWithProvider = directOpenAIAnalyze;
            break;
        }
        
        // Analyze both documents
        const resultA = await analyzeWithProvider(documentA.content);
        const resultB = await analyzeWithProvider(documentB.content);
        
        // Helper functions for formatting
        const extractQuote = (content: string, position: number): string => {
          if (!content) return "";
          const words = content.split(/\s+/);
          const start = Math.max(0, Math.min(Math.floor(words.length * position / 100) - 10, words.length - 20));
          const extract = words.slice(start, start + 20).join(" ");
          return extract || "Sample quote not available";
        };
        
        const getScoreRating = (score: number): string => {
          if (score >= 95) return "Exceptional";
          if (score >= 90) return "Very Strong";
          if (score >= 85) return "Strong";
          if (score >= 80) return "Moderate";
          if (score >= 70) return "Basic";
          if (score >= 60) return "Weak";
          if (score >= 40) return "Very Weak";
          return "Critically Deficient";
        };
        
        // Format the results
        const formatResult = (result: any, content: string) => ({
          id: 0,
          documentId: 0,
          provider: result.provider || provider,
          summary: result.analysis || "Analysis not available",
          overallScore: result.overallScore,
          overallAssessment: result.analysis || "Analysis not available",
          dimensions: {
            definitionCoherence: {
              name: "Definition Coherence",
              rating: getScoreRating(result.deep?.claimNecessity || 60),
              description: "How well concepts are defined and build on each other",
              quote: extractQuote(content, 10)
            },
            claimFormation: {
              name: "Claim Formation", 
              rating: getScoreRating(result.deep?.conceptualDepth || 60),
              description: "How clearly claims are formulated and supported",
              quote: extractQuote(content, 30)
            },
            inferentialContinuity: {
              name: "Inferential Continuity",
              rating: getScoreRating(result.deep?.inferentialContinuity || 60),
              description: "How clearly claims follow from previous claims",
              quote: extractQuote(content, 50)
            },
            semanticLoad: {
              name: "Semantic Compression",
              rating: getScoreRating(result.deep?.semanticCompression || 60),
              description: "How much meaning is packed into minimal language",
              quote: extractQuote(content, 70)
            },
            jargonDetection: {
              name: "Jargon Usage",
              rating: getScoreRating(result.deep?.originality || 60),
              description: "How appropriately technical language is employed",
              quote: extractQuote(content, 20)
            },
            surfaceComplexity: {
              name: "Surface Structure",
              rating: getScoreRating(result.deep?.depthFluency || 60), 
              description: "How well the text is organized at a high level",
              quote: extractQuote(content, 40)
            },
            deepComplexity: {
              name: "Logical Laddering",
              rating: getScoreRating(result.deep?.logicalLaddering || 60),
              description: "How well the text builds recursive argument structures",
              quote: extractQuote(content, 60)
            }
          },
          analysis: result.analysis,
          rawResponse: result,
          createdAt: new Date().toISOString()
        });
        
        const analysisA = formatResult(resultA, documentA.content);
        const analysisB = formatResult(resultB, documentB.content);
        
        // Create a comparison object
        const comparison = {
          id: 0,
          documentAId: 0,
          documentBId: 0,
          overallDifference: Math.abs(resultA.overallScore - resultB.overallScore),
          comparisonTable: [
            {
              dimension: "Definition Coherence",
              documentA: getScoreRating(resultA.deep?.claimNecessity || 60),
              documentB: getScoreRating(resultB.deep?.claimNecessity || 60)
            },
            {
              dimension: "Claim Formation", 
              documentA: getScoreRating(resultA.deep?.conceptualDepth || 60),
              documentB: getScoreRating(resultB.deep?.conceptualDepth || 60)
            },
            {
              dimension: "Inferential Continuity",
              documentA: getScoreRating(resultA.deep?.inferentialContinuity || 60),
              documentB: getScoreRating(resultB.deep?.inferentialContinuity || 60)
            },
            {
              dimension: "Semantic Compression",
              documentA: getScoreRating(resultA.deep?.semanticCompression || 60),
              documentB: getScoreRating(resultB.deep?.semanticCompression || 60)
            },
            {
              dimension: "Jargon Usage",
              documentA: getScoreRating(resultA.deep?.originality || 60),
              documentB: getScoreRating(resultB.deep?.originality || 60)
            },
            {
              dimension: "Surface Structure",
              documentA: getScoreRating(resultA.deep?.depthFluency || 60),
              documentB: getScoreRating(resultB.deep?.depthFluency || 60)
            },
            {
              dimension: "Logical Laddering",
              documentA: getScoreRating(resultA.deep?.logicalLaddering || 60),
              documentB: getScoreRating(resultB.deep?.logicalLaddering || 60)
            }
          ],
          documentA: {
            score: resultA.overallScore,
            strengths: [],
            style: []
          },
          documentB: {
            score: resultB.overallScore,
            strengths: [],
            style: []
          },
          finalJudgment: `Direct comparison using ${provider} evaluation. No custom algorithms were used.`,
          createdAt: new Date().toISOString()
        };
        
        // Return the results
        res.json({
          analysisA,
          analysisB,
          comparison,
          provider
        });
      } catch (comparisonError: any) {
        console.error(`Error with direct ${provider} comparison:`, comparisonError);
        res.status(500).json({ 
          message: `Error comparing documents with direct ${provider} passthrough`, 
          error: comparisonError.message 
        });
      }
    } catch (error: any) {
      console.error("Error starting document comparison:", error);
      res.status(500).json({ message: error.message || "Error starting document comparison" });
    }
  });

  // Share analysis results via email
  app.post("/api/share-via-email", async (req: Request, res: Response) => {
    // Not implemented without email service
    res.status(501).json({ 
      success: false, 
      message: "Email sharing not implemented in this version" 
    });
  });
  
  // Get enhancement suggestions from AI providers for rewriting
  app.post("/api/get-enhancement-suggestions", async (req: Request, res: Response) => {
    try {
      const { text, provider = "openai" } = req.body;
      
      if (!text) {
        return res.status(400).json({ 
          success: false, 
          message: "Text content is required" 
        });
      }
      
      console.log(`Getting enhancement suggestions from ${provider}...`);
      const suggestions = await getEnhancementSuggestions(text, provider);
      
      res.json({
        success: true,
        suggestions,
        provider
      });
    } catch (error: any) {
      console.error("Error getting enhancement suggestions:", error);
      res.status(500).json({ 
        success: false, 
        message: error.message || "Error getting enhancement suggestions" 
      });
    }
  });
  
  // Search Google for relevant information
  app.post("/api/search-google", async (req: Request, res: Response) => {
    try {
      const { query, numResults = 5 } = req.body;
      
      if (!query) {
        return res.status(400).json({ 
          success: false, 
          message: "Search query is required" 
        });
      }
      
      console.log(`Searching Google for: ${query}`);
      const searchResults = await searchGoogle(query, numResults);
      
      res.json({
        success: true,
        results: searchResults
      });
    } catch (error: any) {
      console.error("Error searching Google:", error);
      res.status(500).json({ 
        success: false, 
        message: error.message || "Error searching Google" 
      });
    }
  });
  
  // Fetch content from a URL
  app.post("/api/fetch-url-content", async (req: Request, res: Response) => {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ 
          success: false, 
          message: "URL is required" 
        });
      }
      
      console.log(`Fetching content from URL: ${url}`);
      const content = await fetchUrlContent(url);
      
      if (!content) {
        return res.status(404).json({
          success: false,
          message: "Could not extract content from the provided URL"
        });
      }
      
      // Limit content to 5000 characters to avoid overwhelming the LLMs
      const trimmedContent = content.length > 5000 ? content.substring(0, 5000) + "..." : content;
      
      res.json({
        success: true,
        content: trimmedContent
      });
    } catch (error: any) {
      console.error("Error fetching URL content:", error);
      res.status(500).json({ 
        success: false, 
        message: error.message || "Error fetching URL content" 
      });
    }
  });

  // PURE PASS-THROUGH REWRITE - Direct to LLM with no custom algorithms
  app.post("/api/rewrite", async (req: Request, res: Response) => {
    try {
      const { originalText, provider = "openai", options } = req.body;
      
      if (!originalText || !options?.instruction) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing required rewrite fields" 
        });
      }
      
      console.log(`Starting direct passthrough rewrite with ${provider}`);
      console.log(`Text size: ${originalText.length} characters`);
      console.log(`Instruction: ${options.instruction}`);
      
      // Import the direct rewrite method
      const { directRewrite } = await import('./services/directLLM');
      
      // Enhance instruction with web content if enhanced options are provided
      let enhancedInstruction = options.instruction;
      
      // Handle web content enrichment 
      if (options.selectedSuggestions?.length || options.selectedSearchResults?.length) {
        console.log("Using enhanced rewrite with external content");
        
        // Add AI suggestions to instruction if available
        if (options.includeSuggestions && options.selectedSuggestions?.length) {
          enhancedInstruction += "\n\nINCORPORATE THESE SPECIFIC SUGGESTIONS:\n";
          options.selectedSuggestions.forEach((suggestion: any, index: number) => {
            enhancedInstruction += `${index+1}. ${suggestion.title}: ${suggestion.content}\n`;
          });
          enhancedInstruction += "\n";
        }
        
        // Add web search results to instruction if available
        if (options.includeSearchResults && options.selectedSearchResults?.length) {
          enhancedInstruction += "\n\nINCORPORATE THIS INFORMATION FROM WEB SOURCES:\n";
          
          // Process each search result
          for (let i = 0; i < options.selectedSearchResults.length; i++) {
            const result = options.selectedSearchResults[i];
            
            // Add the search result title and snippet
            enhancedInstruction += `${i+1}. ${result.title}: ${result.snippet}\n`;
            
            // Fetch and add content from the URL if available
            try {
              console.log(`Fetching content from ${result.link}`);
              const content = await fetchUrlContent(result.link);
              if (content) {
                // Add a portion of the content to the instruction (limited to 500 chars)
                enhancedInstruction += `   Content excerpt: ${content.substring(0, 500)}...\n\n`;
              }
            } catch (error) {
              console.error(`Error fetching content from ${result.link}:`, error);
              // Continue with next result if one fails
            }
          }
        }
      }
      
      // Also support simple text-based content enrichment for all rewrite modes
      if (options.enrichmentContent) {
        enhancedInstruction += "\n\nINCORPORATE THIS ADDITIONAL INFORMATION:\n";
        
        if (typeof options.enrichmentContent === 'string') {
          // If it's a string, add it directly
          enhancedInstruction += options.enrichmentContent;
        } else if (Array.isArray(options.enrichmentContent)) {
          // If it's an array of content items
          options.enrichmentContent.forEach((item: any, index: number) => {
            if (typeof item === 'string') {
              enhancedInstruction += `${index+1}. ${item}\n`;
            } else if (item.title && item.content) {
              enhancedInstruction += `${index+1}. ${item.title}: ${item.content}\n`;
            }
          });
        }
      }
      
      try {
        // DIRECT PASS-THROUGH TO LLM - No custom algorithms
        console.log(`DIRECT ${provider.toUpperCase()} PASSTHROUGH FOR REWRITE`);
        
        // Pass the entire options object to include web content
        const result = await directRewrite(originalText, enhancedInstruction, provider, options);
        
        // Simply return the result from the LLM with no evaluation
        console.log(`DIRECT PASSTHROUGH REWRITE COMPLETE - Using ${provider}`);
        
        res.json({
          originalText: result.originalText,
          rewrittenText: result.rewrittenText,
          stats: result.stats,
          provider: result.provider || provider,
          directPassthrough: true,
          instruction: options.instruction
        });
      } catch (rewriteError: any) {
        console.error("Rewrite error:", rewriteError);
        res.status(500).json({
          success: false,
          message: rewriteError.message || "Error during rewrite process"
        });
      }
    } catch (error: any) {
      console.error("Error starting rewrite:", error);
      res.status(500).json({ 
        success: false, 
        message: error.message || "Error starting rewrite process" 
      });
    }
  });

  // PURE PASS-THROUGH TRANSLATION - Direct to LLM with no custom algorithms
  app.post("/api/translate", async (req: Request, res: Response) => {
    try {
      const { content, provider = "openai", options } = req.body;
      
      if (!content || !options?.sourceLanguage || !options?.targetLanguage) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing required translation fields" 
        });
      }
      
      console.log(`Starting direct passthrough translation with ${provider}`);
      console.log(`From ${options.sourceLanguage} to ${options.targetLanguage}`);
      console.log(`Text size: ${content.length} characters`);
      
      // Import the direct translate method
      const { directTranslate } = await import('./services/directLLM');
      
      try {
        // DIRECT PASS-THROUGH TO LLM - No custom algorithms
        console.log(`DIRECT ${provider.toUpperCase()} PASSTHROUGH FOR TRANSLATION`);
        
        // For smaller texts, just do a single request
        const result = await directTranslate(
          content, 
          options.sourceLanguage, 
          options.targetLanguage, 
          provider
        );
        
        // Return the result
        res.json({
          originalText: result.originalText,
          translatedText: result.translatedText,
          sourceLanguage: result.sourceLanguage,
          targetLanguage: result.targetLanguage,
          provider: result.provider || provider,
          directPassthrough: true,
          stats: result.stats
        });
      } catch (translationError: any) {
        console.error("Translation error:", translationError);
        res.status(500).json({
          success: false,
          message: translationError.message || "Error during translation process"
        });
      }
    } catch (error: any) {
      console.error("Error starting translation:", error);
      res.status(500).json({ 
        success: false, 
        message: error.message || "Error starting translation process" 
      });
    }
  });

  // Simple Email Sharing - Send report via email
  app.post("/api/share-simple-email", async (req: Request, res: Response) => {
    try {
      const { recipientEmail, senderEmail, senderName, subject, content } = req.body;
      
      if (!recipientEmail || !subject || !content) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: recipientEmail, subject, or content"
        });
      }
      
      // Import the email service
      const { sendSimpleEmail } = await import('./api/simpleEmailService');
      
      // Send the email
      const result = await sendSimpleEmail({
        recipientEmail,
        senderEmail,
        senderName,
        subject,
        content
      });
      
      return res.json(result);
    } catch (error: any) {
      console.error("Error sending email:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Error sending email"
      });
    }
  });
  
  // DIRECT MODEL REQUEST - Send instructions directly to AI models
  app.post("/api/direct-model-request", async (req: Request, res: Response) => {
    try {
      const { instructions, models = ['openai', 'claude', 'perplexity'] } = req.body;
      
      if (!instructions) {
        return res.status(400).json({ 
          success: false, 
          message: "Instructions parameter is required" 
        });
      }
      
      // Import our direct model request functions
      const { directMultiModelRequest } = await import('./api/directModelRequest');
      
      console.log(`Processing direct model request to: ${models.join(', ')}`);
      console.log(`Instructions: ${instructions.substring(0, 100)}...`);
      
      const results = await directMultiModelRequest(instructions, models);
      
      res.json({
        success: true,
        instructions,
        results,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Direct model request error:", error);
      res.status(500).json({ 
        success: false, 
        message: error.message || "Error processing direct model request" 
      });
    }
  });

  // Return the Express app
  return app;
}