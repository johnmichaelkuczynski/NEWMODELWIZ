import { apiRequest } from "./queryClient";
import { 
  DocumentInput, 
  AIDetectionResult, 
  DocumentAnalysis, 
  DocumentComparison,
  TranslationOptions,
  TranslationResult,
  RewriteOptions,
  RewriteResult,
  RewriteRequest
} from "./types";

// Function to analyze a single document with progress tracking
export async function analyzeDocument(
  document: DocumentInput,
  provider: string = "all", // Default to multi-provider analysis
  onProgress?: (progress: number) => void
): Promise<DocumentAnalysis> {
  try {
    console.log(`Analyzing with ${provider}...`);
    
    // Check if this is a large document that requires chunking (>5000 chars)
    const isLargeDocument = document.content.length > 5000;
    
    if (isLargeDocument && onProgress) {
      // For large documents, we'll use the streaming endpoint with progress updates
      onProgress(5); // Start with 5% to show we've begun
      
      // Start a progress polling mechanism for large documents
      let progressTimer = setInterval(async () => {
        try {
          const statusResp = await fetch('/api/analysis-status');
          if (statusResp.ok) {
            const { progress } = await statusResp.json();
            if (progress && onProgress) {
              onProgress(Math.min(95, progress)); // Cap at 95% until complete
            }
          }
        } catch (e) {
          // Silently fail - polling will continue
        }
      }, 1000);
      
      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            content: document.content,
            provider,
            requireProgress: isLargeDocument
          })
        });
        
        clearInterval(progressTimer);
        onProgress(100); // Complete
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API Error: ${response.status} - ${errorText.substring(0, 200)}`);
        }
        
        return await response.json();
      } catch (error) {
        clearInterval(progressTimer);
        console.error("Error analyzing document:", error);
        
        // Create a graceful fallback result with error information
        return {
          id: 0,
          documentId: 0,
          provider: `${provider} (Error)`,
          formattedReport: `**Analysis Error**\n\nWe encountered an issue while analyzing your text: ${error instanceof Error ? error.message : "Unknown error"}\n\nPlease try again or select a different AI provider.`,
          overallScore: 0,
          surface: {
            grammar: 0, 
            structure: 0, 
            jargonUsage: 0,
            surfaceFluency: 0
          },
          deep: {
            conceptualDepth: 0,
            inferentialContinuity: 0,
            semanticCompression: 0,
            logicalLaddering: 0,
            originality: 0
          },
          error: true
        };
      }
    } else {
      // For small documents, use the regular endpoint
      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            content: document.content,
            provider
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API Error: ${response.status} - ${errorText.substring(0, 200)}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error("Error analyzing document:", error);
        
        // Create a graceful fallback result with error information
        return {
          id: 0,
          documentId: 0,
          provider: `${provider} (Error)`,
          formattedReport: `**Analysis Error**\n\nWe encountered an issue while analyzing your text: ${error instanceof Error ? error.message : "Unknown error"}\n\nPlease try again or select a different AI provider.`,
          overallScore: 0,
          surface: {
            grammar: 0, 
            structure: 0, 
            jargonUsage: 0,
            surfaceFluency: 0
          },
          deep: {
            conceptualDepth: 0,
            inferentialContinuity: 0,
            semanticCompression: 0,
            logicalLaddering: 0,
            originality: 0
          },
          error: true
        };
      }
    }
  } catch (error) {
    console.error("Unexpected error analyzing document:", error);
    
    // Create a graceful fallback result with error information
    return {
      id: 0,
      documentId: 0,
      provider: `${provider} (Error)`,
      formattedReport: `**Analysis Error**\n\nWe encountered an issue while analyzing your text: ${error instanceof Error ? error.message : "Unknown error"}\n\nPlease try again or select a different AI provider.`,
      overallScore: 0,
      surface: {
        grammar: 0, 
        structure: 0, 
        jargonUsage: 0,
        surfaceFluency: 0
      },
      deep: {
        conceptualDepth: 0,
        inferentialContinuity: 0,
        semanticCompression: 0,
        logicalLaddering: 0,
        originality: 0
      },
      error: true
    };
  }
}

// Function to compare two documents
export async function compareDocuments(
  documentA: DocumentInput,
  documentB: DocumentInput,
  provider: string = "openai"
): Promise<{
  analysisA: DocumentAnalysis;
  analysisB: DocumentAnalysis;
  comparison: DocumentComparison;
}> {
  try {
    const response = await apiRequest("POST", "/api/intelligence-compare", {
      documentA,
      documentB,
      provider
    });
    return await response.json();
  } catch (error) {
    console.error("Error comparing documents:", error);
    throw error;
  }
}

// Function to check if a document is AI-generated using GPTZero
export async function checkForAI(
  document: DocumentInput
): Promise<AIDetectionResult> {
  try {
    const response = await apiRequest("POST", "/api/check-ai", document);
    return await response.json();
  } catch (error) {
    console.error("Error checking for AI:", error);
    throw error;
  }
}

// Function to extract text from uploaded file
export async function extractTextFromFile(
  file: File
): Promise<DocumentInput> {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/extract-text", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Error extracting text: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error extracting text from file:", error);
    throw error;
  }
}

// Function to translate a document
export async function translateDocument(
  content: string,
  options: TranslationOptions,
  provider: string = "openai",
  filename?: string
): Promise<TranslationResult> {
  try {
    const response = await apiRequest("POST", "/api/translate", {
      content,
      options,
      provider,
      filename,
    });
    return await response.json();
  } catch (error) {
    console.error("Error translating document:", error);
    throw error;
  }
}

// Function to rewrite a document with intelligence enhancement
export async function rewriteDocument(
  originalText: string,
  options: RewriteOptions,
  provider: string = "openai"
): Promise<RewriteResult> {
  try {
    const request: RewriteRequest = {
      originalText,
      options,
      provider
    };
    
    const response = await apiRequest("POST", "/api/rewrite", request);
    return await response.json();
  } catch (error) {
    console.error("Error rewriting document:", error);
    throw error;
  }
}

// Helper function to determine rating color class based on calibrated scoring
export function getRatingColorClass(rating: string): string {
  switch (rating) {
    case "Exceptional":
      return "bg-purple-100 text-purple-900"; // Blueprint-grade (95-98)
    case "Very Strong":
      return "bg-indigo-100 text-indigo-900"; // Blueprint-grade (90-94)
    case "Strong":
      return "bg-blue-100 text-blue-800"; // Advanced critique (85-89)
    case "Moderate":
      return "bg-teal-100 text-teal-800"; // Advanced critique (80-84)
    case "Basic":
      return "bg-green-100 text-green-800"; // Surface polish (70-79)
    case "Weak":
      return "bg-amber-100 text-amber-800"; // Surface polish (60-69)
    case "Very Weak":
      return "bg-orange-100 text-orange-800"; // Fluent but shallow (40-59)
    case "Critically Deficient":
      return "bg-red-100 text-red-800"; // Random noise (0-39)
    default:
      return "bg-gray-100 text-gray-800";
  }
}
