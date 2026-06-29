export interface TextChunk {
  id: string;
  content: string;
  wordCount: number;
  startIndex: number;
  endIndex: number;
  preview: string;
}

export interface DocumentInput {
  content: string;
  filename?: string;
  mimeType?: string;
  context?: string; // User-provided context like "This is an abstract" or "This is a fragment of a book"
  metadata?: {
    pageCount?: number;
    info?: Record<string, any>;
    version?: string;
    [key: string]: any;
  };
  chunks?: TextChunk[];
  selectedChunkIds?: string[];
  originalWordCount?: number;
}

export type AnalysisMode = 'single' | 'compare';

// Rewrite related types
export interface RewriteOptions {
  instruction: string; // User's specific instruction for the rewrite
  preserveLength?: boolean; // Keep within 100-110% of original length
  preserveDepth?: boolean; // Maintain or increase conceptual depth
  webContent?: {
    results: GoogleSearchResult[];
    contents: {[key: string]: string};
    instructions: string;
  };
  suggestions?: EnhancementSuggestion[];
}

export interface RewriteRequest {
  originalText: string;
  options: RewriteOptions;
  provider?: string;
}

export interface RewriteResult {
  originalText: string;
  rewrittenText: string;
  stats: {
    originalLength: number;
    rewrittenLength: number;
    lengthChange: number; // Percentage change
    instructionFollowed: string; // Description of how the instruction was applied
  };
}

export type DimensionRating = 'Exceptional' | 'Very Strong' | 'Strong' | 'Moderate' | 'Basic' | 'Weak' | 'Very Weak' | 'Critically Deficient';

export interface AnalysisDimension {
  name: string;
  rating: DimensionRating;
  description: string;
  quote: string;
}

export interface DocumentAnalysis {
  id?: number;
  documentId?: number;
  summary?: string;
  overallScore?: number;
  
  // Critical fields needed by the simplified interface
  formattedReport?: string;
  provider?: string;
  analysisType?: string; // To identify type of analysis (case_assessment, fiction_assessment, etc.)
  report?: string; // For backward compatibility
  
  // Multiple provider results for simultaneous analysis
  analysisResults?: Array<{
    provider: string;
    formattedReport: string;
  }>;
  
  // Dimension analysis data from response parser
  dimensions?: Record<string, {
    name?: string;
    score?: number;
    rating?: string;
    description?: string;
  }>;
  
  // Surface and deep analysis metrics
  surface?: {
    grammar?: number;
    structure?: number;
    jargonUsage?: number;
    surfaceFluency?: number;
  };
  
  deep?: {
    conceptualDepth?: number;
    inferentialContinuity?: number;
    semanticCompression?: number;
    logicalLaddering?: number;
    originality?: number;
  };
  
  // Full analysis text
  analysis?: string;
  
  // Optional fields for error handling and AI detection
  aiDetection?: AIDetectionResult;
  error?: boolean;
  
  // Assessment functions - How Well Does It Make Its Case & Fiction Assessment
  caseAssessment?: {
    overallCaseScore: number;
    proofEffectiveness: number;
    claimCredibility: number;
    nonTriviality: number;
    proofQuality: number;
    functionalWriting: number;
    detailedAssessment: string;
  };
  
  fictionAssessment?: {
    overallFictionScore: number;
    worldCoherence: number;
    emotionalPlausibility: number;
    thematicDepth: number;
    narrativeStructure: number;
    proseControl: number;
    detailedAssessment: string;
  };
}

export interface DocumentComparison {
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
    documentA: DimensionRating;
    documentB: DimensionRating;
  }[];
  finalJudgment: string;
}

export interface AIDetectionResult {
  isAI: boolean;
  probability: number;
}

export interface ShareViaEmailRequest {
  recipientEmail: string;
  senderEmail?: string;
  senderName?: string;
  subject: string;
  documentType: 'single' | 'comparison' | 'rewrite';
  analysisA: DocumentAnalysis;
  analysisB?: DocumentAnalysis;
  comparison?: DocumentComparison;
  rewrittenAnalysis?: DocumentAnalysis;
}

// Translation related types
export interface TranslationOptions {
  sourceLanguage: string;
  targetLanguage: string;
  model?: string;
  useDeepL?: boolean;
}

export interface TranslationProgress {
  currentChunk: number;
  totalChunks: number;
  status: 'processing' | 'completed' | 'failed';
  translatedContent?: string;
  error?: string;
}

export interface TranslationResult {
  success: boolean;
  translatedContent: string;
  error?: string;
}

export interface TranslationRequest {
  content: string;
  filename?: string;
  options: TranslationOptions;
  provider?: string;
}

// For enhanced rewrite functionality
export interface EnhancementSuggestion {
  title: string;
  content: string;
  source: string;
  relevanceScore: number; // 1-10 score
  selected?: boolean; // For UI tracking
}

export interface GoogleSearchResult {
  title: string;
  link: string;
  snippet: string;
  selected?: boolean; // For UI tracking
  pagemap?: {
    metatags?: Array<{
      [key: string]: string;
    }>;
  };
}

export interface EnhancedRewriteOptions extends RewriteOptions {
  selectedSuggestions?: EnhancementSuggestion[];
  selectedSearchResults?: GoogleSearchResult[];
  includeSuggestions?: boolean;
  includeSearchResults?: boolean;
}
