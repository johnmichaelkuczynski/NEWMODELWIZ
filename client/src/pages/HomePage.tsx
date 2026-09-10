import React, { useState, useEffect } from "react";
import ModeToggle from "@/components/ModeToggle";
import DocumentInput from "@/components/DocumentInput";
import DocumentResults from "@/components/DocumentResults";
import ComparativeResults from "@/components/ComparativeResults";
import AIDetectionModal from "@/components/AIDetectionModal";
import ProviderSelector, { LLMProvider } from "@/components/ProviderSelector";

import ChatDialog from "@/components/ChatDialog";
import SemanticDensityAnalyzer from "@/components/SemanticDensityAnalyzer";
import CaseAssessmentModal from "@/components/CaseAssessmentModal";
import { DocumentComparisonModal } from "@/components/DocumentComparisonModal";
import { FictionAssessmentModal } from "@/components/FictionAssessmentModal";
import { FictionAssessmentPopup } from "@/components/FictionAssessmentPopup";
import { FictionComparisonModal } from "@/components/FictionComparisonModal";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Brain, Trash2, FileEdit, Loader2, Zap, Clock, Sparkles, Download, Shield, RefreshCw, Upload, FileText, BookOpen, BarChart3, AlertCircle, FileCode, Search, Copy, CheckCircle, Target, ChevronUp, ChevronDown, MessageSquareWarning, Circle, ArrowRight, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { analyzeDocument, compareDocuments, checkForAI } from "@/lib/analysis";
import { AnalysisMode, DocumentInput as DocumentInputType, AIDetectionResult, DocumentAnalysis, DocumentComparison } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import CopyButton from "@/components/CopyButton";
import SendToButton from "@/components/SendToButton";
import { MathRenderer } from "@/components/MathRenderer";
import { trackEvent } from "@/lib/analytics";
import { Document as WordDocument, Packer, Paragraph as WordParagraph } from "docx";
import { jsPDF } from "jspdf";
import unicodePdfFontUrl from "@/assets/DejaVuSans.ttf?url";
import { normalizeMathNotation } from "@shared/mathNotation";

async function safeJson(response: Response): Promise<any> {
  try {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return { success: false, message: response.ok ? "Unexpected server response. Please try again." : `Request failed (${response.status}). Please try again.` };
    }
  } catch {
    return { success: false, message: "Network error. Please try again." };
  }
}

const HomePage: React.FC = () => {
  const { toast } = useToast();
  
  // State for analysis mode
  const [mode, setMode] = useState<AnalysisMode>("single");
  
  // State for analysis type (quick vs comprehensive)
  const [analysisType, setAnalysisType] = useState<"quick" | "comprehensive">("quick");

  // State for document inputs
  const [documentA, setDocumentA] = useState<DocumentInputType>({ content: "" });
  const [documentB, setDocumentB] = useState<DocumentInputType>({ content: "" });
  const [writingInstructions, setWritingInstructions] = useState("");
  const [generatedWriting, setGeneratedWriting] = useState("");
  const [isWriting, setIsWriting] = useState(false);
  const [writingProgress, setWritingProgress] = useState("");

  // State for analysis results
  const [analysisA, setAnalysisA] = useState<DocumentAnalysis | null>(null);
  const [analysisB, setAnalysisB] = useState<DocumentAnalysis | null>(null);
  const [comparison, setComparison] = useState<DocumentComparison | null>(null);



  // State for loading indicators
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [isAICheckLoading, setIsAICheckLoading] = useState(false);

  // State for showing results section
  const [showResults, setShowResults] = useState(false);

  // State for AI detection
  const [aiDetectionModalOpen, setAIDetectionModalOpen] = useState(false);
  const [currentAICheckDocument, setCurrentAICheckDocument] = useState<"A" | "B">("A");
  const [aiDetectionResult, setAIDetectionResult] = useState<AIDetectionResult | undefined>(undefined);


  
  // State for case assessment
  const [caseAssessmentModalOpen, setCaseAssessmentModalOpen] = useState(false);
  const [caseAssessmentResult, setCaseAssessmentResult] = useState<any>(null);
  const [isCaseAssessmentLoading, setIsCaseAssessmentLoading] = useState(false);
  
  // State for document comparison
  const [comparisonModalOpen, setComparisonModalOpen] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<any>(null);
  const [isComparisonLoading, setIsComparisonLoading] = useState(false);
  
  // State for fiction assessment
  const [fictionAssessmentModalOpen, setFictionAssessmentModalOpen] = useState(false);
  const [fictionComparisonModalOpen, setFictionComparisonModalOpen] = useState(false);
  const [currentFictionDocument, setCurrentFictionDocument] = useState<"A" | "B">("A");
  const [isFictionAssessmentLoading, setIsFictionAssessmentLoading] = useState(false);
  const [fictionAssessmentResult, setFictionAssessmentResult] = useState<any>(null);
  
  // Standalone Fiction Assessment Popup State
  const [fictionPopupOpen, setFictionPopupOpen] = useState(false);

  // State for maximize intelligence feature
  const [maximizeIntelligenceModalOpen, setMaximizeIntelligenceModalOpen] = useState(false);
  const [customInstructions, setCustomInstructions] = useState("");
  const [useExternalKnowledge, setUseExternalKnowledge] = useState(false);
  const [isMaximizeIntelligenceLoading, setIsMaximizeIntelligenceLoading] = useState(false);
  const [rewriteResult, setRewriteResult] = useState<string>("");
  const [rewriteResultsModalOpen, setRewriteResultsModalOpen] = useState(false);
  const [rewriteResultData, setRewriteResultData] = useState<any>(null);
  
  
  // Streaming state for real-time analysis
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');

  // Default instructions for maximize intelligence
  const defaultInstructions = `REWRITE IN SUCH THAT THE RESULTING DOCUMENT SCORES MAXIMALLY HIGH ON EACH OF THE FOLLOWING QUESTIONS (SO FAR AS THAT IS POSSIBLE WITHOUT TOTALLY CHANGING THE CONTENT), THE QUESTIONS IN QUESTION BEING:

IS IT INSIGHTFUL?
DOES IT DEVELOP POINTS? (OR, IF IT IS A SHORT EXCERPT, IS THERE EVIDENCE THAT IT WOULD DEVELOP POINTS IF EXTENDED)?
IS THE ORGANIZATION MERELY SEQUENTIAL (JUST ONE POINT AFTER ANOTHER, LITTLE OR NO LOGICAL SCAFFOLDING)? OR ARE THE IDEAS ARRANGED, NOT JUST SEQUENTIALLY BUT HIERARCHICALLY?
IF THE POINTS IT MAKES ARE NOT INSIGHTFUL, DOES IT OPERATE SKILLFULLY WITH CANONS OF LOGIC/REASONING.
ARE THE POINTS CLICHES? OR ARE THEY "FRESH"?
DOES IT USE TECHNICAL JARGON TO OBFUSCATE OR TO RENDER MORE PRECISE?
IS IT ORGANIC? DO POINTS DEVELOP IN AN ORGANIC, NATURAL WAY? DO THEY 'UNFOLD'? OR ARE THEY FORCED AND ARTIFICIAL?
DOES IT OPEN UP NEW DOMAINS? OR, ON THE CONTRARY, DOES IT SHUT OFF INQUIRY (BY CONDITIONALIZING FURTHER DISCUSSION OF THE MATTERS ON ACCEPTANCE OF ITS INTERNAL AND POSSIBLY VERY FAULTY LOGIC)?
IS IT ACTUALLY INTELLIGENT OR JUST THE WORK OF SOMEBODY WHO, JUDGING BY THE SUBJECT-MATTER, IS PRESUMED TO BE INTELLIGENT (BUT MAY NOT BE)?
IS IT REAL OR IS IT PHONY?
DO THE SENTENCES EXHIBIT COMPLEX AND COHERENT INTERNAL LOGIC?
IS THE PASSAGE GOVERNED BY A STRONG CONCEPT? OR IS THE ONLY ORGANIZATION DRIVEN PURELY BY EXPOSITORY (AS OPPOSED TO EPISTEMIC) NORMS?
IS THERE SYSTEM-LEVEL CONTROL OVER IDEAS? IN OTHER WORDS, DOES THE AUTHOR SEEM TO RECALL WHAT HE SAID EARLIER AND TO BE IN A POSITION TO INTEGRATE IT INTO POINTS HE HAS MADE SINCE THEN?
ARE THE POINTS 'REAL'? ARE THEY FRESH? OR IS SOME INSTITUTION OR SOME ACCEPTED VEIN OF PROPAGANDA OR ORTHODOXY JUST USING THE AUTHOR AS A MOUTH PIECE?
IS THE WRITING EVASIVE OR DIRECT?
ARE THE STATEMENTS AMBIGUOUS?
DOES THE PROGRESSION OF THE TEXT DEVELOP ACCORDING TO WHO SAID WHAT OR ACCORDING TO WHAT ENTAILS OR CONFIRMS WHAT?
DOES THE AUTHOR USE OTHER AUTHORS TO DEVELOP HIS IDEAS OR TO CLOAK HIS OWN LACK OF IDEAS?`;
  
  // State for LLM provider
  const [selectedProvider, setSelectedProvider] = useState<LLMProvider>("zhi1");

  // GPT Bypass Humanizer State - Following Exact Protocol
  const [boxA, setBoxA] = useState(""); // AI text to humanize
  const [boxB, setBoxB] = useState(""); // Human style sample  
  const [boxC, setBoxC] = useState(""); // Humanized output
  const [boxAScore, setBoxAScore] = useState<number | null>(null);
  const [boxBScore, setBoxBScore] = useState<number | null>(null);
  const [boxCScore, setBoxCScore] = useState<number | null>(null);
  const [humanizerCustomInstructions, setHumanizerCustomInstructions] = useState("");
  const [selectedStylePresets, setSelectedStylePresets] = useState<string[]>([]);
  const [selectedWritingSample, setSelectedWritingSample] = useState("Content-Neutral|Formal and Functional Relationships");
  const [humanizerProvider, setHumanizerProvider] = useState<LLMProvider>("zhi2"); // ZHI 2 default
  const [isHumanizerLoading, setIsHumanizerLoading] = useState(false);
  const [isReRewriteLoading, setIsReRewriteLoading] = useState(false);
  const [writingSamples, setWritingSamples] = useState<any>({});
  const [stylePresets, setStylePresets] = useState<any>({});
  const [chunks, setChunks] = useState<any[]>([]);
  const [selectedChunkIds, setSelectedChunkIds] = useState<string[]>([]);
  const [showChunkSelector, setShowChunkSelector] = useState(false);
  
  // Text Model Validator State
  const [validatorInputText, setValidatorInputText] = useState("");
  const [validatorMode, setValidatorMode] = useState<"reconstruction" | "isomorphism" | "mathmodel" | "autodecide" | "truth-isomorphism" | "math-truth-select" | "axiomatic-transform" | null>(null);
  const [validatorOutput, setValidatorOutput] = useState<string>("");
  const [validatorLoading, setValidatorLoading] = useState(false);
  // Multi-mode batch processing
  const [validatorMultiMode, setValidatorMultiMode] = useState(false);
  const [validatorSelectedModes, setValidatorSelectedModes] = useState<string[]>([]);
  const [validatorBatchResults, setValidatorBatchResults] = useState<Array<{mode: string; success: boolean; output?: string; error?: string}>>([]);
  const [validatorBatchLoading, setValidatorBatchLoading] = useState(false);
  const [validatorTargetDomain, setValidatorTargetDomain] = useState("");
  const [validatorFidelityLevel, setValidatorFidelityLevel] = useState<"conservative" | "aggressive">("conservative");
  const [validatorMathFramework, setValidatorMathFramework] = useState("variational-inference");
  const [validatorConstraintType, setValidatorConstraintType] = useState<"pure-swap" | "true-statements" | "historical">("pure-swap");
  const [validatorRigorLevel, setValidatorRigorLevel] = useState<"sketch" | "semi-formal" | "proof-ready">("semi-formal");
  const [showValidatorCustomization, setShowValidatorCustomization] = useState(false);
  const [validatorCustomInstructions, setValidatorCustomInstructions] = useState("");
  const [showRedoModal, setShowRedoModal] = useState(false);
  const [redoCustomInstructions, setRedoCustomInstructions] = useState("");
  const [validatorTruthMapping, setValidatorTruthMapping] = useState<"false-to-true" | "true-to-true" | "true-to-false">("false-to-true");
  const [validatorMathTruthMapping, setValidatorMathTruthMapping] = useState<"make-true" | "keep-true" | "make-false">("make-true");
  const [validatorLiteralTruth, setValidatorLiteralTruth] = useState(false);
  const [validatorLLMProvider, setValidatorLLMProvider] = useState<string>("zhi5"); // Default to ZHI 5
  
  // BOTTOMLINE Function State
  const [bottomlineAudience, setBottomlineAudience] = useState("");
  const [bottomlineObjective, setBottomlineObjective] = useState("");
  const [bottomlineIdea, setBottomlineIdea] = useState("");
  const [bottomlineLength, setBottomlineLength] = useState<"brief" | "medium" | "detailed">("medium");
  const [bottomlineTone, setBottomlineTone] = useState<"formal" | "professional" | "conversational" | "persuasive">("professional");
  const [bottomlineEmphasis, setBottomlineEmphasis] = useState("");
  const [bottomlineOutput, setBottomlineOutput] = useState("");
  const [bottomlineLoading, setBottomlineLoading] = useState(false);
  const [showBottomlinePanel, setShowBottomlinePanel] = useState(true); // Default to expanded for discoverability
  
  // Objections Function State (standalone - can use BOTTOMLINE output or custom input)
  const [objectionsOutput, setObjectionsOutput] = useState("");
  const [objectionsLoading, setObjectionsLoading] = useState(false);
  const [objectionsCustomInstructions, setObjectionsCustomInstructions] = useState("");
  const [showObjectionsPanel, setShowObjectionsPanel] = useState(true); // Default to expanded for discoverability
  const [objectionsInputText, setObjectionsInputText] = useState(""); // Standalone input
  const [objectionsAudience, setObjectionsAudience] = useState(""); // Standalone audience
  const [objectionsObjective, setObjectionsObjective] = useState(""); // Standalone objective

  // FULL SUITE Pipeline State - runs Batch → BOTTOMLINE → Objections in sequence
  const [fullSuiteLoading, setFullSuiteLoading] = useState(false);
  const [fullSuiteStage, setFullSuiteStage] = useState<"idle" | "batch" | "bottomline" | "objections" | "refine" | "complete" | "error">("idle");
  const [fullSuiteError, setFullSuiteError] = useState<string>("");
  const [showFullSuitePanel, setShowFullSuitePanel] = useState(true);
  const [fullSuiteAdditionalInfo, setFullSuiteAdditionalInfo] = useState("");
  const [fullSuiteRefinedOutput, setFullSuiteRefinedOutput] = useState<string>("");
  
  // Coherence Meter State
  const [coherenceInputText, setCoherenceInputText] = useState("");
  const [coherenceType, setCoherenceType] = useState<"logical-consistency" | "logical-cohesiveness" | "scientific-explanatory" | "thematic-psychological" | "instructional" | "motivational" | "mathematical" | "philosophical" | "auto-detect">("auto-detect");
  const [coherenceAnalysis, setCoherenceAnalysis] = useState<string>("");
  const [coherenceRewrite, setCoherenceRewrite] = useState<string>("");
  const [coherenceChanges, setCoherenceChanges] = useState<string>("");
  const [coherenceLoading, setCoherenceLoading] = useState(false);
  const [coherenceMode, setCoherenceMode] = useState<"analyze" | "rewrite" | null>(null);
  const [coherenceScore, setCoherenceScore] = useState<number | null>(null);
  const [coherenceAssessment, setCoherenceAssessment] = useState<"PASS" | "WEAK" | "FAIL" | null>(null);
  const [coherenceAggressiveness, setCoherenceAggressiveness] = useState<"conservative" | "moderate" | "aggressive">("aggressive");
  const [coherenceIsScientific, setCoherenceIsScientific] = useState(false);
  const [coherenceLogicalScore, setCoherenceLogicalScore] = useState<{score: number; assessment: string; analysis: string} | null>(null);
  const [coherenceScientificScore, setCoherenceScientificScore] = useState<{score: number; assessment: string; analysis: string; inaccuracies: string[]} | null>(null);
  const [coherenceCorrectionsApplied, setCoherenceCorrectionsApplied] = useState<string[]>([]);
  const [coherenceRewriteAccuracyScore, setCoherenceRewriteAccuracyScore] = useState<number | null>(null);
  const [coherenceProcessingMode, setCoherenceProcessingMode] = useState<"simple" | "outline-guided">("simple");
  const [mathProofCorrectedProof, setMathProofCorrectedProof] = useState<string>("");
  const [mathProofTheoremStatus, setMathProofTheoremStatus] = useState<"TRUE" | "FALSE" | "PARTIALLY_TRUE" | null>(null);
  const [mathProofOriginalTheorem, setMathProofOriginalTheorem] = useState<string>("");
  const [mathProofCorrectedTheorem, setMathProofCorrectedTheorem] = useState<string | null>(null);
  const [mathProofStrategy, setMathProofStrategy] = useState<string>("");
  const [mathProofKeyCorrections, setMathProofKeyCorrections] = useState<string[]>([]);
  const [mathProofValidityScore, setMathProofValidityScore] = useState<number | null>(null);
  const [mathProofIsCorrected, setMathProofIsCorrected] = useState(false);
  // Mathematical Proof Validity Analysis State (veridicality - is the proof actually true?)
  const [coherenceIsMathematical, setCoherenceIsMathematical] = useState(false);
  const [mathValidityAnalysis, setMathValidityAnalysis] = useState<string>("");
  const [mathValidityScore, setMathValidityScore] = useState<number | null>(null);
  const [mathValidityVerdict, setMathValidityVerdict] = useState<"VALID" | "FLAWED" | "INVALID" | null>(null);
  const [mathValiditySubscores, setMathValiditySubscores] = useState<{claimTruth: number; inferenceValidity: number; boundaryConditions: number; overallSoundness: number} | null>(null);
  const [mathValidityFlaws, setMathValidityFlaws] = useState<string[]>([]);
  const [mathValidityCounterexamples, setMathValidityCounterexamples] = useState<string[]>([]);
  const [coherenceChunks, setCoherenceChunks] = useState<Array<{id: string, text: string, preview: string}>>([]);
  const [selectedCoherenceChunks, setSelectedCoherenceChunks] = useState<string[]>([]);
  const [showCoherenceChunkSelector, setShowCoherenceChunkSelector] = useState(false);
  const [coherenceStageProgress, setCoherenceStageProgress] = useState<string>("");
  const [detectedCoherenceType, setDetectedCoherenceType] = useState<string | null>(null);
  
  
  // Load writing samples and style presets on component mount
  useEffect(() => {
    const loadWritingSamples = async () => {
      try {
        const response = await fetch('/api/writing-samples');
        if (response.ok) {
          const data = await response.json();
          setWritingSamples(data.samples);
          // Set default to "Formal and Functional Relationships" (CONTENT-NEUTRAL default)
          if (data.samples["CONTENT-NEUTRAL"] && data.samples["CONTENT-NEUTRAL"]["Formal and Functional Relationships"]) {
            setBoxB(data.samples["CONTENT-NEUTRAL"]["Formal and Functional Relationships"]);
          }
        }
      } catch (error) {
        console.error('Failed to load writing samples:', error);
      }
    };

    const loadStylePresets = async () => {
      try {
        const response = await fetch('/api/style-presets');
        if (response.ok) {
          const data = await response.json();
          setStylePresets(data.presets);
        }
      } catch (error) {
        console.error('Failed to load style presets:', error);
      }
    };

    loadWritingSamples();
    loadStylePresets();
  }, []);

  // GPT Bypass Humanizer Functions - Following Exact Protocol
  
  // Debounce function for delayed execution
  const debounce = (func: Function, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  };

  // Automatic GPTZero evaluation (no button push needed)
  const evaluateTextAI = async (text: string, setScore: (score: number) => void) => {
    if (!text.trim()) return;

    try {
      const response = await fetch('/api/evaluate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Ensure we display the percentage correctly (not negative values)
          const humanPercentage = Math.max(0, Math.min(100, data.humanPercentage));
          setScore(humanPercentage);
        }
      }
    } catch (error) {
      console.error('AI evaluation error:', error);
    }
  };

  // File upload handler for PDF/Word/Doc
  const handleFileUpload = async (file: File, setter: (content: string) => void) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/extract-text', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to extract text from document');
      }

      const data = await response.json();
      setter(data.content);
      toast({
        title: "File Uploaded",
        description: `Successfully loaded ${file.name}`,
      });
    } catch (error) {
      console.error('File upload error:', error);
      toast({
        title: "Upload Failed", 
        description: "Could not read the file. Please try a different format.",
        variant: "destructive",
      });
    }
  };

  // Download text as file
  const handleDownloadText = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: "Download Started",
      description: `Downloading ${filename}`,
    });
  };

  const generatedParagraphs = (text: string) =>
    normalizeMathNotation(text).split(/\n\s*\n/).map(paragraph => paragraph.replace(/\s+/g, " ").trim()).filter(Boolean);

  const downloadGeneratedWord = async () => {
    const doc = new WordDocument({
      sections: [{
        properties: {},
        children: generatedParagraphs(generatedWriting).map(text => new WordParagraph({
          text,
          spacing: { after: 220, line: 360 },
        })),
      }],
    });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "generated-work.docx";
    anchor.click();
    URL.revokeObjectURL(url);
    trackEvent("generated_writing_downloaded", { format: "docx" });
  };

  const downloadGeneratedPdf = async () => {
    const pdf = new jsPDF({ unit: "pt", format: "letter" });
    const margin = 54;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const lineHeight = 16;
    let y = margin;
    const fontBytes = new Uint8Array(await (await fetch(unicodePdfFontUrl)).arrayBuffer());
    let fontBinary = "";
    for (let index = 0; index < fontBytes.length; index += 0x8000) {
      const chunk = fontBytes.subarray(index, index + 0x8000);
      for (let chunkIndex = 0; chunkIndex < chunk.length; chunkIndex++) {
        fontBinary += String.fromCharCode(chunk[chunkIndex]);
      }
    }
    pdf.addFileToVFS("DejaVuSans.ttf", btoa(fontBinary));
    pdf.addFont("DejaVuSans.ttf", "DejaVuSans", "normal");
    pdf.setFont("DejaVuSans", "normal");
    pdf.setFontSize(11);

    for (const paragraph of generatedParagraphs(generatedWriting)) {
      const lines = pdf.splitTextToSize(paragraph, pageWidth - margin * 2) as string[];
      for (const line of lines) {
        if (y + lineHeight > pageHeight - margin) {
          pdf.addPage();
          y = margin;
        }
        pdf.text(line, margin, y);
        y += lineHeight;
      }
      y += lineHeight * 0.65;
    }
    pdf.save("generated-work.pdf");
    trackEvent("generated_writing_downloaded", { format: "pdf" });
  };

  const handleWriteFromInstructions = async () => {
    if (!writingInstructions.trim()) {
      toast({
        title: "Instructions Required",
        description: "Tell the app what you want it to write.",
        variant: "destructive",
      });
      return;
    }

    setIsWriting(true);
    setGeneratedWriting("");
    setWritingProgress("Planning the requested work...");

    try {
      const response = await fetch("/api/writing/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructions: writingInstructions,
          provider: selectedProvider,
        }),
      });
      const data = await safeJson(response);
      if (!response.ok || !data?.jobId) {
        throw new Error(data?.message || "The requested writing could not be generated.");
      }

      if (data.usesLargeScaleCoherence) {
        setWritingProgress(`Large-scale coherence active: 0 sections completed`);
      }

      let completed: any = null;
      while (!completed) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const statusResponse = await fetch(`/api/writing/jobs/${data.jobId}`);
        const status = await safeJson(statusResponse);
        if (!statusResponse.ok) throw new Error(status?.message || "Unable to read writing progress");
        if (status.status === "failed") throw new Error(status.error || "Writing failed");
        setWritingProgress(
          status.usesLargeScaleCoherence
            ? `Large-scale coherence active: ${status.completedSections} of ${status.totalSections} sections completed`
            : "Writing within 10% of the requested word count...",
        );
        if (status.status === "complete") completed = status;
      }

      setGeneratedWriting(completed.output);
      setWritingProgress(
        `Complete: ${completed.actualWordCount.toLocaleString()} words (within 10% of the ${completed.requestedWordCount.toLocaleString()}-word target), plain text, ${completed.usesLargeScaleCoherence ? "large-scale coherence used" : "standard generation used"}`,
      );
      trackEvent("writing_generated", {
        provider: selectedProvider,
        instruction_character_count: writingInstructions.length,
        output_character_count: completed.output.length,
        requested_word_count: completed.requestedWordCount,
        used_large_scale_coherence: completed.usesLargeScaleCoherence,
      });
      toast({
        title: "Writing Complete",
        description: "The requested work appears directly below your instructions.",
      });
    } catch (error: any) {
      trackEvent("writing_generation_failed", { provider: selectedProvider });
      toast({
        title: "Writing Failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsWriting(false);
    }
  };

  // Text chunking for large documents (500+ words)
  const handleChunkText = async (text: string) => {
    try {
      const response = await fetch('/api/chunk-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, maxWords: 500 }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setChunks(data.chunks);
          setShowChunkSelector(true);
          toast({
            title: "Text Chunked",
            description: `Document divided into ${data.chunks.length} chunks of ~500 words each.`,
          });
        }
      }
    } catch (error) {
      console.error('Text chunking error:', error);
    }
  };

  // Main humanization function with surgical precision
  const handleHumanize = async () => {
    if (!boxA.trim() || !boxB.trim()) {
      toast({
        title: "Missing Input",
        description: "Both Box A (AI text) and Box B (human style sample) are required.",
        variant: "destructive",
      });
      return;
    }

    setIsHumanizerLoading(true);
    setBoxC("");
    setBoxCScore(null);

    try {
      const response = await fetch('/api/gpt-bypass-humanizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boxA,
          boxB,
          stylePresets: selectedStylePresets,
          provider: humanizerProvider,
          customInstructions: humanizerCustomInstructions,
          selectedChunkIds: selectedChunkIds.length > 0 ? selectedChunkIds : undefined,
          chunks: chunks.length > 0 ? chunks : undefined
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Humanization failed');
      }

      const data = await response.json();
      if (data.success && data.result) {
        setBoxC(data.result.humanizedText);
        
        // Automatically evaluate humanized text
        setTimeout(() => {
          evaluateTextAI(data.result.humanizedText, setBoxCScore);
        }, 1000);
        
        toast({
          title: "Humanization Complete!",
          description: `Text humanized with surgical precision. Original: ${data.result.originalScore || 'N/A'}% → Humanized: ${data.result.humanizedScore || 'Evaluating...'}% Human.`,
        });
      }
    } catch (error: any) {
      console.error('Humanization error:', error);
      toast({
        title: "Humanization Failed",
        description: error.message || "An error occurred during humanization.",
        variant: "destructive",
      });
    } finally {
      setIsHumanizerLoading(false);
    }
  };

  // Re-rewrite function for recursive rewriting
  const handleReRewrite = async () => {
    if (!boxC.trim() || !boxB.trim()) {
      toast({
        title: "Missing Input",
        description: "Both output text and style sample are required for re-rewrite.",
        variant: "destructive",
      });
      return;
    }

    setIsReRewriteLoading(true);

    try {
      const response = await fetch('/api/gpt-bypass-humanizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boxA: boxC, // Use current output as new input
          boxB,
          stylePresets: selectedStylePresets,
          provider: humanizerProvider,
          customInstructions: humanizerCustomInstructions + " [RECURSIVE REWRITE] Further improve human-like qualities and reduce AI detection."
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Re-rewrite failed');
      }

      const data = await response.json();
      if (data.success && data.result) {
        setBoxC(data.result.humanizedText);
        
        // Automatically evaluate re-rewritten text
        setTimeout(() => {
          evaluateTextAI(data.result.humanizedText, setBoxCScore);
        }, 1000);
        
        toast({
          title: "Re-rewrite Complete!",
          description: `Text re-rewritten recursively. New score: ${data.result.humanizedScore || 'Evaluating...'}% Human.`,
        });
      }
    } catch (error: any) {
      console.error('Re-rewrite error:', error);
      toast({
        title: "Re-rewrite Failed",
        description: error.message || "An error occurred during re-rewrite.",
        variant: "destructive",
      });
    } finally {
      setIsReRewriteLoading(false);
    }
  };

  // Download function for PDF/TXT/Word
  const downloadHumanizerResult = (format: 'pdf' | 'txt' | 'docx') => {
    if (!boxC.trim()) return;

    const filename = `humanized-text.${format}`;
    const blob = new Blob([boxC], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Download Complete",
      description: `Humanized text saved as ${filename}`,
    });
  };

  // Send functionality handlers
  const handleSendToHumanizer = (text: string) => {
    setBoxA(text);
    toast({
      title: "Text sent to Humanizer",
      description: "Text has been placed in Box A for humanization"
    });
  };

  const handleSendToIntelligence = (text: string) => {
    setDocumentA({ ...documentA, content: text });
    toast({
      title: "Text sent to Intelligence Analysis",
      description: "Text has been placed in the intelligence analysis input"
    });
  };

  const handleSendToChat = (text: string) => {
    // This will be handled by the ChatDialog component
    // For now, we can show a notification that the text will be available to chat
    toast({
      title: "Text available to Chat",
      description: "The text is now available as context for AI chat"
    });
  };

  // Text Model Validator Handler
  const handleValidatorProcess = async (mode: "reconstruction" | "isomorphism" | "mathmodel" | "autodecide" | "truth-isomorphism" | "math-truth-select" | "axiomatic-transform") => {
    if (!validatorInputText.trim()) {
      toast({
        title: "No Input Text",
        description: "Please enter text to validate",
        variant: "destructive"
      });
      return;
    }

    setValidatorMode(mode);
    setValidatorLoading(true);
    setValidatorOutput("");

    try {
      const response = await fetch('/api/text-model-validator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: validatorInputText,
          mode,
          targetDomain: validatorTargetDomain,
          fidelityLevel: validatorFidelityLevel,
          mathFramework: validatorMathFramework,
          constraintType: validatorConstraintType,
          rigorLevel: validatorRigorLevel,
          customInstructions: validatorCustomInstructions,
          truthMapping: validatorTruthMapping,
          mathTruthMapping: validatorMathTruthMapping,
          literalTruth: validatorLiteralTruth,
          llmProvider: validatorLLMProvider,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Validation failed');
      }

      const data = await response.json();
      if (data.success && data.output) {
        setValidatorOutput(data.output);
        toast({
          title: "Validation Complete!",
          description: `Text validated using ${mode} mode`,
        });
      }
    } catch (error: any) {
      console.error('Validator error:', error);
      toast({
        title: "Processing",
        description: "Retrying with a different AI model. Please wait...",
      });
      try {
        const retryProviders = ['zhi2', 'zhi1', 'zhi3', 'zhi4'].filter(p => p !== validatorLLMProvider);
        let retrySuccess = false;
        for (const retryProvider of retryProviders) {
          try {
            const retryResponse = await fetch("/api/text-model-validator", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: validatorInputText,
                mode,
                targetDomain: validatorTargetDomain,
                fidelityLevel: validatorFidelityLevel,
                mathFramework: validatorMathFramework,
                constraintType: validatorConstraintType,
                rigorLevel: validatorRigorLevel,
                customInstructions: validatorCustomInstructions,
                truthMapping: validatorTruthMapping,
                mathTruthMapping: validatorMathTruthMapping,
                literalTruth: validatorLiteralTruth,
                llmProvider: retryProvider,
              }),
            });
            if (retryResponse.ok) {
              const retryData = await retryResponse.json();
              if (retryData.success && retryData.output) {
                setValidatorOutput(retryData.output);
                toast({
                  title: "Validation Complete!",
                  description: `Completed using backup AI model`,
                });
                retrySuccess = true;
                break;
              }
            }
          } catch (e) {
            console.error(`Retry with ${retryProvider} failed:`, e);
          }
        }
        if (!retrySuccess) {
          toast({
            title: "Please Try Again",
            description: "All AI models are temporarily busy. Please try again in a moment.",
          });
        }
      } catch (retryError) {
        console.error('All retries failed:', retryError);
        toast({
          title: "Please Try Again",
          description: "All AI models are temporarily busy. Please try again in a moment.",
        });
      }
    } finally {
      setValidatorLoading(false);
    }
  };

  const handleValidatorClear = () => {
    setValidatorInputText("");
    setValidatorOutput("");
    setValidatorMode(null);
    setShowValidatorCustomization(false);
    setValidatorCustomInstructions("");
    setValidatorBatchResults([]);
    setValidatorSelectedModes([]);
  };

  // Toggle mode selection for batch processing
  const toggleValidatorModeSelection = (mode: string) => {
    setValidatorSelectedModes(prev => 
      prev.includes(mode) 
        ? prev.filter(m => m !== mode) 
        : [...prev, mode]
    );
  };

  // Batch process multiple modes at once
  const handleValidatorBatchProcess = async () => {
    if (!validatorInputText.trim()) {
      toast({
        title: "No Input Text",
        description: "Please enter text to validate",
        variant: "destructive"
      });
      return;
    }

    if (validatorSelectedModes.length === 0) {
      toast({
        title: "No Modes Selected",
        description: "Please select at least one mode to run",
        variant: "destructive"
      });
      return;
    }

    setValidatorBatchLoading(true);
    setValidatorBatchResults([]);
    setValidatorOutput("");

    try {
      // In batch mode: use aggressive settings, same domain, maximal formalization, maximal truth
      const response = await fetch('/api/text-model-validator/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: validatorInputText,
          modes: validatorSelectedModes,
          targetDomain: "", // Same as original domain
          fidelityLevel: "aggressive", // Always aggressive in batch mode
          mathFramework: "axiomatic-set-theory", // Maximal formalization
          constraintType: "true-statements", // Maximal truth objective
          rigorLevel: "maximal", // Maximal rigor
          customInstructions: validatorCustomInstructions,
          truthMapping: "maximal-truth", // Maximal truth mapping
          mathTruthMapping: "maximal-truth", // Maximal math truth mapping
          literalTruth: true, // Enable literal truth mode
          llmProvider: validatorLLMProvider,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Batch validation failed');
      }

      const data = await response.json();
      console.log('Batch validation response:', data);
      if (data.success && data.results) {
        console.log('Setting batch results:', data.results.length, 'items');
        setValidatorBatchResults(data.results);
        toast({
          title: "Batch Validation Complete!",
          description: `Processed ${data.successfulModes}/${data.totalModes} modes successfully`,
        });
      } else {
        console.error('Batch validation response missing results:', data);
      }
    } catch (error: any) {
      console.error('Batch validator error:', error);
      toast({
        title: "Please Try Again",
        description: "Some AI models are temporarily busy. Please try again in a moment.",
      });
    } finally {
      setValidatorBatchLoading(false);
    }
  };

  // BOTTOMLINE Function Handler - synthesizes analysis into final polished output
  const handleBottomline = async () => {
    if (!validatorInputText.trim()) {
      toast({
        title: "No Input Text",
        description: "Please enter your original text first",
        variant: "destructive"
      });
      return;
    }

    const effectiveAudience = bottomlineAudience.trim() || "Educated audience looking for actionable business ideas";
    const effectiveObjective = bottomlineObjective.trim() || "Educated audience looking for actionable business ideas";

    setBottomlineLoading(true);
    setBottomlineOutput("");

    try {
      // Collect intermediate results if any exist
      const intermediateResults: Record<string, string> = {};
      
      // From single mode output
      if (validatorOutput && validatorMode) {
        intermediateResults[validatorMode] = validatorOutput;
      }
      
      // From batch results
      validatorBatchResults.forEach(result => {
        if (result.success && result.output) {
          intermediateResults[result.mode] = result.output;
        }
      });

      const response = await fetch('/api/text-model-validator/bottomline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalText: validatorInputText,
          intermediateResults,
          audience: effectiveAudience,
          objective: effectiveObjective,
          idea: bottomlineIdea,
          length: bottomlineLength,
          tone: bottomlineTone,
          emphasis: bottomlineEmphasis,
          llmProvider: validatorLLMProvider,
        }),
      });

      const data = await safeJson(response);
      if (!response.ok || !data?.success || !data?.output) {
        throw new Error(data?.message || 'BOTTOMLINE synthesis failed');
      }
      {
        setBottomlineOutput(data.output);
        toast({
          title: "BOTTOMLINE Complete!",
          description: `Final output generated for ${effectiveAudience}`,
        });
      }
    } catch (error: any) {
      console.error('BOTTOMLINE error:', error);
      toast({
        title: "BOTTOMLINE Failed",
        description: error.message || "An error occurred during synthesis.",
        variant: "destructive",
      });
    } finally {
      setBottomlineLoading(false);
    }
  };

  // Objections Function Handler - generates 25 objections and counter-objections
  const handleObjections = async (useBottomlineOutput: boolean = false) => {
    // Determine which input to use
    const inputText = useBottomlineOutput ? bottomlineOutput : objectionsInputText;
    const rawAudience = useBottomlineOutput ? bottomlineAudience : objectionsAudience;
    const rawObjective = useBottomlineOutput ? bottomlineObjective : objectionsObjective;
    const audience = rawAudience.trim() || "Educated audience looking for actionable business ideas";
    const objective = rawObjective.trim() || "Educated audience looking for actionable business ideas";
    
    if (!inputText.trim()) {
      toast({
        title: "No Input Provided",
        description: useBottomlineOutput 
          ? "Please run the BOTTOMLINE function first to generate content."
          : "Please enter text to analyze for objections.",
        variant: "destructive"
      });
      return;
    }

    setObjectionsLoading(true);
    setObjectionsOutput("");

    try {
      const response = await fetch('/api/text-model-validator/objections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bottomlineOutput: inputText,
          audience: audience,
          objective: objective,
          idea: useBottomlineOutput ? bottomlineIdea : "",
          tone: useBottomlineOutput ? bottomlineTone : "professional",
          emphasis: useBottomlineOutput ? bottomlineEmphasis : "",
          customInstructions: objectionsCustomInstructions,
          llmProvider: validatorLLMProvider,
        }),
      });

      const data = await safeJson(response);
      if (!response.ok || !data?.success || !data?.output) {
        throw new Error(data?.message || 'Objections generation failed');
      }
      setObjectionsOutput(data.output);
      toast({
        title: "Objections Generated!",
        description: "25 likely objections and responses have been generated.",
      });
    } catch (error: any) {
      console.error('Objections error:', error);
      toast({
        title: "Objections Generation Failed",
        description: error.message || "An error occurred during objections generation.",
        variant: "destructive",
      });
    } finally {
      setObjectionsLoading(false);
    }
  };

  // FULL SUITE Handler - Runs Batch → BOTTOMLINE → Objections in sequence
  const handleRunFullSuite = async () => {
    // Validate inputs
    if (!validatorInputText.trim()) {
      toast({
        title: "No Input Text",
        description: "Please enter text to analyze.",
        variant: "destructive"
      });
      return;
    }

    const fsAudience = bottomlineAudience.trim() || "Educated audience looking for actionable business ideas";
    const fsObjective = bottomlineObjective.trim() || "Educated audience looking for actionable business ideas";

    // Initialize pipeline
    setFullSuiteLoading(true);
    setFullSuiteStage("batch");
    setFullSuiteError("");
    
    // Clear previous outputs
    setValidatorBatchResults([]);
    setBottomlineOutput("");
    setObjectionsOutput("");
    setFullSuiteRefinedOutput("");

    const baseModes = ["reconstruction", "isomorphism", "mathmodel", "truth-isomorphism", "math-truth-select"];
    const includeAxiomatic = validatorSelectedModes.includes("axiomatic-transform");
    const allModes = includeAxiomatic ? [...baseModes, "axiomatic-transform"] : baseModes;

    try {
      // ============ STAGE 1: BATCH PROCESSING ============
      console.log("[FULL SUITE] Stage 1: Running batch processing...");
      
      const batchResults: Array<{mode: string; success: boolean; output?: string; error?: string}> = [];
      
      for (const mode of allModes) {
        try {
          const response = await fetch("/api/text-model-validator", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: validatorInputText,
              mode: mode,
              targetDomain: validatorTargetDomain || undefined,
              // Enforced aggressive settings for Full Suite
              fidelityLevel: "aggressive",
              mathFramework: "axiomatic-set-theory",
              constraintType: "true-statements",
              rigorLevel: "proof-ready",
              literalTruth: true,
              llmProvider: validatorLLMProvider,
            }),
          });

          const data = await safeJson(response);
          if (!response.ok || !data?.success || !data?.output) {
            batchResults.push({ mode, success: false, error: data?.message || "Processing failed" });
          } else {
            batchResults.push({ mode, success: true, output: data.output });
          }
        } catch (error: any) {
          batchResults.push({ mode, success: false, error: error.message || "Network error" });
        }
      }

      setValidatorBatchResults(batchResults);

      // Check if we have at least some successful results
      const successfulResults = batchResults.filter(r => r.success);
      if (successfulResults.length === 0) {
        throw new Error("All batch processing modes failed. Cannot proceed to BOTTOMLINE.");
      }

      console.log(`[FULL SUITE] Stage 1 complete: ${successfulResults.length}/${allModes.length} modes succeeded`);

      // ============ STAGE 2: BOTTOMLINE ============
      setFullSuiteStage("bottomline");
      console.log("[FULL SUITE] Stage 2: Running BOTTOMLINE synthesis...");

      // Build intermediate results from batch
      const intermediateResults: Record<string, string> = {};
      for (const result of successfulResults) {
        intermediateResults[result.mode] = result.output!;
      }

      const bottomlineResponse = await fetch('/api/text-model-validator/bottomline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalText: validatorInputText,
          intermediateResults,
          audience: fsAudience,
          objective: fsObjective,
          idea: bottomlineIdea,
          length: bottomlineLength,
          tone: bottomlineTone,
          emphasis: bottomlineEmphasis,
          additionalInfo: fullSuiteAdditionalInfo,
          llmProvider: validatorLLMProvider,
        }),
      });

      const bottomlineData = await safeJson(bottomlineResponse);
      if (!bottomlineResponse.ok || !bottomlineData?.success || !bottomlineData?.output) {
        throw new Error(bottomlineData?.message || 'BOTTOMLINE synthesis failed');
      }

      setBottomlineOutput(bottomlineData.output);
      console.log("[FULL SUITE] Stage 2 complete: BOTTOMLINE synthesis succeeded");

      // ============ STAGE 3: OBJECTIONS ============
      setFullSuiteStage("objections");
      console.log("[FULL SUITE] Stage 3: Running Objections generation...");

      const objectionsResponse = await fetch('/api/text-model-validator/objections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bottomlineOutput: bottomlineData.output,
          audience: fsAudience,
          objective: fsObjective,
          idea: bottomlineIdea,
          tone: bottomlineTone,
          emphasis: bottomlineEmphasis,
          customInstructions: objectionsCustomInstructions,
          llmProvider: validatorLLMProvider,
        }),
      });

      const objectionsData = await safeJson(objectionsResponse);
      if (!objectionsResponse.ok || !objectionsData?.success || !objectionsData?.output) {
        throw new Error(objectionsData?.message || 'Objections generation failed');
      }

      setObjectionsOutput(objectionsData.output);
      console.log("[FULL SUITE] Stage 3 complete: Objections generated");

      // ============ STAGE 4: REFINED REWRITE (in light of objections) ============
      setFullSuiteStage("refine");
      console.log("[FULL SUITE] Stage 4: Rewriting BOTTOMLINE in light of objections...");

      const refinedAdditionalInfo = `${fullSuiteAdditionalInfo ? fullSuiteAdditionalInfo + "\n\n" : ""}IMPORTANT REWRITE INSTRUCTIONS:
You are producing a REFINED version of a prior BOTTOMLINE synthesis. The prior version generated 25 objections from informed critics. Your task is to rewrite the BOTTOMLINE so that it directly anticipates, addresses, and neutralizes those objections — strengthening weak claims, qualifying overreaches, supplying missing justification, and incorporating the strongest counter-arguments inline. The result must read as a single polished document (not a Q&A), more rigorous and defensible than the original.

=== PRIOR BOTTOMLINE (to be rewritten) ===
${bottomlineData.output}

=== OBJECTIONS AND COUNTER-ARGUMENTS TO ADDRESS ===
${objectionsData.output}`;

      const refinedIntermediate: Record<string, string> = {
        ...intermediateResults,
        "prior-bottomline": bottomlineData.output,
        "objections": objectionsData.output,
      };

      const refinedResponse = await fetch('/api/text-model-validator/bottomline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalText: validatorInputText,
          intermediateResults: refinedIntermediate,
          audience: fsAudience,
          objective: fsObjective,
          idea: bottomlineIdea,
          length: bottomlineLength,
          tone: bottomlineTone,
          emphasis: bottomlineEmphasis,
          additionalInfo: refinedAdditionalInfo,
          llmProvider: validatorLLMProvider,
        }),
      });

      const refinedData = await safeJson(refinedResponse);
      if (refinedResponse.ok && refinedData?.success && refinedData?.output) {
        setFullSuiteRefinedOutput(refinedData.output);
        console.log("[FULL SUITE] Stage 4 complete: Refined rewrite generated");
      } else {
        console.warn("[FULL SUITE] Stage 4 skipped: refined rewrite failed", refinedData?.message);
      }

      // ============ COMPLETE ============
      setFullSuiteStage("complete");
      toast({
        title: "Full Suite Complete!",
        description: `Pipeline finished: ${successfulResults.length} analyses → BOTTOMLINE → Objections → Refined Rewrite`,
      });

    } catch (error: any) {
      console.error("[FULL SUITE] Pipeline error:", error);
      setFullSuiteStage("error");
      setFullSuiteError(error.message || "An error occurred during pipeline execution");
      toast({
        title: "Full Suite Failed",
        description: error.message || "Pipeline execution failed",
        variant: "destructive",
      });
    } finally {
      setFullSuiteLoading(false);
    }
  };

  // Coherence Meter Handlers
  const createCoherenceChunks = (text: string) => {
    const words = text.trim().split(/\s+/);
    const chunkSize = 400; // ~400 words per chunk
    const chunks: Array<{id: string, text: string, preview: string}> = [];
    
    for (let i = 0; i < words.length; i += chunkSize) {
      const chunkWords = words.slice(i, i + chunkSize);
      const chunkText = chunkWords.join(' ');
      const preview = chunkWords.slice(0, 20).join(' ') + (chunkWords.length > 20 ? '...' : '');
      
      chunks.push({
        id: `chunk-${i / chunkSize + 1}`,
        text: chunkText,
        preview: preview
      });
    }
    
    return chunks;
  };

  const handleCoherenceAnalyze = async () => {
    const wordCount = coherenceInputText.trim().split(/\s+/).length;
    
    if (!coherenceInputText.trim()) {
      toast({
        title: "No Input Text",
        description: "Please enter text to analyze for coherence",
        variant: "destructive"
      });
      return;
    }
    
    // If text is longer than 500 words, create chunks and show selector
    if (wordCount > 500) {
      const chunks = createCoherenceChunks(coherenceInputText);
      setCoherenceChunks(chunks);
      setSelectedCoherenceChunks(chunks.map(c => c.id)); // Select all by default
      setShowCoherenceChunkSelector(true);
      toast({
        title: "Text Too Long for Single Analysis",
        description: `Your text has ${wordCount} words. It has been divided into ${chunks.length} sections. Select which sections to analyze.`,
      });
      return;
    }

    setCoherenceLoading(true);
    setCoherenceMode("analyze");
    setCoherenceAnalysis("");
    setCoherenceScore(null);
    setCoherenceAssessment(null);
    setDetectedCoherenceType(null);

    try {
      const response = await fetch('/api/coherence-meter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: coherenceInputText,
          coherenceType,
          mode: "analyze"
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Analysis failed');
      }

      const data = await response.json();
      if (data.success) {
        setCoherenceAnalysis(data.analysis);
        setCoherenceScore(data.score);
        setCoherenceAssessment(data.assessment);
        
        // Handle mathematical proof dual assessment (coherence + validity)
        if (data.isMathematical) {
          setCoherenceIsMathematical(true);
          setCoherenceIsScientific(false);
          setCoherenceLogicalScore(null);
          setCoherenceScientificScore(null);
          // Set validity analysis data
          setMathValidityAnalysis(data.validityAnalysis);
          setMathValidityScore(data.validityScore);
          setMathValidityVerdict(data.validityVerdict);
          setMathValiditySubscores(data.validitySubscores);
          setMathValidityFlaws(data.flaws || []);
          setMathValidityCounterexamples(data.counterexamples || []);
          toast({
            title: "Mathematical Proof Analysis Complete!",
            description: `Coherence: ${data.coherenceScore}/10 | Validity: ${data.validityScore}/10 (${data.validityVerdict})`,
          });
        } else if (data.isScientificExplanatory) {
          // Handle scientific-explanatory dual assessment
          setCoherenceIsMathematical(false);
          setCoherenceIsScientific(true);
          setCoherenceLogicalScore(data.logicalConsistency);
          setCoherenceScientificScore(data.scientificAccuracy);
          // Clear validity data
          setMathValidityAnalysis("");
          setMathValidityScore(null);
          setMathValidityVerdict(null);
          setMathValiditySubscores(null);
          setMathValidityFlaws([]);
          setMathValidityCounterexamples([]);
          
          // Capture detected coherence type if auto-detected
          if (data.wasAutoDetected && data.detectedCoherenceType) {
            setDetectedCoherenceType(data.detectedCoherenceType);
          }
          
          const autoDetectMsg = data.wasAutoDetected ? ' (Auto-Detected: Scientific-Explanatory)' : '';
          toast({
            title: "Scientific-Explanatory Analysis Complete!",
            description: `Overall: ${data.score}/10 | Logical: ${data.logicalConsistency.score}/10 | Scientific: ${data.scientificAccuracy.score}/10${autoDetectMsg}`,
          });
        } else {
          setCoherenceIsMathematical(false);
          setCoherenceIsScientific(false);
          setCoherenceLogicalScore(null);
          setCoherenceScientificScore(null);
          // Clear validity data
          setMathValidityAnalysis("");
          setMathValidityScore(null);
          setMathValidityVerdict(null);
          setMathValiditySubscores(null);
          setMathValidityFlaws([]);
          setMathValidityCounterexamples([]);
          
          // Capture detected coherence type if auto-detected
          if (data.wasAutoDetected && data.detectedCoherenceType) {
            setDetectedCoherenceType(data.detectedCoherenceType);
          }
          
          const autoDetectMsg = data.wasAutoDetected && data.detectedCoherenceType 
            ? ` (Applied: ${data.detectedCoherenceType.replace(/-/g, ' ')})` 
            : '';
          toast({
            title: "Coherence Analysis Complete!",
            description: `Score: ${data.score}/10 - ${data.assessment}${autoDetectMsg}`,
          });
        }
      }
    } catch (error: any) {
      console.error('Coherence analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error.message || "An error occurred during coherence analysis.",
        variant: "destructive",
      });
    } finally {
      setCoherenceLoading(false);
    }
  };

  const handleCoherenceRewrite = async () => {
    const wordCount = coherenceInputText.trim().split(/\s+/).length;
    
    if (!coherenceInputText.trim()) {
      toast({
        title: "No Input Text",
        description: "Please enter text to rewrite for coherence",
        variant: "destructive"
      });
      return;
    }
    
    // If text is longer than 500 words, create chunks and show selector
    if (wordCount > 500) {
      const chunks = createCoherenceChunks(coherenceInputText);
      setCoherenceChunks(chunks);
      setSelectedCoherenceChunks(chunks.map(c => c.id)); // Select all by default
      setShowCoherenceChunkSelector(true);
      toast({
        title: "Text Too Long for Single Rewrite",
        description: `Your text has ${wordCount} words. It has been divided into ${chunks.length} sections. Select which sections to rewrite.`,
      });
      return;
    }

    setCoherenceLoading(true);
    setCoherenceMode("rewrite");
    setCoherenceRewrite("");
    setCoherenceChanges("");
    setCoherenceCorrectionsApplied([]);
    setCoherenceRewriteAccuracyScore(null);
    setDetectedCoherenceType(null);

    try {
      const response = await fetch('/api/coherence-meter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: coherenceInputText,
          coherenceType,
          mode: "rewrite",
          aggressiveness: coherenceAggressiveness
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Rewrite failed');
      }

      const data = await response.json();
      if (data.success) {
        setCoherenceRewrite(data.rewrite);
        setCoherenceChanges(data.changes);
        
        // Capture detected coherence type if auto-detected
        if (data.wasAutoDetected && data.detectedCoherenceType) {
          setDetectedCoherenceType(data.detectedCoherenceType);
        }
        
        // Handle scientific-explanatory specific data
        if (data.isScientificExplanatory) {
          setCoherenceIsScientific(true);
          setCoherenceCorrectionsApplied(data.correctionsApplied || []);
          setCoherenceRewriteAccuracyScore(data.scientificAccuracyScore || null);
        }
        
        const appliedType = data.wasAutoDetected && data.detectedCoherenceType 
          ? data.detectedCoherenceType.replace(/-/g, ' ')
          : coherenceType.replace(/-/g, ' ');
        
        toast({
          title: data.isScientificExplanatory ? "Scientific Accuracy Rewrite Complete!" : "Coherence Rewrite Complete!",
          description: data.isScientificExplanatory 
            ? `Text rewritten for scientific accuracy (Score: ${data.scientificAccuracyScore}/10)${data.wasAutoDetected ? ' (Auto-Detected)' : ''}`
            : `Text rewritten to maximize ${appliedType} coherence${data.wasAutoDetected ? ' (Auto-Detected)' : ''}`,
        });
      }
    } catch (error: any) {
      console.error('Coherence rewrite error:', error);
      toast({
        title: "Rewrite Failed",
        description: error.message || "An error occurred during coherence rewriting.",
        variant: "destructive",
      });
    } finally {
      setCoherenceLoading(false);
    }
  };

  // MATH COHERENCE - analyze structural coherence only
  const handleMathCoherence = async () => {
    if (!coherenceInputText.trim()) {
      toast({ title: "No Input Text", description: "Please enter a mathematical proof to analyze", variant: "destructive" });
      return;
    }
    setCoherenceLoading(true);
    setCoherenceMode("analyze");
    setCoherenceIsMathematical(true);
    setCoherenceAnalysis("");
    setCoherenceScore(null);
    setCoherenceAssessment(null);

    try {
      const response = await fetch('/api/coherence-meter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: coherenceInputText, mode: "math-coherence" }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Analysis failed');
      }
      const data = await response.json();
      if (data.success) {
        setCoherenceAnalysis(data.analysis);
        setCoherenceScore(data.score);
        setCoherenceAssessment(data.assessment);
        // Clear cogency data when doing coherence analysis
        setMathValidityAnalysis("");
        setMathValidityScore(null);
        setMathValidityVerdict(null);
        setMathValiditySubscores(null);
        setMathValidityFlaws([]);
        setMathValidityCounterexamples([]);
        toast({ title: "Math Coherence Analysis Complete!", description: `Score: ${data.score}/10 - ${data.assessment}` });
      }
    } catch (error: any) {
      console.error('Math coherence error:', error);
      toast({ title: "Analysis Failed", description: error.message || "An error occurred.", variant: "destructive" });
    } finally {
      setCoherenceLoading(false);
    }
  };

  // MATH COGENCY - analyze if theorem is true and proof valid
  const handleMathCogency = async () => {
    if (!coherenceInputText.trim()) {
      toast({ title: "No Input Text", description: "Please enter a mathematical proof to analyze", variant: "destructive" });
      return;
    }
    setCoherenceLoading(true);
    setCoherenceMode("analyze");
    setCoherenceIsMathematical(true);

    try {
      const response = await fetch('/api/coherence-meter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: coherenceInputText, mode: "math-cogency" }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Analysis failed');
      }
      const data = await response.json();
      if (data.success) {
        setMathValidityAnalysis(data.analysis);
        setMathValidityScore(data.score);
        setMathValidityVerdict(data.verdict);
        setMathValiditySubscores(data.subscores);
        setMathValidityFlaws(data.flaws || []);
        setMathValidityCounterexamples(data.counterexamples || []);
        toast({ 
          title: "Math Cogency Analysis Complete!", 
          description: `Score: ${data.score}/10 - ${data.verdict}` 
        });
      }
    } catch (error: any) {
      console.error('Math cogency error:', error);
      toast({ title: "Analysis Failed", description: error.message || "An error occurred.", variant: "destructive" });
    } finally {
      setCoherenceLoading(false);
    }
  };

  // MATH MAX COHERENCE - rewrite to maximize structural coherence
  const handleMathMaxCoherence = async () => {
    if (!coherenceInputText.trim()) {
      toast({ title: "No Input Text", description: "Please enter a mathematical proof to rewrite", variant: "destructive" });
      return;
    }
    setCoherenceLoading(true);
    setCoherenceMode("rewrite");
    setCoherenceRewrite("");
    setCoherenceChanges("");

    try {
      const response = await fetch('/api/coherence-meter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: coherenceInputText, 
          mode: "math-max-coherence",
          aggressiveness: coherenceAggressiveness 
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Rewrite failed');
      }
      const data = await response.json();
      if (data.success) {
        setCoherenceRewrite(data.rewrite);
        setCoherenceChanges(data.changes);
        setCoherenceRewriteAccuracyScore(data.coherenceScore);
        toast({ title: "Max Coherence Rewrite Complete!", description: `Coherence Score: ${data.coherenceScore}/10` });
      }
    } catch (error: any) {
      console.error('Math max coherence error:', error);
      toast({ title: "Rewrite Failed", description: error.message || "An error occurred.", variant: "destructive" });
    } finally {
      setCoherenceLoading(false);
    }
  };

  // MATH MAXIMIZE TRUTH - correct proofs or find adjacent truths
  const handleMathMaximizeTruth = async () => {
    if (!coherenceInputText.trim()) {
      toast({ title: "No Input Text", description: "Please enter a mathematical proof to correct", variant: "destructive" });
      return;
    }
    setCoherenceLoading(true);
    setCoherenceMode("rewrite");
    setMathProofCorrectedProof("");
    setMathProofTheoremStatus(null);
    setMathProofOriginalTheorem("");
    setMathProofCorrectedTheorem(null);
    setMathProofStrategy("");
    setMathProofKeyCorrections([]);
    setMathProofValidityScore(null);
    setMathProofIsCorrected(false);

    try {
      const response = await fetch('/api/coherence-meter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: coherenceInputText, mode: "math-maximize-truth" }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Math proof correction failed');
      }
      const data = await response.json();
      if (data.success) {
        setMathProofCorrectedProof(data.correctedProof);
        setMathProofTheoremStatus(data.theoremStatus);
        setMathProofOriginalTheorem(data.originalTheorem);
        setMathProofCorrectedTheorem(data.correctedTheorem);
        setMathProofStrategy(data.proofStrategy);
        setMathProofKeyCorrections(data.keyCorrections || []);
        setMathProofValidityScore(data.validityScore);
        setMathProofIsCorrected(true);
        
        const statusMessage = data.theoremStatus === "TRUE" 
          ? "Theorem is TRUE - Proof corrected"
          : data.theoremStatus === "FALSE"
          ? "Theorem is FALSE - Similar true theorem proved instead"
          : "Theorem is PARTIALLY TRUE - Corrected with proper conditions";
        
        toast({ title: "Math Proof Correction Complete!", description: `${statusMessage} (Validity: ${data.validityScore}/10)` });
      }
    } catch (error: any) {
      console.error('Math maximize truth error:', error);
      toast({ title: "Proof Correction Failed", description: error.message || "An error occurred.", variant: "destructive" });
    } finally {
      setCoherenceLoading(false);
    }
  };

  const handleProcessSelectedChunks = async (mode: "analyze" | "rewrite") => {
    if (selectedCoherenceChunks.length === 0) {
      toast({
        title: "No Sections Selected",
        description: "Please select at least one section to process",
        variant: "destructive"
      });
      return;
    }

    const selectedChunkObjects = coherenceChunks.filter(c => selectedCoherenceChunks.includes(c.id));
    
    setCoherenceLoading(true);
    setCoherenceMode(mode);
    setShowCoherenceChunkSelector(false);
    
    if (mode === "analyze") {
      setCoherenceAnalysis("");
      setCoherenceScore(null);
      setCoherenceAssessment(null);
    } else {
      setCoherenceRewrite("");
      setCoherenceChanges("");
    }

    // Check if outline-guided mode is selected
    if (coherenceProcessingMode === "outline-guided") {
      // Use outline-guided endpoint for full text
      const fullText = selectedChunkObjects.map(c => c.text).join('\n\n');
      
      setCoherenceStageProgress("STAGE 1: Generating document outline...\nThis may take a moment...");
      
      try {
        const response = await fetch('/api/coherence-outline-guided', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: fullText,
            coherenceType,
            mode,
            aggressiveness: coherenceAggressiveness
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Outline-guided ${mode} failed`);
        }

        const data = await response.json();
        if (data.success) {
          if (mode === "analyze") {
            setCoherenceAnalysis(data.analysis);
          } else {
            setCoherenceRewrite(data.rewrite);
            setCoherenceChanges(data.changes);
          }
          
          toast({
            title: "Outline-Guided Processing Complete!",
            description: `Successfully processed using two-stage approach`,
          });
        }
      } catch (error: any) {
        console.error(`Outline-guided ${mode} error:`, error);
        toast({
          title: `${mode.charAt(0).toUpperCase() + mode.slice(1)} Failed`,
          description: error.message || `An error occurred during outline-guided ${mode}.`,
          variant: "destructive",
        });
      } finally {
        setCoherenceLoading(false);
        setCoherenceStageProgress("");
      }
    } else {
      // Use simple chunking mode - process each chunk independently
      let combinedAnalysis = "";
      let combinedRewrite = "";
      let combinedChanges = "";

      try {
        for (let i = 0; i < selectedChunkObjects.length; i++) {
          const chunk = selectedChunkObjects[i];
          
          toast({
            title: `Processing Section ${i + 1}/${selectedChunkObjects.length}`,
            description: `Analyzing: "${chunk.preview}"`,
          });

          const response = await fetch('/api/coherence-meter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: chunk.text,
              coherenceType,
              mode,
              aggressiveness: coherenceAggressiveness
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `${mode} failed for section ${i + 1}`);
          }

          const data = await response.json();
          if (data.success) {
            if (mode === "analyze") {
              combinedAnalysis += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nSECTION ${i + 1} of ${selectedChunkObjects.length}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${data.analysis}`;
            } else {
              combinedRewrite += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nSECTION ${i + 1} of ${selectedChunkObjects.length}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${data.rewrite}`;
              combinedChanges += `\n\n━━━━ SECTION ${i + 1} ━━━━\n${data.changes}`;
            }
          }
        }

        if (mode === "analyze") {
          setCoherenceAnalysis(combinedAnalysis.trim());
          toast({
            title: "All Sections Analyzed!",
            description: `Processed ${selectedChunkObjects.length} sections successfully`,
          });
        } else {
          setCoherenceRewrite(combinedRewrite.trim());
          setCoherenceChanges(combinedChanges.trim());
          toast({
            title: "All Sections Rewritten!",
            description: `Processed ${selectedChunkObjects.length} sections successfully`,
          });
        }
      } catch (error: any) {
        console.error(`Coherence ${mode} error:`, error);
        toast({
          title: `${mode.charAt(0).toUpperCase() + mode.slice(1)} Failed`,
          description: error.message || `An error occurred during coherence ${mode}.`,
          variant: "destructive",
        });
      } finally {
        setCoherenceLoading(false);
      }
    }
  };

  const handleCoherenceClear = () => {
    setCoherenceInputText("");
    setCoherenceAnalysis("");
    setCoherenceRewrite("");
    setCoherenceChanges("");
    setCoherenceMode(null);
    setCoherenceScore(null);
    setCoherenceAssessment(null);
    setCoherenceChunks([]);
    setSelectedCoherenceChunks([]);
    setShowCoherenceChunkSelector(false);
    setCoherenceIsScientific(false);
    setCoherenceLogicalScore(null);
    setCoherenceScientificScore(null);
    setCoherenceCorrectionsApplied([]);
    setCoherenceRewriteAccuracyScore(null);
    setMathProofCorrectedProof("");
    setMathProofTheoremStatus(null);
    setMathProofOriginalTheorem("");
    setMathProofCorrectedTheorem(null);
    setMathProofStrategy("");
    setMathProofKeyCorrections([]);
    setMathProofValidityScore(null);
    setMathProofIsCorrected(false);
  };


  // FIXED streaming function
  const startStreaming = async (text: string, provider: string) => {
    console.log('startStreaming called with:', { text: text.slice(0, 50), provider });
    
    try {
      console.log('Making fetch request to /api/stream-analysis...');
      
      const response = await fetch('/api/stream-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, provider }),
      });

      console.log('Response received:', response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      console.log('Starting to read stream...');
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('Stream ended');
          setIsStreaming(false);
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        console.log('Received chunk:', chunk);
        
        if (chunk) {
          setStreamingContent(prev => {
            const newContent = prev + chunk;
            console.log('Updated content length:', newContent.length);
            return newContent;
          });
        }
      }
      
    } catch (error) {
      console.error('Streaming error:', error);
      setStreamingContent('ERROR: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setIsStreaming(false);
    }
  };
  const [apiStatus, setApiStatus] = useState<{
    openai: boolean;
    anthropic: boolean;
    perplexity: boolean;
    deepseek: boolean;
    grok: boolean;
  }>({
    openai: false,
    anthropic: false,
    perplexity: false,
    deepseek: false,
    grok: false
  });
  
  // Check API status when component mounts
  useEffect(() => {
    async function checkApiStatus() {
      try {
        const response = await fetch("/api/check-api");
        const data = await response.json();
        
        if (data.api_keys) {
          setApiStatus({
            openai: data.api_keys.openai === "configured",
            anthropic: data.api_keys.anthropic === "configured",
            perplexity: data.api_keys.perplexity === "configured",
            deepseek: data.api_keys.deepseek === "configured",
            grok: data.api_keys.grok === "configured"
          });
          
          console.log("API Status:", data.api_keys);
        }
      } catch (error) {
        console.error("Error checking API status:", error);
      }
    }
    
    checkApiStatus();
  }, []);

  // Handler for checking if a document is AI-generated
  const handleCheckAI = async (documentId: "A" | "B") => {
    const document = documentId === "A" ? documentA : documentB;
    
    if (!document.content.trim()) {
      alert("Please enter some text before checking for AI.");
      return;
    }

    setCurrentAICheckDocument(documentId);
    setAIDetectionModalOpen(true);
    setIsAICheckLoading(true);
    setAIDetectionResult(undefined);

    try {
      const result = await checkForAI(document);
      setAIDetectionResult(result);
      
      // Update the document analysis with AI detection results if it exists
      if (documentId === "A" && analysisA) {
        setAnalysisA({
          ...analysisA,
          aiDetection: result
        });
      } else if (documentId === "B" && analysisB) {
        setAnalysisB({
          ...analysisB,
          aiDetection: result
        });
      }
    } catch (error) {
      console.error("Error checking for AI:", error);
    } finally {
      setIsAICheckLoading(false);
    }
  };

  // Handler for case assessment - REAL-TIME STREAMING
  const handleCaseAssessment = async () => {
    if (!documentA.content.trim()) {
      alert("Please enter some text to assess how well it makes its case.");
      return;
    }

    // Check if the selected provider is available (map ZHI names to original API names)
    const apiKeyMapping: Record<string, string> = {
      'zhi1': 'openai',
      'zhi2': 'anthropic', 
      'zhi3': 'deepseek',
      'zhi4': 'perplexity',
      'zhi5': 'grok'
    };
    const actualApiKey = apiKeyMapping[selectedProvider] || selectedProvider;
    if (selectedProvider !== "all" && !apiStatus[actualApiKey as keyof typeof apiStatus]) {
      alert(`The ${selectedProvider} API key is not configured or is invalid. Please select a different provider or ensure the API key is properly set.`);
      return;
    }

    // Reset any previous streaming state and clear previous analysis results
    setIsStreaming(false);
    setStreamingContent('');
    setAnalysisA(null); // Clear previous intelligence analysis
    setShowResults(true); // Ensure results section is visible
    
    // Start REAL-TIME streaming for case assessment
    setIsStreaming(true);
    setIsCaseAssessmentLoading(true);
    setCaseAssessmentResult(null);

    try {
      const provider = selectedProvider === "all" ? "zhi1" : selectedProvider;
      
      const response = await fetch('/api/case-assessment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: documentA.content,
          provider: provider,
          context: documentA.context
        }),
      });

      if (!response.ok) {
        throw new Error(`Case assessment failed: ${response.statusText}`);
      }

      // REAL-TIME STREAMING: Read response token by token
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullResponse += chunk;
        setStreamingContent(fullResponse); // Show each token as it arrives
      }

      // Parse the case assessment response to extract scores
      const parseScores = (text: string) => {
        const extractScore = (pattern: string): number => {
          // Try multiple patterns to extract scores
          const patterns = [
            new RegExp(`${pattern}[:\\s]*(\\d+)(?:/100)?`, 'i'),
            new RegExp(`${pattern}.*?(\\d+)/100`, 'i'),
            new RegExp(`${pattern}.*?Score[:\\s]*(\\d+)`, 'i'),
            new RegExp(`${pattern}.*?(\\d+)`, 'i')
          ];
          
          for (const regex of patterns) {
            const match = text.match(regex);
            if (match && match[1]) {
              const score = parseInt(match[1]);
              if (score >= 0 && score <= 100) {
                return score;
              }
            }
          }
          
          // Fallback: compute score based on text analysis
          return computeFallbackScore(pattern, text);
        };

        // Fallback scoring based on text analysis
        const computeFallbackScore = (category: string, fullText: string): number => {
          const text = fullText.toLowerCase();
          let score = 50; // Base score
          
          // Look for positive indicators
          const positiveWords = ['strong', 'effective', 'clear', 'compelling', 'convincing', 'well-structured', 'logical', 'coherent'];
          const negativeWords = ['weak', 'unclear', 'confusing', 'illogical', 'lacks', 'missing', 'problematic'];
          
          positiveWords.forEach(word => {
            if (text.includes(word)) score += 8;
          });
          
          negativeWords.forEach(word => {
            if (text.includes(word)) score -= 8;
          });
          
          // Category-specific adjustments
          if (category.includes('PROOF') && text.includes('evidence')) score += 10;
          if (category.includes('CREDIBILITY') && text.includes('reliable')) score += 10;
          if (category.includes('WRITING') && text.includes('readable')) score += 10;
          
          return Math.max(0, Math.min(100, score));
        };

        return {
          proofEffectiveness: extractScore('PROOF EFFECTIVENESS'),
          claimCredibility: extractScore('CLAIM CREDIBILITY'),
          nonTriviality: extractScore('NON-TRIVIALITY'),
          proofQuality: extractScore('PROOF QUALITY'),
          functionalWriting: extractScore('FUNCTIONAL WRITING'),
          overallCaseScore: extractScore('OVERALL CASE SCORE'),
          detailedAssessment: fullResponse
        };
      };

      console.log('FULL AI RESPONSE FOR DEBUGGING:', fullResponse);
      const caseAssessmentData = parseScores(fullResponse);
      console.log('PARSED SCORES:', caseAssessmentData);
      setCaseAssessmentResult(caseAssessmentData);
      
      // CREATE CASE ASSESSMENT ONLY RESULT - NOT INTELLIGENCE ASSESSMENT  
      setAnalysisA({
        id: Date.now(),
        formattedReport: "", // Empty so it doesn't show in intelligence section
        overallScore: undefined, // No intelligence score
        provider: provider,
        analysis: "",
        summary: "",
        caseAssessment: caseAssessmentData,
        analysisType: "case_assessment", // Flag to identify this as case assessment
      });
      
      // NO POPUP - Results are now in main report only
      
    } catch (error) {
      console.error("Error performing case assessment:", error);
      alert("Failed to assess document case. Please try again.");
    } finally {
      setIsCaseAssessmentLoading(false);
      setIsStreaming(false);
    }
  };

  // Handler for document comparison
  const handleDocumentComparison = async () => {
    if (!documentA.content.trim() || !documentB.content.trim()) {
      alert("Please enter text in both documents to compare them.");
      return;
    }

    // Check if the selected provider is available (map ZHI names to original API names)
    const apiKeyMapping: Record<string, string> = {
      'zhi1': 'openai',
      'zhi2': 'anthropic', 
      'zhi3': 'deepseek',
      'zhi4': 'perplexity',
      'zhi5': 'grok'
    };
    const actualApiKey = apiKeyMapping[selectedProvider] || selectedProvider;
    if (selectedProvider !== "all" && !apiStatus[actualApiKey as keyof typeof apiStatus]) {
      alert(`The ${selectedProvider} API key is not configured or is invalid. Please select a different provider or ensure the API key is properly set.`);
      return;
    }

    setIsComparisonLoading(true);
    setComparisonResult(null);

    try {
      const provider = selectedProvider === "all" ? "zhi1" : selectedProvider;
      
      const response = await fetch('/api/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentA: documentA.content,
          documentB: documentB.content,
          provider: provider
        }),
      });

      if (!response.ok) {
        throw new Error(`Document comparison failed: ${response.statusText}`);
      }

      const data = await response.json();
      setComparisonResult(data);
      setComparisonModalOpen(true);
      
    } catch (error) {
      console.error("Error comparing documents:", error);
      alert(`Document comparison failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsComparisonLoading(false);
    }
  };

  // Handler for fiction assessment - REAL-TIME STREAMING
  const handleFictionAssessment = async (documentId: "A" | "B") => {
    const document = documentId === "A" ? documentA : documentB;
    if (!document.content.trim()) {
      alert(`Please enter some text in Document ${documentId}.`);
      return;
    }

    // Check if the selected provider is available (map ZHI names to original API names)
    const apiKeyMapping: Record<string, string> = {
      'zhi1': 'openai',
      'zhi2': 'anthropic', 
      'zhi3': 'deepseek',
      'zhi4': 'perplexity',
      'zhi5': 'grok'
    };
    const actualApiKey = apiKeyMapping[selectedProvider] || selectedProvider;
    if (selectedProvider !== "all" && !apiStatus[actualApiKey as keyof typeof apiStatus]) {
      alert(`The ${selectedProvider} API key is not configured or is invalid. Please select a different provider or ensure the API key is properly set.`);
      return;
    }

    // Reset any previous streaming state
    setIsStreaming(false);
    setStreamingContent('');
    
    // Start REAL-TIME streaming for fiction assessment
    setIsStreaming(true);
    setIsFictionAssessmentLoading(true);
    setFictionAssessmentResult(null);

    try {
      const provider = selectedProvider === "all" ? "zhi1" : selectedProvider;
      
      const response = await fetch('/api/fiction-assessment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: document.content,
          provider: provider
        }),
      });

      if (!response.ok) {
        throw new Error(`Fiction assessment failed: ${response.statusText}`);
      }

      // REAL-TIME STREAMING: Read response token by token
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullResponse += chunk;
        setStreamingContent(fullResponse); // Show each token as it arrives
      }

      // Parse the fiction assessment response to extract scores
      const parseFictionScores = (text: string) => {
        const extractScore = (pattern: string): number => {
          const regex = new RegExp(`${pattern}[:\\s]*(\\d+)(?:/100)?`, 'i');
          const match = text.match(regex);
          return match ? parseInt(match[1]) : 0;
        };

        return {
          worldCoherence: extractScore('WORLD COHERENCE'),
          emotionalPlausibility: extractScore('EMOTIONAL PLAUSIBILITY'),
          thematicDepth: extractScore('THEMATIC DEPTH'),
          narrativeStructure: extractScore('NARRATIVE STRUCTURE'),
          proseControl: extractScore('PROSE CONTROL'),
          overallFictionScore: extractScore('OVERALL FICTION SCORE'),
          detailedAssessment: fullResponse
        };
      };

      const fictionAssessmentData = parseFictionScores(fullResponse);
      setFictionAssessmentResult(fictionAssessmentData);
      setCurrentFictionDocument(documentId);
      
      // CREATE FICTION ASSESSMENT ONLY RESULT - NOT INTELLIGENCE ASSESSMENT  
      setAnalysisA({
        id: Date.now(),
        formattedReport: "", // Empty so it doesn't show in intelligence section
        overallScore: undefined, // No intelligence score
        provider: provider,
        analysis: "",
        summary: "",
        fictionAssessment: fictionAssessmentData,
        analysisType: "fiction_assessment", // Flag to identify this as fiction assessment
      });
      
      // NO POPUP - Results are now in main report only
      
    } catch (error) {
      console.error("Error performing fiction assessment:", error);
      alert(`Fiction assessment with ${selectedProvider} failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsFictionAssessmentLoading(false);
      setIsStreaming(false);
      setStreamingContent(''); // Clean up streaming content
    }
  };

  // Handler for fiction comparison
  const handleFictionComparison = () => {
    if (!documentA.content.trim() || !documentB.content.trim()) {
      alert("Please enter text in both documents to compare them.");
      return;
    }

    setFictionComparisonModalOpen(true);
  };

  // Handler for maximize intelligence
  const handleMaximizeIntelligence = async () => {
    if (!documentA.content.trim()) {
      alert("Please provide document content first.");
      return;
    }

    setIsMaximizeIntelligenceLoading(true);
    try {
      const instructionsToUse = customInstructions.trim() || defaultInstructions;
      
      const response = await fetch('/api/intelligent-rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalText: documentA.content,
          customInstructions: instructionsToUse,
          provider: selectedProvider === "all" ? "zhi1" : selectedProvider,
          useExternalKnowledge: useExternalKnowledge
        }),
      });

      if (!response.ok) {
        throw new Error(`Rewrite failed: ${response.statusText}`);
      }

      const data = await response.json();
      setRewriteResult(data.result?.rewrittenText || data.rewrittenText || "No rewrite result returned");
      
      // Store the complete result data and show results modal
      setRewriteResultData(data.result);
      setRewriteResultsModalOpen(true);
      
    } catch (error) {
      console.error('Maximize intelligence error:', error);
      alert(error instanceof Error ? error.message : "Failed to maximize intelligence. Please try again.");
    } finally {
      setIsMaximizeIntelligenceLoading(false);
      setMaximizeIntelligenceModalOpen(false);
    }
  };


  // Handler for downloading rewrite results

  const handleDownloadRewrite = () => {
    if (!rewriteResultData) return;
    
    const content = `INTELLIGENT REWRITE RESULTS
${"=".repeat(50)}

ORIGINAL TEXT:
${rewriteResultData.originalText}

REWRITTEN TEXT:
${rewriteResultData.rewrittenText}

SCORE IMPROVEMENT:
Original Score: ${rewriteResultData.originalScore}/100
Rewritten Score: ${rewriteResultData.rewrittenScore}/100
Improvement: ${rewriteResultData.rewrittenScore - rewriteResultData.originalScore} points

REWRITE REPORT:
${rewriteResultData.rewriteReport || "No detailed report available"}

Provider: ${rewriteResultData.provider}
Instructions: ${rewriteResultData.instructions}

Generated on: ${new Date().toLocaleString()}`;
    
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `intelligent-rewrite-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUseRewrittenText = () => {
    if (rewriteResultData?.rewrittenText) {
      setDocumentA(prev => ({ ...prev, content: rewriteResultData.rewrittenText }));
      setRewriteResultsModalOpen(false);
    }
  };

  const handleKeepOriginalText = () => {
    setRewriteResultsModalOpen(false);
  };

  // Handler for sending rewritten text to intelligence analysis
  const handleSendToIntelligenceAnalysis = () => {
    if (rewriteResultData?.rewrittenText) {
      setDocumentA(prev => ({ ...prev, content: rewriteResultData.rewrittenText }));
      setRewriteResultsModalOpen(false);
      // Optional: Auto-trigger intelligence analysis
      // setTimeout(() => handleCognitiveQuick(), 100);
    }
  };

  // Handler for analyzing documents - FIXED MAIN ANALYSIS
  // Helper function to get content for analysis based on chunk selection
  const getContentForAnalysis = (document: DocumentInputType): string => {
    // If no chunks or no chunks selected, use full content
    if (!document.chunks || !document.selectedChunkIds || document.selectedChunkIds.length === 0) {
      return document.content;
    }
    
    // Combine selected chunks
    const selectedChunks = document.chunks.filter(chunk => 
      document.selectedChunkIds!.includes(chunk.id)
    );
    
    return selectedChunks.map(chunk => chunk.content).join('\n\n');
  };

  const handleAnalyze = async () => {
    const contentA = getContentForAnalysis(documentA);
    const contentB = getContentForAnalysis(documentB);
    
    if (!contentA.trim()) {
      const message = documentA.chunks && documentA.chunks.length > 1 
        ? "Please select at least one chunk to analyze from Document A."
        : "Please enter some text in Document A.";
      alert(message);
      return;
    }

    if (mode === "compare" && !contentB.trim()) {
      const message = documentB.chunks && documentB.chunks.length > 1 
        ? "Please select at least one chunk to analyze from Document B."
        : "Please enter some text in Document B for comparison.";
      alert(message);
      return;
    }
    
    // Check if the selected provider is available (map ZHI names to original API names)
    const apiKeyMapping: Record<string, string> = {
      'zhi1': 'openai',
      'zhi2': 'anthropic', 
      'zhi3': 'deepseek',
      'zhi4': 'perplexity',
      'zhi5': 'grok'
    };
    const actualApiKey = apiKeyMapping[selectedProvider] || selectedProvider;
    if (selectedProvider !== "all" && !apiStatus[actualApiKey as keyof typeof apiStatus]) {
      alert(`The ${selectedProvider} API key is not configured or is invalid. Please select a different provider or ensure the API key is properly set.`);
      return;
    }

    // FIXED: Use proper analysis for single document mode
    if (mode === "single") {
      setShowResults(true);
      setIsAnalysisLoading(true);
      
      try {
        const provider = selectedProvider === "all" ? "zhi1" : selectedProvider;
        if (analysisType === "quick") {
          // Quick analysis - regular API call
          const response = await fetch('/api/cognitive-quick', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: contentA, provider: provider }),
          });

          if (!response.ok) {
            throw new Error(`Analysis failed: ${response.statusText}`);
          }

          const data = await response.json();
          setAnalysisA(data.analysis || data.result);
        } else {
          // Reset any previous streaming state
          setIsStreaming(false);
          setStreamingContent('');
          
          // Comprehensive analysis - streaming
          setIsStreaming(true);
          
          const response = await fetch('/api/stream-comprehensive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: contentA, provider: provider }),
          });

          if (!response.ok) {
            throw new Error(`Streaming failed: ${response.statusText}`);
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let fullContent = '';

          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              fullContent += chunk;
              setStreamingContent(fullContent);
            }
            
            // Extract actual score from streamed content
            const scoreMatch = fullContent.match(/FINAL SCORE:\s*(\d+)\/100/i) || 
                              fullContent.match(/Final Score:\s*(\d+)\/100/i) ||
                              fullContent.match(/Score:\s*(\d+)\/100/i);
            const actualScore = scoreMatch ? parseInt(scoreMatch[1]) : 0;
            
            // Convert streaming content to analysis format
            setAnalysisA({
              id: Date.now(),
              formattedReport: fullContent,
              overallScore: actualScore, // Use actual AI-generated score
              provider: provider
            });
          }
          
          setIsStreaming(false);
          setStreamingContent(''); // Clean up streaming content
        }
        trackEvent("analysis_completed", {
          mode,
          analysis_type: analysisType,
          provider: selectedProvider,
          word_count: contentA.trim().split(/\s+/).length,
        });
        
      } catch (error) {
        console.error("Error analyzing document:", error);
        trackEvent("analysis_failed", {
          mode,
          analysis_type: analysisType,
          provider: selectedProvider,
        });
        alert(`Analysis with ${selectedProvider} failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      } finally {
        setIsAnalysisLoading(false);
      }
      return;
    }
    
    // Regular analysis logic for comparison mode
    setShowResults(true);
    setIsAnalysisLoading(true);
    
    try {
      // Two-document mode: use existing comparison logic for now
      if (analysisType === "quick") {
        const provider = selectedProvider === "all" ? "zhi1" : selectedProvider;
        
        const response = await fetch('/api/quick-compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentA: contentA,
            documentB: contentB,
            provider: provider
          }),
        });

        if (!response.ok) {
          throw new Error(`Quick comparison failed: ${response.statusText}`);
        }

        const data = await response.json();
        setAnalysisA(data.analysisA);
        setAnalysisB(data.analysisB);
        setComparison(data.comparison);
      } else {
        // Use the comprehensive comparison (existing logic)
        console.log(`Comparing with ${selectedProvider}...`);
        // Create temporary documents with the selected content for comparison
        const tempDocA = { ...documentA, content: contentA };
        const tempDocB = { ...documentB, content: contentB };
        const results = await compareDocuments(tempDocA, tempDocB, selectedProvider);
        setAnalysisA(results.analysisA);
        setAnalysisB(results.analysisB);
        setComparison(results.comparison);
      }
      trackEvent("analysis_completed", {
        mode,
        analysis_type: analysisType,
        provider: selectedProvider,
        word_count_a: contentA.trim().split(/\s+/).length,
        word_count_b: contentB.trim().split(/\s+/).length,
      });
    } catch (error) {
      console.error("Error comparing documents:", error);
      trackEvent("analysis_failed", {
        mode,
        analysis_type: analysisType,
        provider: selectedProvider,
      });
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      alert(`Comparison with ${selectedProvider} failed: ${errorMessage}\n\nPlease verify that the ${selectedProvider} API key is correctly configured.`);
    } finally {
      setIsAnalysisLoading(false);
    }
  };
  

  
  // Handler for resetting the entire analysis
  const handleReset = () => {
    // Clear document inputs
    setDocumentA({ content: "" });
    setDocumentB({ content: "" });
    
    // Clear analysis results
    setAnalysisA(null);
    setAnalysisB(null);
    setComparison(null);
    
    // Clear streaming content
    setIsStreaming(false);
    setStreamingContent('');
    
    // Reset UI states
    setShowResults(false);
    setIsAnalysisLoading(false);
    setIsAICheckLoading(false);
    setAIDetectionResult(undefined);
    
    // Reset to single mode
    setMode("single");
    
    // Scroll to top
    window.scrollTo(0, 0);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <section className="mb-8 rounded-lg border-2 border-indigo-300 bg-gradient-to-r from-indigo-50 to-blue-50 p-6 shadow-md dark:border-indigo-700 dark:from-indigo-950/30 dark:to-blue-950/30">
        <div className="mb-4">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-indigo-950 dark:text-indigo-100">
            <FileEdit className="h-6 w-6 text-indigo-600" />
            Tell the App What You Want Written
          </h1>
          <p className="mt-1 text-sm text-indigo-800 dark:text-indigo-200">
            Give complete instructions for the document, book, article, screenplay, or other work you want. Include the subject, structure, length, style, and any constraints.
          </p>
        </div>

        <Textarea
          value={writingInstructions}
          onChange={(event) => setWritingInstructions(event.target.value)}
          placeholder={'Example: Construct a comprehensive, 10–12 chapter theoretical treatise titled “The Mechanics of Normative Entailment.” Define three foundational axioms in Chapter 1, derive every later argument from them, address the strongest objections in Chapter 9, and maintain exact terminological consistency throughout.'}
          className="min-h-[220px] bg-white text-base leading-relaxed dark:bg-gray-950"
          data-testid="textarea-writing-instructions"
        />

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <ProviderSelector
            selectedProvider={selectedProvider}
            onProviderChange={setSelectedProvider}
            label="Writing Model"
            apiStatus={apiStatus}
            className="w-full sm:max-w-xs"
          />
          <Button
            onClick={handleWriteFromInstructions}
            disabled={isWriting || !writingInstructions.trim()}
            className="min-w-44 bg-indigo-700 hover:bg-indigo-800"
            data-testid="button-write-from-instructions"
          >
            {isWriting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Writing...
              </>
            ) : (
              <>
                <FileEdit className="mr-2 h-4 w-4" />
                Write This
              </>
            )}
          </Button>
        </div>

        {(isWriting || generatedWriting) && (
          <div className="mt-6 rounded-lg border border-indigo-200 bg-white p-5 dark:border-indigo-800 dark:bg-gray-950">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Your Generated Work</h2>
                {writingProgress && (
                  <p className="mt-1 text-xs text-indigo-700 dark:text-indigo-300" data-testid="writing-validation-status">
                    {writingProgress}
                  </p>
                )}
              </div>
              {generatedWriting && (
                <div className="flex flex-wrap gap-2">
                  <CopyButton text={normalizeMathNotation(generatedWriting)} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadText(normalizeMathNotation(generatedWriting), "generated-work.txt")}
                    data-testid="button-download-generated-writing"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    TXT
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadGeneratedPdf} data-testid="button-download-generated-pdf">
                    <Download className="mr-2 h-4 w-4" />
                    PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadGeneratedWord} data-testid="button-download-generated-word">
                    <Download className="mr-2 h-4 w-4" />
                    Word
                  </Button>
                </div>
              )}
            </div>
            <div
              className="max-h-[700px] min-h-[180px] overflow-y-auto whitespace-pre-wrap rounded-md bg-gray-50 p-4 text-sm leading-7 text-gray-900 dark:bg-gray-900 dark:text-gray-100"
              data-testid="generated-writing-output"
            >
              {isWriting ? (
                <div className="flex items-center justify-center gap-2 py-16 text-indigo-700 dark:text-indigo-300">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {writingProgress || "Following your instructions and writing the requested work..."}
                </div>
              ) : (
                <MathRenderer content={generatedWriting} />
              )}
            </div>
          </div>
        )}
      </section>

      {/* External Knowledge Toggle - KEPT VISIBLE PER USER REQUEST */}
      <div className="flex justify-end mb-4">
        <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border-2 border-blue-300 dark:border-blue-700 shadow-md min-w-[320px]">
          <div className="flex-1">
            <div className="text-sm font-bold text-blue-900 dark:text-blue-100">
              USE ZHI DATABASE
            </div>
            <div className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
              AnalyticPhilosophy.net
            </div>
          </div>
          <Switch
            id="global-external-knowledge"
            checked={useExternalKnowledge}
            onCheckedChange={setUseExternalKnowledge}
            className="data-[state=checked]:bg-blue-600"
            data-testid="toggle-external-knowledge-global"
          />
        </div>
      </div>

      {/* INTELLIGENCE ANALYSIS TOOL - HIDDEN BY USER REQUEST */}
      <div className="hidden">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Intelligence Analysis Tool</h1>
            <p className="text-gray-600">Analyze, compare, and enhance writing samples with AI-powered intelligence evaluation</p>
          </div>
        </div>
      </header>

      {/* Analysis Mode Selector */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Analysis Settings</h2>
        <div className="flex flex-wrap gap-8 items-center">
          <ModeToggle mode={mode} setMode={setMode} />
          
          {/* Fiction Assessment Button */}
          <div className="border p-4 rounded-lg bg-white shadow-sm">
            <h3 className="text-lg font-medium text-gray-800 mb-3">Fiction Analysis</h3>
            <Button
              onClick={() => setFictionPopupOpen(true)}
              variant="outline"
              className="flex items-center gap-2 bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-700"
              data-testid="button-fiction-assessment"
            >
              <BookOpen className="w-4 h-4" />
              Assess Fiction
            </Button>
            <p className="text-xs text-gray-500 mt-2">
              Analyze literary fiction with specialized assessment criteria
            </p>
          </div>
          
          {/* Analysis Mode Toggle */}
          <div className="border p-4 rounded-lg bg-white shadow-sm">
            <h3 className="text-lg font-medium text-gray-800 mb-3">Analysis Mode</h3>
            <div className="flex gap-3">
              <Button
                onClick={() => setAnalysisType("quick")}
                variant={analysisType === "quick" ? "default" : "outline"}
                className="flex items-center gap-2"
              >
                <Zap className="h-4 w-4" />
                Quick Analysis
              </Button>
              <Button
                onClick={() => setAnalysisType("comprehensive")}
                variant={analysisType === "comprehensive" ? "default" : "outline"}
                className="flex items-center gap-2"
              >
                <Clock className="h-4 w-4" />
                Comprehensive
                <Badge variant="secondary" className="ml-1 text-xs">
                  ~3 min
                </Badge>
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {analysisType === "quick" 
                ? "Fast assessment focusing on core intelligence indicators"
                : "In-depth 4-phase evaluation protocol (takes up to 3 minutes)"
              }
            </p>
          </div>
          
          <div className="border p-4 rounded-lg bg-white shadow-sm mt-2 md:mt-0">
            <h3 className="text-lg font-medium text-gray-800 mb-3">Choose Your AI Provider</h3>
            <ProviderSelector 
              selectedProvider={selectedProvider}
              onProviderChange={setSelectedProvider}
              label="AI Provider"
              apiStatus={apiStatus}
              className="mb-3"
            />
            
            {/* API Status Indicators */}
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Provider Status:</h4>
              <div className="flex flex-wrap gap-2">
                <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center ${apiStatus.openai ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  <span className={`h-2 w-2 rounded-full mr-1.5 ${apiStatus.openai ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  ZHI 1: {apiStatus.openai ? 'Active' : 'Inactive'}
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center ${apiStatus.anthropic ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  <span className={`h-2 w-2 rounded-full mr-1.5 ${apiStatus.anthropic ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  ZHI 2: {apiStatus.anthropic ? 'Active' : 'Inactive'}
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center ${apiStatus.perplexity ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  <span className={`h-2 w-2 rounded-full mr-1.5 ${apiStatus.perplexity ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  ZHI 3: {apiStatus.perplexity ? 'Active' : 'Inactive'}
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">All API providers are active and ready to use. Each offers different analysis capabilities.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Document Input Section */}
      <div className="mb-8">
        {/* Document A */}
        <DocumentInput
          id="A"
          document={documentA}
          setDocument={setDocumentA}
          onCheckAI={() => handleCheckAI("A")}
        />

        {/* Document B (shown only in compare mode) */}
        {mode === "compare" && (
          <DocumentInput
            id="B"
            document={documentB}
            setDocument={setDocumentB}
            onCheckAI={() => handleCheckAI("B")}
          />
        )}

        {/* Analysis Options */}
        {mode === "single" ? (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3 text-center">Choose Analysis Type</h3>
            <p className="text-sm text-gray-600 mb-4 text-center">Run any or all analyses on your document - no need to re-upload text</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Intelligence Analysis */}
              <div className="text-center">
                <Button
                  onClick={handleAnalyze}
                  className="w-full px-4 py-6 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 flex flex-col items-center min-h-[100px]"
                  disabled={isAnalysisLoading || !documentA.content.trim()}
                >
                  <Brain className="h-6 w-6 mb-2" />
                  <span className="text-sm">
                    {isAnalysisLoading ? "Analyzing..." : "Intelligence Analysis"}
                  </span>
                </Button>
                <p className="text-xs text-gray-500 mt-2">Assess cognitive abilities and intelligence</p>
              </div>

              {/* Case Assessment */}
              <div className="text-center">
                <Button
                  onClick={handleCaseAssessment}
                  className="w-full px-4 py-6 bg-purple-600 text-white rounded-md font-semibold hover:bg-purple-700 flex flex-col items-center min-h-[100px]"
                  disabled={isCaseAssessmentLoading || !documentA.content.trim()}
                >
                  <FileEdit className="h-6 w-6 mb-2" />
                  <span className="text-sm text-center leading-tight">
                    {isCaseAssessmentLoading ? "Assessing..." : "Case Assessment"}
                  </span>
                </Button>
                <p className="text-xs text-gray-500 mt-2">How well does it make its case?</p>
              </div>

              {/* Fiction Assessment */}
              <div className="text-center">
                <Button
                  onClick={() => handleFictionAssessment("A")}
                  className="w-full px-4 py-6 bg-orange-600 text-white rounded-md font-semibold hover:bg-orange-700 flex flex-col items-center min-h-[100px]"
                  disabled={!documentA.content.trim() || isFictionAssessmentLoading}
                >
                  {isFictionAssessmentLoading ? (
                    <Loader2 className="h-6 w-6 mb-2 animate-spin" />
                  ) : (
                    <FileEdit className="h-6 w-6 mb-2" />
                  )}
                  <span className="text-sm">
                    {isFictionAssessmentLoading ? "Assessing..." : "Fiction Analysis"}
                  </span>
                </Button>
                <p className="text-xs text-gray-500 mt-2">Evaluate creative writing quality</p>
              </div>

              {/* Maximize Intelligence */}
              <div className="text-center">
                <Button
                  onClick={() => setMaximizeIntelligenceModalOpen(true)}
                  className="w-full px-4 py-6 bg-emerald-600 text-white rounded-md font-semibold hover:bg-emerald-700 flex flex-col items-center min-h-[100px]"
                  disabled={!documentA.content.trim()}
                  data-testid="button-maximize-intelligence"
                >
                  <Sparkles className="h-6 w-6 mb-2" />
                  <span className="text-sm">Maximize Intelligence</span>
                </Button>
                <p className="text-xs text-gray-500 mt-2">Rewrite to boost intelligence score</p>
              </div>
            </div>
            
            {/* Clear All Button */}
            <div className="mt-6 text-center">
              <Button
                onClick={handleReset}
                variant="outline"
                className="px-6 py-2 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 flex items-center mx-auto"
                disabled={isAnalysisLoading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                <span>New Analysis / Clear All</span>
              </Button>
            </div>
          </div>
        ) : (
          /* Comparison Mode Buttons */
          <div className="flex justify-center gap-4 flex-wrap">
            <Button
              onClick={handleAnalyze}
              className="px-6 py-3 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 flex items-center"
              disabled={isAnalysisLoading}
            >
              <Brain className="h-5 w-5 mr-2" />
              <span>
                {isAnalysisLoading ? "Analyzing..." : "Analyze Both Documents"}
              </span>
            </Button>
            
            <Button
              onClick={handleDocumentComparison}
              className="px-6 py-3 bg-purple-600 text-white rounded-md font-semibold hover:bg-purple-700 flex items-center"
              disabled={!documentA.content.trim() || !documentB.content.trim() || isComparisonLoading}
            >
              <FileEdit className="h-5 w-5 mr-2" />
              <span>
                {isComparisonLoading ? "Comparing..." : "Which One Makes Its Case Better?"}
              </span>
            </Button>
            
            <Button
              onClick={handleFictionComparison}
              className="px-6 py-3 bg-amber-600 text-white rounded-md font-semibold hover:bg-amber-700 flex items-center"
              disabled={!documentA.content.trim() || !documentB.content.trim()}
            >
              <FileEdit className="h-5 w-5 mr-2" />
              <span>Compare Fiction</span>
            </Button>            
            <Button
              onClick={handleReset}
              className="px-6 py-3 bg-red-600 text-white rounded-md font-semibold hover:bg-red-700 flex items-center"
              disabled={isAnalysisLoading}
            >
              <Trash2 className="h-5 w-5 mr-2" />
              <span>New Analysis / Clear All</span>
            </Button>
          </div>
        )}
      </div>

      {/* AI Detection Modal */}
      <AIDetectionModal
        isOpen={aiDetectionModalOpen}
        onClose={() => setAIDetectionModalOpen(false)}
        result={aiDetectionResult}
        isLoading={isAICheckLoading}
      />

      {/* Results Section */}
      {showResults && (
        <div id="resultsSection">
          {/* Loading Indicator */}
          {isAnalysisLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mb-4"></div>
              <p className="text-gray-600">Analyzing document content...</p>
            </div>
          ) : (
            <div>
              {/* Document A Results */}
              {analysisA && <DocumentResults id="A" analysis={analysisA} originalDocument={documentA} analysisMode={analysisType} onSendToHumanizer={handleSendToHumanizer} onSendToIntelligence={handleSendToIntelligence} onSendToChat={handleSendToChat} />}

              {/* Document B Results (only in compare mode) */}
              {mode === "compare" && analysisB && (
                <DocumentResults id="B" analysis={analysisB} originalDocument={documentB} analysisMode={analysisType} onSendToHumanizer={handleSendToHumanizer} onSendToIntelligence={handleSendToIntelligence} onSendToChat={handleSendToChat} />
              )}

              {/* Comparative Results (only in compare mode) */}
              {mode === "compare" && comparison && analysisA && analysisB && (
                <ComparativeResults
                  analysisA={analysisA}
                  analysisB={analysisB}
                  comparison={comparison}
                  onSendToHumanizer={handleSendToHumanizer}
                  onSendToIntelligence={handleSendToIntelligence}
                  onSendToChat={handleSendToChat}
                  documentAText={documentA?.content}
                  documentBText={documentB?.content}
                />
              )}
              

              
              {/* Semantic Density Analysis - always shown when there's text */}
              {mode === "single" && documentA.content.trim() && (
                <div className="bg-white rounded-lg shadow-md p-6 mb-8 mt-8">
                  <SemanticDensityAnalyzer text={documentA.content} />
                </div>
              )}
            </div>
          )}
        </div>
      )}



      {/* Case Assessment Modal - REMOVED: Results now show in main report only */}

      {/* Document Comparison Modal */}
      <DocumentComparisonModal
        isOpen={comparisonModalOpen}
        onClose={() => setComparisonModalOpen(false)}
        result={comparisonResult}
        isLoading={isComparisonLoading}
      />

      {/* AI Detection Modal */}
      <AIDetectionModal
        isOpen={aiDetectionModalOpen}
        onClose={() => setAIDetectionModalOpen(false)}
        result={aiDetectionResult}
        isLoading={isAICheckLoading}
      />

      {/* Fiction Assessment Modal - REMOVED: Results now show in main report only */}

      {/* Fiction Comparison Modal */}
      <FictionComparisonModal
        isOpen={fictionComparisonModalOpen}
        onClose={() => setFictionComparisonModalOpen(false)}
        documentA={{
          content: documentA.content,
          title: documentA.filename || "Document A"
        }}
        documentB={{
          content: documentB.content,
          title: documentB.filename || "Document B"
        }}
      />



      {/* Inline Streaming Results Area */}
      {(isStreaming || streamingContent) && (
        <div className="mx-4 mb-6">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-blue-900">
                🎯 Intelligence Analysis
                {isStreaming && <span className="ml-2 text-sm font-normal text-blue-600">Streaming...</span>}
              </h3>
            </div>
            <div className="bg-white rounded-md p-4 border border-blue-100 min-h-[200px]">
              <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap font-mono text-sm leading-relaxed">
                {streamingContent}
                {isStreaming && <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1">|</span>}
              </div>
            </div>
            {streamingContent && !isStreaming && (
              <div className="mt-4 flex justify-end">
                <Button 
                  onClick={() => setStreamingContent('')}
                  variant="outline"
                  size="sm"
                  className="text-gray-600 hover:text-gray-800"
                >
                  New Analysis
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Maximize Intelligence Modal */}
      <Dialog open={maximizeIntelligenceModalOpen} onOpenChange={setMaximizeIntelligenceModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              Maximize Intelligence
            </DialogTitle>
            <DialogDescription>
              Customize rewrite instructions to maximize intelligence scores, or use our default optimization criteria.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* External Knowledge Toggle */}
            <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex-1">
                <Label htmlFor="external-knowledge-main" className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  USE ZHI DATABASE (AnalyticPhilosophy.net)
                </Label>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  When enabled, MAXINTEL fetches research passages and citations from the Zhi knowledge base
                </p>
              </div>
              <Switch
                id="external-knowledge-main"
                checked={useExternalKnowledge}
                onCheckedChange={setUseExternalKnowledge}
                disabled={isMaximizeIntelligenceLoading}
                data-testid="toggle-external-knowledge-main"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Custom Instructions (optional)
              </label>
              <Textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="Enter custom rewrite instructions here. If left empty, default optimization criteria will be used."
                className="min-h-[120px]"
                data-testid="textarea-custom-instructions"
              />
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Default Instructions (used if custom field is empty):</h4>
              <div className="text-xs text-gray-600 max-h-40 overflow-y-auto whitespace-pre-wrap">
                {defaultInstructions}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMaximizeIntelligenceModalOpen(false)}
              data-testid="button-cancel-maximize"
            >
              Cancel
            </Button>
            <Button
              onClick={handleMaximizeIntelligence}
              disabled={isMaximizeIntelligenceLoading}
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="button-confirm-maximize"
            >
              {isMaximizeIntelligenceLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rewriting...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Maximize Intelligence
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Intelligent Rewrite Results Modal */}
      <Dialog open={rewriteResultsModalOpen} onOpenChange={setRewriteResultsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-emerald-600" />
              Intelligent Rewrite Results
            </DialogTitle>
            <DialogDescription>
              Your text has been optimized for maximum intelligence scoring. Review the results below.
            </DialogDescription>
          </DialogHeader>
          
          {rewriteResultData && (
            <div className="space-y-6">
              {/* Score Improvement */}
              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg">
                <h3 className="font-semibold text-emerald-800 dark:text-emerald-200 mb-2">Score Improvement</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">{rewriteResultData.originalScore}/100</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Original</div>
                  </div>
                  <div className="text-center">
                    <div className="text-emerald-600 dark:text-emerald-400">
                      {rewriteResultData.rewrittenScore > rewriteResultData.originalScore ? "+" : ""}
                      {rewriteResultData.rewrittenScore - rewriteResultData.originalScore}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Change</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{rewriteResultData.rewrittenScore}/100</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Rewritten</div>
                  </div>
                </div>
              </div>

              {/* Rewritten Text */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">Rewritten Text</h3>
                  <SendToButton
                    text={rewriteResultData.rewrittenText}
                    onSendToValidator={(text) => setValidatorInputText(text)}
                    size="sm"
                  />
                </div>
                <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800 max-h-60 overflow-y-auto">
                  <p className="whitespace-pre-wrap">{rewriteResultData.rewrittenText}</p>
                </div>
              </div>

              {/* Original Text for comparison */}
              <div>
                <h3 className="font-semibold mb-2">Original Text</h3>
                <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800 max-h-40 overflow-y-auto">
                  <p className="whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400">{rewriteResultData.originalText}</p>
                </div>
              </div>

              {/* Rewrite Report if available */}
              {rewriteResultData.rewriteReport && (
                <div>
                  <h3 className="font-semibold mb-2">Rewrite Analysis Report</h3>
                  <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800 max-h-40 overflow-y-auto">
                    <p className="whitespace-pre-wrap text-sm">{rewriteResultData.rewriteReport}</p>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="flex flex-col sm:flex-row gap-3">
            <Button 
              variant="outline" 
              onClick={handleDownloadRewrite}
              className="flex items-center gap-2"
              data-testid="button-download-rewrite"
            >
              <Download className="w-4 h-4" />
              Download Results
            </Button>
            <Button 
              variant="outline" 
              onClick={handleKeepOriginalText}
              data-testid="button-keep-original"
            >
              Keep Original
            </Button>
            <Button 
              onClick={handleSendToIntelligenceAnalysis}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-send-to-intelligence"
            >
              <Brain className="w-4 h-4 mr-2" />
              Send to Intelligence Analysis
            </Button>
            <Button 
              onClick={() => {
                if (rewriteResultData?.rewrittenText) {
                  setBoxA(rewriteResultData.rewrittenText);
                  setRewriteResultsModalOpen(false);
                  toast({
                    title: "Text sent to Humanizer",
                    description: "Rewritten text has been sent to the Humanizer input box"
                  });
                }
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white"
              data-testid="button-send-to-humanizer"
            >
              <Shield className="w-4 h-4 mr-2" />
              Send to Humanizer
            </Button>
            <Button 
              onClick={handleUseRewrittenText}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              data-testid="button-use-rewritten"
            >
              Use Rewritten Text
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
      {/* END OF HIDDEN INTELLIGENCE ANALYSIS TOOL */}


      {/* TEXT MODEL VALIDATOR - Interpretive Generosity Framework */}
      <div className="mt-16 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 p-8 rounded-lg border-2 border-emerald-200 dark:border-emerald-700">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-emerald-900 dark:text-emerald-100 mb-3 flex items-center justify-center gap-3">
              <BookOpen className="w-8 h-8 text-emerald-600" />
              Text Model Validator
            </h2>
            <p className="text-lg text-gray-700 dark:text-gray-300 mb-2">
              Validate texts through interpretive generosity - find models that make difficult texts coherent
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Extract logic, swap domains, formalize mathematically, or let AI decide the best approach
            </p>
          </div>

          {/* Input Area */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                Input Text to Validate
              </label>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, setValidatorInputText);
                  }}
                  data-testid="input-validator-upload"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                  onClick={(e) => {
                    e.preventDefault();
                    (e.currentTarget.previousElementSibling as HTMLInputElement)?.click();
                  }}
                  data-testid="button-validator-upload"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
                </Button>
              </label>
            </div>
            <Textarea
              value={validatorInputText}
              onChange={(e) => setValidatorInputText(e.target.value)}
              placeholder="Paste complex, obscure, or muddled text here... (philosophy papers, technical documents, draft arguments, etc.)"
              className="min-h-[200px] font-mono text-sm"
              data-testid="textarea-validator-input"
            />
          </div>

          {/* FULL SUITE - Run All Functions in Sequence */}
          <div className="mb-6 bg-gradient-to-r from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 p-6 rounded-lg border-2 border-violet-300 dark:border-violet-700">
            <div 
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setShowFullSuitePanel(!showFullSuitePanel)}
            >
              <h3 className="text-xl font-bold text-violet-900 dark:text-violet-100 flex items-center gap-2">
                <Zap className="w-6 h-6 text-violet-600" />
                Run Full Suite
                <Badge variant="outline" className="ml-2 bg-violet-200 dark:bg-violet-800 text-violet-800 dark:text-violet-200">
                  Batch + BOTTOMLINE + Objections
                </Badge>
              </h3>
              <Button variant="ghost" size="icon" data-testid="button-toggle-full-suite">
                {showFullSuitePanel ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </Button>
            </div>
            <p className="text-sm text-violet-700 dark:text-violet-300 mt-2">
              Run all 5 analysis functions, synthesize with BOTTOMLINE, and generate 25 objections - all in one click.
            </p>

            {showFullSuitePanel && (
              <div className="mt-4 space-y-4">
                {/* Required Settings for Full Suite */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-violet-800 dark:text-violet-200">
                      Target Audience <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={bottomlineAudience}
                      onChange={(e) => setBottomlineAudience(e.target.value)}
                      placeholder="Who is this for? (e.g., 'Investors', 'Academic reviewers')"
                      className="mt-1 border-violet-300 focus:border-violet-500"
                      data-testid="input-fullsuite-audience"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-violet-800 dark:text-violet-200">
                      Objective <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={bottomlineObjective}
                      onChange={(e) => setBottomlineObjective(e.target.value)}
                      placeholder="What do you want to achieve? (e.g., 'Convince them to invest')"
                      className="mt-1 border-violet-300 focus:border-violet-500"
                      data-testid="input-fullsuite-objective"
                    />
                  </div>
                </div>

                {/* Optional Settings */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-violet-800 dark:text-violet-200">
                      Core Idea (optional)
                    </Label>
                    <Input
                      value={bottomlineIdea}
                      onChange={(e) => setBottomlineIdea(e.target.value)}
                      placeholder="The main message to convey"
                      className="mt-1"
                      data-testid="input-fullsuite-idea"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-violet-800 dark:text-violet-200">
                      Tone
                    </Label>
                    <Select value={bottomlineTone} onValueChange={(v: any) => setBottomlineTone(v)}>
                      <SelectTrigger className="mt-1" data-testid="select-fullsuite-tone">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="formal">Formal</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="conversational">Conversational</SelectItem>
                        <SelectItem value="persuasive">Persuasive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-violet-800 dark:text-violet-200">
                      Length
                    </Label>
                    <Select value={bottomlineLength} onValueChange={(v: any) => setBottomlineLength(v)}>
                      <SelectTrigger className="mt-1" data-testid="select-fullsuite-length">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="brief">Brief (1-2 paragraphs)</SelectItem>
                        <SelectItem value="medium">Medium (3-5 paragraphs)</SelectItem>
                        <SelectItem value="detailed">Detailed (full document)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Additional Information */}
                <div>
                  <Label className="text-sm font-medium text-violet-800 dark:text-violet-200">
                    Additional Information (optional)
                  </Label>
                  <Textarea
                    value={fullSuiteAdditionalInfo}
                    onChange={(e) => setFullSuiteAdditionalInfo(e.target.value)}
                    placeholder="Any extra context, background information, or special considerations you want the AI to factor in..."
                    className="mt-1 min-h-[80px]"
                    data-testid="input-fullsuite-additional-info"
                  />
                </div>

                {/* Progress Tracker */}
                {fullSuiteLoading && (
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-violet-200 dark:border-violet-700">
                    <div className="flex items-center gap-4 justify-center flex-wrap">
                      {/* Stage 1: Batch */}
                      <div className={`flex items-center gap-2 ${
                        ["batch"].includes(fullSuiteStage) ? "text-violet-600 font-semibold" : 
                        ["bottomline", "objections", "refine", "complete"].includes(fullSuiteStage) ? "text-green-600" : "text-gray-400"
                      }`}>
                        {["batch"].includes(fullSuiteStage) ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : ["bottomline", "objections", "refine", "complete"].includes(fullSuiteStage) ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                        <span>1. Batch Analysis</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                      {/* Stage 2: BOTTOMLINE */}
                      <div className={`flex items-center gap-2 ${
                        ["bottomline"].includes(fullSuiteStage) ? "text-violet-600 font-semibold" : 
                        ["objections", "refine", "complete"].includes(fullSuiteStage) ? "text-green-600" : "text-gray-400"
                      }`}>
                        {["bottomline"].includes(fullSuiteStage) ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : ["objections", "refine", "complete"].includes(fullSuiteStage) ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                        <span>2. BOTTOMLINE</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                      {/* Stage 3: Objections */}
                      <div className={`flex items-center gap-2 ${
                        ["objections"].includes(fullSuiteStage) ? "text-violet-600 font-semibold" : 
                        ["refine", "complete"].includes(fullSuiteStage) ? "text-green-600" : "text-gray-400"
                      }`}>
                        {["objections"].includes(fullSuiteStage) ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : ["refine", "complete"].includes(fullSuiteStage) ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                        <span>3. Objections</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                      {/* Stage 4: Refined Rewrite */}
                      <div className={`flex items-center gap-2 ${
                        ["refine"].includes(fullSuiteStage) ? "text-violet-600 font-semibold" : 
                        ["complete"].includes(fullSuiteStage) ? "text-green-600" : "text-gray-400"
                      }`}>
                        {["refine"].includes(fullSuiteStage) ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : ["complete"].includes(fullSuiteStage) ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                        <span>4. Refined Rewrite</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Display */}
                {fullSuiteStage === "error" && fullSuiteError && (
                  <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-700">
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                      <AlertCircle className="w-5 h-5" />
                      <span className="font-medium">Pipeline Error:</span>
                      <span>{fullSuiteError}</span>
                    </div>
                  </div>
                )}

                {/* Run Button */}
                <Button
                  onClick={handleRunFullSuite}
                  disabled={fullSuiteLoading || !validatorInputText.trim()}
                  className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white py-6 text-lg font-semibold"
                  data-testid="button-run-full-suite"
                >
                  {fullSuiteLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Running Full Suite... ({fullSuiteStage})
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5 mr-2" />
                      Run Full Suite (5 Analyses{validatorSelectedModes.includes("axiomatic-transform") ? " + Axiomatic Model" : ""} + BOTTOMLINE + 25 Objections + Refined Rewrite)
                    </>
                  )}
                </Button>

                {fullSuiteStage === "complete" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">Full Suite completed!</span>
                    </div>
                    {(() => {
                      const buildFullSuiteDocument = () => [
                        "═══════════════════════════════════════════════════════════════",
                        "                    FULL SUITE ANALYSIS RESULTS",
                        "═══════════════════════════════════════════════════════════════",
                        "",
                        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
                        "                         BATCH ANALYSIS",
                        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
                        "",
                        ...validatorBatchResults.filter(r => r.success).map(r => {
                          const modeName = r.mode === "reconstruction" ? "CONSERVATIVE RECONSTRUCTION" :
                            r.mode === "isomorphism" ? "ISOMORPHISM ANALYSIS" :
                            r.mode === "mathmodel" ? "MATHEMATICAL MODEL" :
                            r.mode === "truth-isomorphism" ? "TRUTH SELECT" :
                            r.mode === "math-truth-select" ? "MATH TRUTH SELECT" :
                            r.mode === "axiomatic-transform" ? "AXIOMATIC SYSTEM / FORMAL MODEL" : r.mode.toUpperCase();
                          return `▸ ${modeName}\n${"─".repeat(50)}\n${r.output}\n`;
                        }),
                        "",
                        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
                        "                          BOTTOMLINE",
                        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
                        "",
                        bottomlineOutput || "(No BOTTOMLINE output)",
                        "",
                        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
                        "                    OBJECTIONS & COUNTER-ARGUMENTS",
                        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
                        "",
                        objectionsOutput || "(No Objections output)",
                        "",
                        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
                        "          REFINED REWRITE (in light of objections)",
                        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
                        "",
                        fullSuiteRefinedOutput || "(No Refined Rewrite output)",
                        "",
                        "═══════════════════════════════════════════════════════════════",
                        "                         END OF REPORT",
                        "═══════════════════════════════════════════════════════════════"
                      ].join("\n");

                      return (
                        <div className="space-y-2">
                          <Button
                            onClick={() => {
                              const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
                              handleDownloadText(buildFullSuiteDocument(), `full-suite-${stamp}.txt`);
                              toast({
                                title: "Download Started",
                                description: "Full Suite document is downloading.",
                              });
                            }}
                            className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white py-6 text-lg font-semibold shadow-lg"
                            data-testid="button-download-all-fullsuite"
                          >
                            <Download className="w-5 h-5 mr-2" />
                            Download Everything as One Document (.txt)
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(buildFullSuiteDocument());
                              toast({
                                title: "All Results Copied!",
                                description: "Complete Full Suite output copied to clipboard.",
                              });
                            }}
                            className="w-full"
                            data-testid="button-copy-all-fullsuite"
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Or Copy All Results to Clipboard
                          </Button>
                        </div>
                      );
                    })()}

                    {/* Refined Rewrite Display */}
                    {fullSuiteRefinedOutput && (
                      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border-2 border-violet-300 dark:border-violet-700 mt-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-violet-600 text-white">REFINED REWRITE</Badge>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              BOTTOMLINE rewritten in light of objections
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadText(fullSuiteRefinedOutput, 'refined-rewrite.txt')}
                              data-testid="button-download-refined-rewrite"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <CopyButton text={fullSuiteRefinedOutput} />
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded border border-gray-200 dark:border-gray-700 max-h-[500px] overflow-y-auto">
                          <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-gray-200">
                            {fullSuiteRefinedOutput}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Multi-Mode Toggle */}
          <div className="flex items-center justify-between mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center gap-3">
              <Switch
                checked={validatorMultiMode}
                onCheckedChange={(checked) => {
                  setValidatorMultiMode(checked);
                  if (!checked) {
                    setValidatorSelectedModes([]);
                    setValidatorBatchResults([]);
                  }
                }}
                data-testid="switch-multi-mode"
              />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Run Multiple Functions
              </label>
            </div>
            {validatorMultiMode && (
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200">
                  {validatorSelectedModes.length} selected
                </Badge>
                <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-xs">
                  Aggressive + Maximal Truth
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setValidatorSelectedModes(["reconstruction", "isomorphism", "mathmodel", "truth-isomorphism", "math-truth-select"])}
                  disabled={validatorBatchLoading}
                  data-testid="button-select-all-modes"
                >
                  Select All
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setValidatorSelectedModes([])}
                  disabled={validatorBatchLoading}
                  data-testid="button-clear-selection"
                >
                  Clear
                </Button>
              </div>
            )}
          </div>

          {/* Six Main Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="relative">
              {validatorMultiMode && (
                <div 
                  className={`absolute top-2 right-2 z-10 w-6 h-6 rounded-md border-2 flex items-center justify-center cursor-pointer ${
                    validatorSelectedModes.includes("reconstruction")
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : "bg-white dark:bg-gray-700 border-gray-400"
                  }`}
                  onClick={() => toggleValidatorModeSelection("reconstruction")}
                >
                  {validatorSelectedModes.includes("reconstruction") && <CheckCircle className="w-4 h-4" />}
                </div>
              )}
              <Button
                onClick={() => {
                  if (validatorMultiMode) {
                    toggleValidatorModeSelection("reconstruction");
                  } else {
                    setShowValidatorCustomization(prev => validatorMode === "reconstruction" ? !prev : true);
                    setValidatorMode("reconstruction");
                  }
                }}
                className={`flex flex-col items-center justify-center p-6 h-auto w-full ${
                  validatorMultiMode
                    ? validatorSelectedModes.includes("reconstruction")
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-white dark:bg-gray-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-2 border-emerald-300"
                    : validatorMode === "reconstruction" 
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                      : "bg-white dark:bg-gray-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-2 border-emerald-300"
                }`}
                disabled={validatorLoading || validatorBatchLoading}
                data-testid="button-reconstruction"
              >
                <RefreshCw className="w-6 h-6 mb-2" />
                <span className="font-bold text-lg">RECONSTRUCTION</span>
                <span className="text-xs mt-1 text-center opacity-80">Clean up logic</span>
              </Button>
            </div>

            <div className="relative">
              {validatorMultiMode && (
                <div 
                  className={`absolute top-2 right-2 z-10 w-6 h-6 rounded-md border-2 flex items-center justify-center cursor-pointer ${
                    validatorSelectedModes.includes("isomorphism")
                      ? "bg-teal-600 border-teal-600 text-white"
                      : "bg-white dark:bg-gray-700 border-gray-400"
                  }`}
                  onClick={() => toggleValidatorModeSelection("isomorphism")}
                >
                  {validatorSelectedModes.includes("isomorphism") && <CheckCircle className="w-4 h-4" />}
                </div>
              )}
              <Button
                onClick={() => {
                  if (validatorMultiMode) {
                    toggleValidatorModeSelection("isomorphism");
                  } else {
                    setShowValidatorCustomization(prev => validatorMode === "isomorphism" ? !prev : true);
                    setValidatorMode("isomorphism");
                  }
                }}
                className={`flex flex-col items-center justify-center p-6 h-auto w-full ${
                  validatorMultiMode
                    ? validatorSelectedModes.includes("isomorphism")
                      ? "bg-teal-600 hover:bg-teal-700 text-white"
                      : "bg-white dark:bg-gray-800 hover:bg-teal-50 dark:hover:bg-teal-900/20 text-teal-700 dark:text-teal-300 border-2 border-teal-300"
                    : validatorMode === "isomorphism" 
                      ? "bg-teal-600 hover:bg-teal-700 text-white" 
                      : "bg-white dark:bg-gray-800 hover:bg-teal-50 dark:hover:bg-teal-900/20 text-teal-700 dark:text-teal-300 border-2 border-teal-300"
                }`}
                disabled={validatorLoading || validatorBatchLoading}
                data-testid="button-isomorphism"
              >
                <FileEdit className="w-6 h-6 mb-2" />
                <span className="font-bold text-lg">ISOMORPHISM</span>
                <span className="text-xs mt-1 text-center opacity-80">Swap domains</span>
              </Button>
            </div>

            <div className="relative">
              {validatorMultiMode && (
                <div 
                  className={`absolute top-2 right-2 z-10 w-6 h-6 rounded-md border-2 flex items-center justify-center cursor-pointer ${
                    validatorSelectedModes.includes("mathmodel")
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white dark:bg-gray-700 border-gray-400"
                  }`}
                  onClick={() => toggleValidatorModeSelection("mathmodel")}
                >
                  {validatorSelectedModes.includes("mathmodel") && <CheckCircle className="w-4 h-4" />}
                </div>
              )}
              <Button
                onClick={() => {
                  if (validatorMultiMode) {
                    toggleValidatorModeSelection("mathmodel");
                  } else {
                    setShowValidatorCustomization(prev => validatorMode === "mathmodel" ? !prev : true);
                    setValidatorMode("mathmodel");
                  }
                }}
                className={`flex flex-col items-center justify-center p-6 h-auto w-full ${
                  validatorMultiMode
                    ? validatorSelectedModes.includes("mathmodel")
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-2 border-blue-300"
                    : validatorMode === "mathmodel" 
                      ? "bg-blue-600 hover:bg-blue-700 text-white" 
                      : "bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-2 border-blue-300"
                }`}
                disabled={validatorLoading || validatorBatchLoading}
                data-testid="button-mathmodel"
              >
                <Zap className="w-6 h-6 mb-2" />
                <span className="font-bold text-lg">MATH MODEL</span>
                <span className="text-xs mt-1 text-center opacity-80">Formalize it</span>
              </Button>
            </div>

            <div className="relative">
              {validatorMultiMode && (
                <div 
                  className={`absolute top-2 right-2 z-10 w-6 h-6 rounded-md border-2 flex items-center justify-center cursor-pointer ${
                    validatorSelectedModes.includes("truth-isomorphism")
                      ? "bg-orange-600 border-orange-600 text-white"
                      : "bg-white dark:bg-gray-700 border-gray-400"
                  }`}
                  onClick={() => toggleValidatorModeSelection("truth-isomorphism")}
                >
                  {validatorSelectedModes.includes("truth-isomorphism") && <CheckCircle className="w-4 h-4" />}
                </div>
              )}
              <Button
                onClick={() => {
                  if (validatorMultiMode) {
                    toggleValidatorModeSelection("truth-isomorphism");
                  } else {
                    setShowValidatorCustomization(prev => validatorMode === "truth-isomorphism" ? !prev : true);
                    setValidatorMode("truth-isomorphism");
                  }
                }}
                className={`flex flex-col items-center justify-center p-6 h-auto w-full ${
                  validatorMultiMode
                    ? validatorSelectedModes.includes("truth-isomorphism")
                      ? "bg-orange-600 hover:bg-orange-700 text-white"
                      : "bg-white dark:bg-gray-800 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-2 border-orange-300"
                    : validatorMode === "truth-isomorphism" 
                      ? "bg-orange-600 hover:bg-orange-700 text-white" 
                      : "bg-white dark:bg-gray-800 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-2 border-orange-300"
                }`}
                disabled={validatorLoading || validatorBatchLoading}
                data-testid="button-truth-isomorphism"
              >
                <Shield className="w-6 h-6 mb-2" />
                <span className="font-bold text-lg">TRUTH SELECT</span>
                <span className="text-xs mt-1 text-center opacity-80">Choose truth mapping</span>
              </Button>
            </div>

            <div className="relative">
              {validatorMultiMode && (
                <div 
                  className={`absolute top-2 right-2 z-10 w-6 h-6 rounded-md border-2 flex items-center justify-center cursor-pointer ${
                    validatorSelectedModes.includes("math-truth-select")
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "bg-white dark:bg-gray-700 border-gray-400"
                  }`}
                  onClick={() => toggleValidatorModeSelection("math-truth-select")}
                >
                  {validatorSelectedModes.includes("math-truth-select") && <CheckCircle className="w-4 h-4" />}
                </div>
              )}
              <Button
                onClick={() => {
                  if (validatorMultiMode) {
                    toggleValidatorModeSelection("math-truth-select");
                  } else {
                    setShowValidatorCustomization(prev => validatorMode === "math-truth-select" ? !prev : true);
                    setValidatorMode("math-truth-select");
                  }
                }}
                className={`flex flex-col items-center justify-center p-6 h-auto w-full ${
                  validatorMultiMode
                    ? validatorSelectedModes.includes("math-truth-select")
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                      : "bg-white dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-2 border-indigo-300"
                    : validatorMode === "math-truth-select" 
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white" 
                      : "bg-white dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-2 border-indigo-300"
                }`}
                disabled={validatorLoading || validatorBatchLoading}
                data-testid="button-math-truth-select"
              >
                <BarChart3 className="w-6 h-6 mb-2" />
                <span className="font-bold text-lg">MATH + TRUTH</span>
                <span className="text-xs mt-1 text-center opacity-80">Formalize with truth control</span>
              </Button>
            </div>

            {/* Axiomatic System Transformer */}
            <div className="relative">
              {validatorMultiMode && (
                <div 
                  className={`absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer ${
                    validatorSelectedModes.includes("axiomatic-transform") 
                      ? "bg-purple-600 text-white" 
                      : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                  }`}
                  onClick={() => toggleValidatorModeSelection("axiomatic-transform")}
                >
                  {validatorSelectedModes.includes("axiomatic-transform") && <CheckCircle className="w-4 h-4" />}
                </div>
              )}
              <Button
                onClick={() => {
                  if (validatorMultiMode) {
                    toggleValidatorModeSelection("axiomatic-transform");
                  } else {
                    setShowValidatorCustomization(prev => validatorMode === "axiomatic-transform" ? !prev : true);
                    setValidatorMode("axiomatic-transform");
                  }
                }}
                className={`flex flex-col items-center justify-center p-6 h-auto w-full ${
                  validatorMultiMode
                    ? validatorSelectedModes.includes("axiomatic-transform")
                      ? "bg-purple-600 hover:bg-purple-700 text-white"
                      : "bg-white dark:bg-gray-800 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-2 border-purple-300"
                    : validatorMode === "axiomatic-transform" 
                      ? "bg-purple-600 hover:bg-purple-700 text-white" 
                      : "bg-white dark:bg-gray-800 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-2 border-purple-300"
                }`}
                disabled={validatorLoading || validatorBatchLoading}
                data-testid="button-axiomatic-transform"
              >
                <FileCode className="w-6 h-6 mb-2" />
                <span className="font-bold text-lg">AXIOMATIC</span>
                <span className="text-xs mt-1 text-center opacity-80">Full formal system</span>
              </Button>
            </div>

            <Button
              onClick={() => {
                setShowValidatorCustomization(false);
                handleValidatorProcess("autodecide");
              }}
              className={`flex flex-col items-center justify-center p-6 h-auto ${
                validatorMode === "autodecide" 
                  ? "bg-purple-600 hover:bg-purple-700 text-white" 
                  : "bg-white dark:bg-gray-800 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-2 border-purple-300"
              } ${validatorMultiMode ? "opacity-50 cursor-not-allowed" : ""}`}
              disabled={validatorLoading || validatorBatchLoading || validatorMultiMode}
              data-testid="button-autodecide"
            >
              <Brain className="w-6 h-6 mb-2" />
              <span className="font-bold text-lg">AUTO-DECIDE</span>
              <span className="text-xs mt-1 text-center opacity-80">{validatorMultiMode ? "Not available in multi-mode" : "Let AI choose"}</span>
            </Button>
          </div>

          {/* Run Selected Button (Multi-Mode) */}
          {validatorMultiMode && validatorSelectedModes.length > 0 && (
            <div className="mb-6 text-center">
              <Button
                onClick={handleValidatorBatchProcess}
                disabled={validatorBatchLoading}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-8 py-3 text-lg"
                data-testid="button-run-selected-modes"
              >
                {validatorBatchLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing {validatorSelectedModes.length} Functions...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 mr-2" />
                    Run {validatorSelectedModes.length} Selected Functions
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Clear All Button */}
          <div className="mt-4 text-center">
            <Button
              onClick={handleValidatorClear}
              variant="outline"
              className="px-6 py-2 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 dark:hover:bg-red-900/20 flex items-center mx-auto"
              disabled={validatorLoading}
              data-testid="button-validator-clear-all"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              <span>New Analysis / Clear All</span>
            </Button>
          </div>

          {/* Optional Custom Instructions Box */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 mt-6">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Custom Instructions (Optional)
            </label>
            <Textarea
              value={validatorCustomInstructions}
              onChange={(e) => setValidatorCustomInstructions(e.target.value)}
              placeholder="e.g., 'Identify an isomorphism from biochemistry' or 'Reconstruct as a control theory model' or 'Use game theory framework'"
              className="min-h-[100px] text-sm"
              data-testid="textarea-validator-custom-instructions"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Provide specific guidance about the nature of the reconstruction, isomorphism, formalization, etc.
            </p>
          </div>

          {/* LLM Provider Selector */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 mt-4">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              AI Model Selection
            </label>
            <Select value={validatorLLMProvider} onValueChange={setValidatorLLMProvider}>
              <SelectTrigger data-testid="select-validator-llm" className="w-full">
                <SelectValue placeholder="Select AI Model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zhi5">ZHI 5 - Default</SelectItem>
                <SelectItem value="zhi1">ZHI 1</SelectItem>
                <SelectItem value="zhi2">ZHI 2</SelectItem>
                <SelectItem value="zhi3">ZHI 3</SelectItem>
                <SelectItem value="zhi4">ZHI 4</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Choose which ZHI model powers the validation. ZHI 5 is recommended for most tasks.
            </p>
          </div>

          {/* Customization Panel */}
          {showValidatorCustomization && validatorMode && validatorMode !== "autodecide" && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border-2 border-gray-200 dark:border-gray-700 mb-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileEdit className="w-5 h-5" />
                Customization Options - {validatorMode.toUpperCase()}
              </h3>

              {validatorMode === "reconstruction" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Target Domain</label>
                    <input
                      type="text"
                      value={validatorTargetDomain}
                      onChange={(e) => setValidatorTargetDomain(e.target.value)}
                      placeholder="e.g., cognitive science, information theory, computational model"
                      className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                      data-testid="input-target-domain"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Fidelity Level</label>
                    <Select value={validatorFidelityLevel} onValueChange={(value: "conservative" | "aggressive") => setValidatorFidelityLevel(value)}>
                      <SelectTrigger data-testid="select-fidelity-level">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="conservative">Conservative (Stay close to original)</SelectItem>
                        <SelectItem value="aggressive">Aggressive (Maximize clarity)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {validatorMode === "isomorphism" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Target Domain</label>
                    <input
                      type="text"
                      value={validatorTargetDomain}
                      onChange={(e) => setValidatorTargetDomain(e.target.value)}
                      placeholder="e.g., economics, evolutionary psychology, thermodynamics"
                      className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                      data-testid="input-target-domain"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Constraint Type</label>
                    <Select value={validatorConstraintType} onValueChange={(value: "pure-swap" | "true-statements" | "historical") => setValidatorConstraintType(value)}>
                      <SelectTrigger data-testid="select-constraint-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pure-swap">Pure Swap (Just replace terms)</SelectItem>
                        <SelectItem value="true-statements">True Statements (Find verified true claims)</SelectItem>
                        <SelectItem value="historical">Historical (Find historical theory)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {validatorMode === "mathmodel" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Mathematical Framework</label>
                    <Select value={validatorMathFramework} onValueChange={setValidatorMathFramework}>
                      <SelectTrigger data-testid="select-math-framework">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="variational-inference">Variational Inference</SelectItem>
                        <SelectItem value="game-theory">Game Theory</SelectItem>
                        <SelectItem value="category-theory">Category Theory</SelectItem>
                        <SelectItem value="dynamical-systems">Dynamical Systems</SelectItem>
                        <SelectItem value="graph-theory">Graph Theory</SelectItem>
                        <SelectItem value="optimization">Optimization Problems</SelectItem>
                        <SelectItem value="probability">Probability Theory</SelectItem>
                        <SelectItem value="differential-equations">Differential Equations</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Rigor Level</label>
                    <Select value={validatorRigorLevel} onValueChange={(value: "sketch" | "semi-formal" | "proof-ready") => setValidatorRigorLevel(value)}>
                      <SelectTrigger data-testid="select-rigor-level">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sketch">Sketch (Intuitive formalization)</SelectItem>
                        <SelectItem value="semi-formal">Semi-formal (Notation with explanations)</SelectItem>
                        <SelectItem value="proof-ready">Proof-ready (Complete formal spec)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {validatorMode === "truth-isomorphism" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Target Domain</label>
                    <input
                      type="text"
                      value={validatorTargetDomain}
                      onChange={(e) => setValidatorTargetDomain(e.target.value)}
                      placeholder="e.g., physics, sociology, computer science"
                      className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                      data-testid="input-target-domain-truth"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Truth-Value Mapping</label>
                    <Select value={validatorTruthMapping} onValueChange={(value: "false-to-true" | "true-to-true" | "true-to-false") => setValidatorTruthMapping(value)}>
                      <SelectTrigger data-testid="select-truth-mapping">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="false-to-true">FALSE → TRUE (Map false statements to true ones)</SelectItem>
                        <SelectItem value="true-to-true">TRUE → TRUE (Preserve truth while swapping domains)</SelectItem>
                        <SelectItem value="true-to-false">TRUE → FALSE (Map true statements to false ones)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Choose how to handle truth values when mapping to the target domain
                    </p>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded dark:border-gray-600 bg-blue-50 dark:bg-blue-900/20">
                    <div>
                      <label htmlFor="literal-truth-toggle" className="text-sm font-medium cursor-pointer">
                        Literal Truth Mode
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Ensure statements are LITERALLY true (not approximately or qualifiedly true)
                      </p>
                    </div>
                    <Switch
                      id="literal-truth-toggle"
                      checked={validatorLiteralTruth}
                      onCheckedChange={setValidatorLiteralTruth}
                      data-testid="switch-literal-truth"
                    />
                  </div>
                </div>
              )}

              {validatorMode === "math-truth-select" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Mathematical Framework</label>
                    <Select value={validatorMathFramework} onValueChange={setValidatorMathFramework}>
                      <SelectTrigger data-testid="select-math-framework-truth">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="variational-inference">Variational Inference</SelectItem>
                        <SelectItem value="game-theory">Game Theory</SelectItem>
                        <SelectItem value="category-theory">Category Theory</SelectItem>
                        <SelectItem value="dynamical-systems">Dynamical Systems</SelectItem>
                        <SelectItem value="graph-theory">Graph Theory</SelectItem>
                        <SelectItem value="optimization">Optimization Problems</SelectItem>
                        <SelectItem value="probability">Probability Theory</SelectItem>
                        <SelectItem value="differential-equations">Differential Equations</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Truth-Value Assignment</label>
                    <Select value={validatorMathTruthMapping} onValueChange={(value: "make-true" | "keep-true" | "make-false") => setValidatorMathTruthMapping(value)}>
                      <SelectTrigger data-testid="select-math-truth-mapping">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="make-true">MAKE TRUE (Assign values to make formalization true)</SelectItem>
                        <SelectItem value="keep-true">KEEP TRUE (Assign values preserving truth)</SelectItem>
                        <SelectItem value="make-false">MAKE FALSE (Assign values to make formalization false)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Control truth value through semantic value assignment to mathematical constants
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Rigor Level</label>
                    <Select value={validatorRigorLevel} onValueChange={(value: "sketch" | "semi-formal" | "proof-ready") => setValidatorRigorLevel(value)}>
                      <SelectTrigger data-testid="select-rigor-level-truth">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sketch">Sketch (Intuitive formalization)</SelectItem>
                        <SelectItem value="semi-formal">Semi-formal (Notation with explanations)</SelectItem>
                        <SelectItem value="proof-ready">Proof-ready (Complete formal spec)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded dark:border-gray-600 bg-blue-50 dark:bg-blue-900/20">
                    <div>
                      <label htmlFor="literal-truth-toggle-math" className="text-sm font-medium cursor-pointer">
                        Literal Truth Mode
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Ensure statements are LITERALLY true (not approximately or qualifiedly true)
                      </p>
                    </div>
                    <Switch
                      id="literal-truth-toggle-math"
                      checked={validatorLiteralTruth}
                      onCheckedChange={setValidatorLiteralTruth}
                      data-testid="switch-literal-truth-math"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => handleValidatorProcess(validatorMode)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={validatorLoading}
                  data-testid="button-generate-validator"
                >
                  {validatorLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => setShowValidatorCustomization(false)}
                  variant="outline"
                  data-testid="button-hide-customization"
                >
                  Hide Options
                </Button>
              </div>
            </div>
          )}

          {/* Output Display */}
          {validatorOutput && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border-2 border-emerald-300 dark:border-emerald-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                  Validation Result ({validatorMode?.toUpperCase()})
                </h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadText(validatorOutput, `validator-output-${validatorMode}.txt`)}
                    data-testid="button-download-validator-output"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  <SendToButton
                    text={validatorOutput}
                    onSendToIntelligence={(text) => setDocumentA({ content: text })}
                    onSendToHumanizer={(text) => setBoxA(text)}
                    onSendToChat={(text) => {
                      const chatInput = document.querySelector('[data-testid="chat-input"]') as HTMLTextAreaElement;
                      if (chatInput) {
                        chatInput.value = text;
                        chatInput.dispatchEvent(new Event('input', { bubbles: true }));
                      }
                    }}
                  />
                  <CopyButton text={validatorOutput} />
                  <Button
                    onClick={() => {
                      setRedoCustomInstructions("");
                      setShowRedoModal(true);
                    }}
                    variant="outline"
                    size="sm"
                    className="bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/20 dark:hover:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300"
                    data-testid="button-redo-validator"
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Redo
                  </Button>
                  <Button
                    onClick={handleValidatorClear}
                    variant="outline"
                    size="sm"
                    data-testid="button-clear-validator"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded border border-gray-200 dark:border-gray-700 max-h-[600px] overflow-y-auto">
                {validatorMode === "mathmodel" ? (
                  <MathRenderer 
                    content={validatorOutput} 
                    className="text-gray-800 dark:text-gray-200"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-gray-200">
                    {validatorOutput}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* Loading State */}
          {validatorLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Processing text validation...</p>
            </div>
          )}

          {/* Batch Loading State */}
          {validatorBatchLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Processing {validatorSelectedModes.length} functions...</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">This may take a few minutes</p>
            </div>
          )}

          {/* Batch Results Display */}
          {validatorBatchResults.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-emerald-600" />
                  Batch Validation Results ({validatorBatchResults.filter(r => r.success).length}/{validatorBatchResults.length} successful)
                </h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allResults = validatorBatchResults
                        .map(r => r.success ? r.output : `[ERROR: ${r.error}]`)
                        .join('\n\n' + '═'.repeat(80) + '\n\n');
                      handleDownloadText(allResults, 'batch-validator-results.txt');
                    }}
                    data-testid="button-download-all-batch"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download All
                  </Button>
                  <CopyButton 
                    text={validatorBatchResults
                      .map(r => r.success ? r.output : `[ERROR: ${r.error}]`)
                      .join('\n\n' + '═'.repeat(80) + '\n\n')} 
                  />
                  <Button
                    onClick={handleValidatorClear}
                    variant="outline"
                    size="sm"
                    data-testid="button-clear-batch"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Clear All
                  </Button>
                </div>
              </div>

              {validatorBatchResults.map((result, index) => {
                const modeLabels: Record<string, string> = {
                  'reconstruction': 'Reconstruction',
                  'isomorphism': 'Isomorphism',
                  'mathmodel': 'Math Model',
                  'truth-isomorphism': 'Truth Select',
                  'math-truth-select': 'Math + Truth',
                  'axiomatic-transform': 'Axiomatic System'
                };
                const modeBorderClasses: Record<string, string> = {
                  'reconstruction': 'border-emerald-300 dark:border-emerald-700',
                  'isomorphism': 'border-teal-300 dark:border-teal-700',
                  'mathmodel': 'border-blue-300 dark:border-blue-700',
                  'truth-isomorphism': 'border-orange-300 dark:border-orange-700',
                  'math-truth-select': 'border-indigo-300 dark:border-indigo-700',
                  'axiomatic-transform': 'border-purple-300 dark:border-purple-700'
                };
                const modeBadgeClasses: Record<string, string> = {
                  'reconstruction': 'bg-emerald-600',
                  'isomorphism': 'bg-teal-600',
                  'mathmodel': 'bg-blue-600',
                  'truth-isomorphism': 'bg-orange-600',
                  'math-truth-select': 'bg-indigo-600',
                  'axiomatic-transform': 'bg-purple-600'
                };

                return (
                  <div 
                    key={result.mode}
                    className={`bg-white dark:bg-gray-800 p-6 rounded-lg border-2 ${modeBorderClasses[result.mode] || 'border-gray-300 dark:border-gray-700'}`}
                    data-testid={`batch-result-${result.mode}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Badge className={`${modeBadgeClasses[result.mode] || 'bg-gray-600'} text-white`}>
                          {modeLabels[result.mode] || result.mode.toUpperCase()}
                        </Badge>
                        {result.success ? (
                          <Badge variant="outline" className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-400">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Success
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-400">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Failed
                          </Badge>
                        )}
                      </div>
                      {result.success && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadText(result.output || '', `validator-${result.mode}.txt`)}
                            data-testid={`button-download-${result.mode}`}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <CopyButton text={result.output || ''} />
                        </div>
                      )}
                    </div>
                    
                    {result.success ? (
                      <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded border border-gray-200 dark:border-gray-700 max-h-[400px] overflow-y-auto">
                        {result.mode === "mathmodel" ? (
                          <MathRenderer 
                            content={result.output || ''} 
                            className="text-gray-800 dark:text-gray-200"
                          />
                        ) : (
                          <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-gray-200">
                            {result.output}
                          </pre>
                        )}
                      </div>
                    ) : (
                      <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded border border-red-200 dark:border-red-700">
                        <p className="text-red-700 dark:text-red-300">
                          This mode couldn't generate a result right now. Please try again.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* BOTTOMLINE Function Panel */}
          <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-purple-900 dark:text-purple-100 flex items-center gap-2">
                  <Target className="w-6 h-6 text-purple-600" />
                  BOTTOMLINE
                </h3>
                <Badge variant="outline" className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200">
                  Final Synthesis
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBottomlinePanel(!showBottomlinePanel)}
                data-testid="button-toggle-bottomline-panel"
              >
                {showBottomlinePanel ? (
                  <>
                    <ChevronUp className="w-4 h-4 mr-1" />
                    Collapse
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 mr-1" />
                    Expand
                  </>
                )}
              </Button>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Transform your analysis into a polished final product tailored to your specific audience and objectives.
              {(validatorOutput || validatorBatchResults.length > 0) && (
                <span className="text-purple-600 dark:text-purple-400 ml-1">
                  ({Object.keys(validatorBatchResults.length > 0 ? validatorBatchResults.filter(r => r.success) : (validatorOutput ? [1] : [])).length} analysis results available)
                </span>
              )}
            </p>

            {showBottomlinePanel && (
              <div className="space-y-4 bg-purple-50 dark:bg-purple-950/20 p-6 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Who is your audience?
                    </label>
                    <Input
                      placeholder="e.g., My boss at the private equity firm, academic committee, client..."
                      value={bottomlineAudience}
                      onChange={(e) => setBottomlineAudience(e.target.value)}
                      data-testid="input-bottomline-audience"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      What is your objective?
                    </label>
                    <Input
                      placeholder="e.g., Convince them to approve the investment, explain the methodology..."
                      value={bottomlineObjective}
                      onChange={(e) => setBottomlineObjective(e.target.value)}
                      data-testid="input-bottomline-objective"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    What idea are you trying to convey?
                  </label>
                  <Textarea
                    placeholder="The core message or argument you want your audience to understand..."
                    value={bottomlineIdea}
                    onChange={(e) => setBottomlineIdea(e.target.value)}
                    className="min-h-[80px]"
                    data-testid="input-bottomline-idea"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Desired Length
                    </label>
                    <Select value={bottomlineLength} onValueChange={(v: "brief" | "medium" | "detailed") => setBottomlineLength(v)}>
                      <SelectTrigger data-testid="select-bottomline-length">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="brief">Brief (1-2 paragraphs)</SelectItem>
                        <SelectItem value="medium">Medium (3-5 paragraphs)</SelectItem>
                        <SelectItem value="detailed">Detailed (full document)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tone
                    </label>
                    <Select value={bottomlineTone} onValueChange={(v: "formal" | "professional" | "conversational" | "persuasive") => setBottomlineTone(v)}>
                      <SelectTrigger data-testid="select-bottomline-tone">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="formal">Formal (academic/legal)</SelectItem>
                        <SelectItem value="professional">Professional (business)</SelectItem>
                        <SelectItem value="conversational">Conversational</SelectItem>
                        <SelectItem value="persuasive">Persuasive (pitch)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      What to emphasize?
                    </label>
                    <Input
                      placeholder="e.g., ROI, data, emotional appeal..."
                      value={bottomlineEmphasis}
                      onChange={(e) => setBottomlineEmphasis(e.target.value)}
                      data-testid="input-bottomline-emphasis"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleBottomline}
                    disabled={bottomlineLoading || !validatorInputText.trim()}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                    data-testid="button-run-bottomline"
                  >
                    {bottomlineLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Synthesizing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate Final Output
                      </>
                    )}
                  </Button>
                  {bottomlineOutput && (
                    <Button
                      variant="outline"
                      onClick={() => setBottomlineOutput("")}
                      data-testid="button-clear-bottomline"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clear Output
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* BOTTOMLINE Output Display */}
            {bottomlineOutput && (
              <div className="mt-6 bg-white dark:bg-gray-800 p-6 rounded-lg border-2 border-purple-300 dark:border-purple-700">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-purple-900 dark:text-purple-100 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-600" />
                    Final Product
                    {bottomlineAudience && (
                      <Badge variant="outline" className="ml-2 bg-purple-100 dark:bg-purple-900/30">
                        For: {bottomlineAudience}
                      </Badge>
                    )}
                  </h4>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadText(bottomlineOutput, 'bottomline-output.txt')}
                      data-testid="button-download-bottomline"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <CopyButton text={bottomlineOutput} />
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded border border-gray-200 dark:border-gray-700 max-h-[600px] overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-gray-200">
                    {bottomlineOutput}
                  </pre>
                </div>

                {/* Objections Panel - appears after BOTTOMLINE output */}
                <div className="mt-6 border-t border-purple-200 dark:border-purple-800 pt-6">
                  <div 
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setShowObjectionsPanel(!showObjectionsPanel)}
                  >
                    <h4 className="text-lg font-semibold text-orange-900 dark:text-orange-100 flex items-center gap-2">
                      <MessageSquareWarning className="w-5 h-5 text-orange-600" />
                      Generate Objections & Responses
                    </h4>
                    <Button variant="ghost" size="icon" data-testid="button-toggle-objections-panel">
                      {showObjectionsPanel ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Generate 25 likely objections to your output and craft compelling responses
                  </p>

                  {showObjectionsPanel && (
                    <div className="mt-4 space-y-4">
                      <div className="bg-orange-50 dark:bg-orange-950/30 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                        <p className="text-sm text-orange-800 dark:text-orange-200 mb-3">
                          This will use your BOTTOMLINE settings (audience, objective, tone, emphasis) to generate targeted objections. 
                          Optionally add custom instructions below.
                        </p>
                        <Textarea
                          value={objectionsCustomInstructions}
                          onChange={(e) => setObjectionsCustomInstructions(e.target.value)}
                          placeholder="Optional: Add specific instructions (e.g., 'Focus on financial objections' or 'Include legal concerns' or 'Consider skeptics who distrust statistics')"
                          className="min-h-[80px] text-sm"
                          data-testid="textarea-objections-instructions"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          Leave blank to use default settings based on your audience and objective
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleObjections(true)}
                          disabled={objectionsLoading}
                          className="bg-orange-600 hover:bg-orange-700 text-white"
                          data-testid="button-generate-objections-from-bottomline"
                        >
                          {objectionsLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Generating Objections...
                            </>
                          ) : (
                            <>
                              <MessageSquareWarning className="w-4 h-4 mr-2" />
                              Generate 25 Objections
                            </>
                          )}
                        </Button>
                        {objectionsOutput && (
                          <Button
                            variant="outline"
                            onClick={() => setObjectionsOutput("")}
                            data-testid="button-clear-objections"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Clear
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Objections Output Display */}
            {objectionsOutput && (
              <div className="mt-6 bg-white dark:bg-gray-800 p-6 rounded-lg border-2 border-orange-300 dark:border-orange-700">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-orange-900 dark:text-orange-100 flex items-center gap-2">
                    <MessageSquareWarning className="w-5 h-5 text-orange-600" />
                    Objections & Counter-Arguments
                    <Badge variant="outline" className="ml-2 bg-orange-100 dark:bg-orange-900/30">
                      25 Items
                    </Badge>
                  </h4>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadText(objectionsOutput, 'objections-responses.txt')}
                      data-testid="button-download-objections"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <CopyButton text={objectionsOutput} />
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded border border-gray-200 dark:border-gray-700 max-h-[700px] overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-gray-200">
                    {objectionsOutput}
                  </pre>
                </div>
              </div>
            )}

            {/* STANDALONE OBJECTIONS FUNCTION - Always visible */}
            <div className="mt-8 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 p-6 rounded-lg border border-orange-200 dark:border-orange-800">
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowObjectionsPanel(!showObjectionsPanel)}
              >
                <h3 className="text-xl font-semibold text-orange-900 dark:text-orange-100 flex items-center gap-2">
                  <MessageSquareWarning className="w-6 h-6 text-orange-600" />
                  Objections Function (Standalone)
                  <Badge variant="outline" className="ml-2 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                    25 Objections + Responses
                  </Badge>
                </h3>
                <Button variant="ghost" size="icon" data-testid="button-toggle-standalone-objections">
                  {showObjectionsPanel ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-orange-700 dark:text-orange-300 mt-2 mb-4">
                Generate 25 likely objections and compelling counter-arguments for any text. Works independently or with BOTTOMLINE output.
              </p>

              {showObjectionsPanel && (
                <div className="space-y-4">
                  {/* Input Text */}
                  <div>
                    <Label className="text-sm font-medium text-orange-800 dark:text-orange-200">
                      Text to Analyze
                    </Label>
                    <Textarea
                      value={objectionsInputText}
                      onChange={(e) => setObjectionsInputText(e.target.value)}
                      placeholder="Paste your text here - this can be any argument, proposal, pitch, essay, or content you want to anticipate objections for..."
                      className="min-h-[150px] mt-2"
                      data-testid="textarea-objections-input"
                    />
                    {bottomlineOutput && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => setObjectionsInputText(bottomlineOutput)}
                        data-testid="button-use-bottomline-for-objections"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Use BOTTOMLINE Output
                      </Button>
                    )}
                  </div>

                  {/* Audience & Objective */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-orange-800 dark:text-orange-200">
                        Target Audience (optional)
                      </Label>
                      <Input
                        value={objectionsAudience}
                        onChange={(e) => setObjectionsAudience(e.target.value)}
                        placeholder="e.g., 'Investors', 'Academic reviewers', 'Skeptical customers'"
                        className="mt-1"
                        data-testid="input-objections-audience"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-orange-800 dark:text-orange-200">
                        Objective (optional)
                      </Label>
                      <Input
                        value={objectionsObjective}
                        onChange={(e) => setObjectionsObjective(e.target.value)}
                        placeholder="e.g., 'Convince them to invest', 'Get paper accepted'"
                        className="mt-1"
                        data-testid="input-objections-objective"
                      />
                    </div>
                  </div>

                  {/* Custom Instructions */}
                  <div>
                    <Label className="text-sm font-medium text-orange-800 dark:text-orange-200">
                      Custom Instructions (optional)
                    </Label>
                    <Textarea
                      value={objectionsCustomInstructions}
                      onChange={(e) => setObjectionsCustomInstructions(e.target.value)}
                      placeholder="e.g., 'Focus on financial objections' or 'Include legal/regulatory concerns' or 'Consider skeptics who distrust AI'"
                      className="min-h-[80px] mt-1"
                      data-testid="textarea-objections-custom-instructions"
                    />
                  </div>

                  {/* Generate Button */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleObjections(false)}
                      disabled={objectionsLoading || !objectionsInputText.trim()}
                      className="bg-orange-600 hover:bg-orange-700 text-white"
                      data-testid="button-generate-objections-standalone"
                    >
                      {objectionsLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating Objections...
                        </>
                      ) : (
                        <>
                          <MessageSquareWarning className="w-4 h-4 mr-2" />
                          Generate 25 Objections
                        </>
                      )}
                    </Button>
                    {objectionsInputText && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setObjectionsInputText("");
                          setObjectionsAudience("");
                          setObjectionsObjective("");
                          setObjectionsCustomInstructions("");
                        }}
                        data-testid="button-clear-objections-form"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Clear Form
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Redo Modal with Custom Instructions */}
          <Dialog open={showRedoModal} onOpenChange={setShowRedoModal}>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-amber-600" />
                  Redo with Custom Instructions
                </DialogTitle>
                <DialogDescription>
                  Enter specific instructions to guide the reconstruction. Leave blank for default behavior.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Textarea
                  value={redoCustomInstructions}
                  onChange={(e) => setRedoCustomInstructions(e.target.value)}
                  placeholder="e.g., 'Focus on the economic arguments' or 'Make the thesis about evolutionary biology' or 'Add specific scientific studies as evidence' or 'Make it more concise - half the length'"
                  className="min-h-[150px] text-sm"
                  data-testid="textarea-redo-custom-instructions"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Examples: "Add real statistics" / "Focus only on the strongest argument" / "Make it half as long" / "Frame it as a philosophical argument"
                </p>
              </div>
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowRedoModal(false)}
                  data-testid="button-cancel-redo"
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    setShowRedoModal(false);
                    setValidatorCustomInstructions(redoCustomInstructions);
                    setValidatorLoading(true);
                    try {
                      const response = await fetch("/api/text-model-validator", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          text: validatorInputText,
                          mode: validatorMode,
                          targetDomain: validatorTargetDomain,
                          fidelityLevel: validatorFidelityLevel,
                          mathFramework: validatorMathFramework,
                          constraintType: validatorConstraintType,
                          rigorLevel: validatorRigorLevel,
                          customInstructions: redoCustomInstructions,
                          truthMapping: validatorTruthMapping,
                          mathTruthMapping: validatorMathTruthMapping,
                          literalTruth: validatorLiteralTruth,
                          llmProvider: validatorLLMProvider,
                        }),
                      });
                      const data = await response.json();
                      if (data.success) {
                        setValidatorOutput(data.output);
                        toast({
                          title: "Reconstruction Complete",
                          description: redoCustomInstructions ? "Regenerated with your custom instructions" : "Regenerated with default settings",
                        });
                      } else {
                        toast({
                          title: "Error",
                          description: data.message || "Failed to process",
                          variant: "destructive",
                        });
                      }
                    } catch (error: any) {
                      toast({
                        title: "Error",
                        description: error.message || "Failed to process",
                        variant: "destructive",
                      });
                    } finally {
                      setValidatorLoading(false);
                    }
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  data-testid="button-confirm-redo"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Regenerate
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* COHERENCE METER - Analyze and Improve Text Coherence */}
      <div className="mt-16 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/10 dark:to-blue-900/10 p-8 rounded-lg border-2 border-indigo-200 dark:border-indigo-700">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="w-24"></div>
              <h2 className="text-3xl font-bold text-indigo-900 dark:text-indigo-100 flex items-center justify-center gap-3">
                <BarChart3 className="w-8 h-8 text-indigo-600" />
                Coherence Meter
              </h2>
              <Button
                onClick={handleCoherenceClear}
                variant="outline"
                size="sm"
                className="border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                data-testid="button-clear-coherence-top"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            </div>
            <p className="text-lg text-gray-700 dark:text-gray-300 mb-2">
              Analyze and improve text coherence across multiple dimensions
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Evaluate logical, scientific, thematic, instructional, or motivational coherence - then get rewrites that maximize it
            </p>
          </div>

          {/* Input Area */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-indigo-800 dark:text-indigo-200">
                Input Text (500 word limit)
              </label>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Word Count: {coherenceInputText.trim() ? coherenceInputText.trim().split(/\s+/).length : 0} / 500
                </span>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, setCoherenceInputText);
                    }}
                    data-testid="input-coherence-upload"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                    onClick={(e) => {
                      e.preventDefault();
                      (e.currentTarget.previousElementSibling as HTMLInputElement)?.click();
                    }}
                    data-testid="button-coherence-upload"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Document
                  </Button>
                </label>
              </div>
            </div>
            <Textarea
              value={coherenceInputText}
              onChange={(e) => setCoherenceInputText(e.target.value)}
              placeholder="Paste your text here to analyze coherence... (under 500 words)"
              className="min-h-[200px] font-mono text-sm"
              data-testid="textarea-coherence-input"
            />
          </div>

          {/* Chunk Selector - appears when text > 500 words */}
          {showCoherenceChunkSelector && coherenceChunks.length > 0 && (
            <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg border-2 border-yellow-400 dark:border-yellow-600">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Text Too Long - Select Sections to Process
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (selectedCoherenceChunks.length === coherenceChunks.length) {
                      setSelectedCoherenceChunks([]);
                    } else {
                      setSelectedCoherenceChunks(coherenceChunks.map(c => c.id));
                    }
                  }}
                  data-testid="button-toggle-all-chunks"
                >
                  {selectedCoherenceChunks.length === coherenceChunks.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              
              <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-4">
                Your text has been divided into {coherenceChunks.length} sections (~400 words each). Select which sections you want to analyze or rewrite:
              </p>

              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {coherenceChunks.map((chunk, index) => (
                  <label
                    key={chunk.id}
                    className={`flex items-start gap-3 p-3 rounded border-2 cursor-pointer transition ${
                      selectedCoherenceChunks.includes(chunk.id)
                        ? "bg-indigo-100 dark:bg-indigo-900/40 border-indigo-500"
                        : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCoherenceChunks.includes(chunk.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCoherenceChunks([...selectedCoherenceChunks, chunk.id]);
                        } else {
                          setSelectedCoherenceChunks(selectedCoherenceChunks.filter(id => id !== chunk.id));
                        }
                      }}
                      className="w-5 h-5 mt-1"
                      data-testid={`checkbox-${chunk.id}`}
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                        Section {index + 1}
                        <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                          (~{chunk.text.split(/\s+/).length} words)
                        </span>
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-300 italic">
                        "{chunk.preview}"
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="mt-4 flex gap-3">
                <Button
                  onClick={() => handleProcessSelectedChunks("analyze")}
                  disabled={coherenceLoading || selectedCoherenceChunks.length === 0}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                  data-testid="button-analyze-selected-chunks"
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Analyze Selected Sections ({selectedCoherenceChunks.length})
                </Button>

                <Button
                  onClick={() => handleProcessSelectedChunks("rewrite")}
                  disabled={coherenceLoading || selectedCoherenceChunks.length === 0}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  data-testid="button-rewrite-selected-chunks"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Rewrite Selected Sections ({selectedCoherenceChunks.length})
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCoherenceChunkSelector(false);
                    setCoherenceChunks([]);
                    setSelectedCoherenceChunks([]);
                  }}
                  data-testid="button-cancel-chunks"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Coherence Type Selection */}
          <div className="mb-6 bg-white dark:bg-gray-800 p-6 rounded-lg border border-indigo-200 dark:border-indigo-700">
            <label className="block text-sm font-semibold text-indigo-800 dark:text-indigo-200 mb-4">
              Select Coherence Type:
            </label>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 p-3 rounded transition">
                <input
                  type="radio"
                  name="coherence-type"
                  value="logical-consistency"
                  checked={coherenceType === "logical-consistency"}
                  onChange={(e) => setCoherenceType(e.target.value as any)}
                  className="w-4 h-4 text-indigo-600"
                  data-testid="radio-logical-consistency"
                />
                <div className="flex-1">
                  <span className="font-medium text-gray-900 dark:text-gray-100">Logical Consistency</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">- Non-contradiction only</span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 p-3 rounded transition">
                <input
                  type="radio"
                  name="coherence-type"
                  value="logical-cohesiveness"
                  checked={coherenceType === "logical-cohesiveness"}
                  onChange={(e) => setCoherenceType(e.target.value as any)}
                  className="w-4 h-4 text-indigo-600"
                  data-testid="radio-logical-cohesiveness"
                />
                <div className="flex-1">
                  <span className="font-medium text-gray-900 dark:text-gray-100">Logical Cohesiveness</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">- Argumentative structure</span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 p-3 rounded transition">
                <input
                  type="radio"
                  name="coherence-type"
                  value="scientific-explanatory"
                  checked={coherenceType === "scientific-explanatory"}
                  onChange={(e) => setCoherenceType(e.target.value as any)}
                  className="w-4 h-4 text-indigo-600"
                  data-testid="radio-scientific-explanatory"
                />
                <div className="flex-1">
                  <span className="font-medium text-gray-900 dark:text-gray-100">Scientific/Explanatory</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">- Aligns with natural law</span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 p-3 rounded transition">
                <input
                  type="radio"
                  name="coherence-type"
                  value="thematic-psychological"
                  checked={coherenceType === "thematic-psychological"}
                  onChange={(e) => setCoherenceType(e.target.value as any)}
                  className="w-4 h-4 text-indigo-600"
                  data-testid="radio-thematic-psychological"
                />
                <div className="flex-1">
                  <span className="font-medium text-gray-900 dark:text-gray-100">Thematic/Psychological</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">- Emotional & mood flow</span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 p-3 rounded transition">
                <input
                  type="radio"
                  name="coherence-type"
                  value="instructional"
                  checked={coherenceType === "instructional"}
                  onChange={(e) => setCoherenceType(e.target.value as any)}
                  className="w-4 h-4 text-indigo-600"
                  data-testid="radio-instructional"
                />
                <div className="flex-1">
                  <span className="font-medium text-gray-900 dark:text-gray-100">Instructional</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">- Clear, actionable message</span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 p-3 rounded transition">
                <input
                  type="radio"
                  name="coherence-type"
                  value="motivational"
                  checked={coherenceType === "motivational"}
                  onChange={(e) => setCoherenceType(e.target.value as any)}
                  className="w-4 h-4 text-indigo-600"
                  data-testid="radio-motivational"
                />
                <div className="flex-1">
                  <span className="font-medium text-gray-900 dark:text-gray-100">Motivational</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">- Consistent emotional direction</span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 p-3 rounded transition">
                <input
                  type="radio"
                  name="coherence-type"
                  value="mathematical"
                  checked={coherenceType === "mathematical"}
                  onChange={(e) => setCoherenceType(e.target.value as any)}
                  className="w-4 h-4 text-indigo-600"
                  data-testid="radio-mathematical"
                />
                <div className="flex-1">
                  <span className="font-medium text-gray-900 dark:text-gray-100">Mathematical (Proof Validity)</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">- Rigorous proof checking</span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 p-3 rounded transition">
                <input
                  type="radio"
                  name="coherence-type"
                  value="philosophical"
                  checked={coherenceType === "philosophical"}
                  onChange={(e) => setCoherenceType(e.target.value as any)}
                  className="w-4 h-4 text-indigo-600"
                  data-testid="radio-philosophical"
                />
                <div className="flex-1">
                  <span className="font-medium text-gray-900 dark:text-gray-100">Philosophical (Conceptual Rigor)</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">- Conceptual consistency and dialectical engagement</span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 p-3 rounded transition">
                <input
                  type="radio"
                  name="coherence-type"
                  value="auto-detect"
                  checked={coherenceType === "auto-detect"}
                  onChange={(e) => setCoherenceType(e.target.value as any)}
                  className="w-4 h-4 text-indigo-600"
                  data-testid="radio-auto-detect"
                />
                <div className="flex-1">
                  <span className="font-medium text-gray-900 dark:text-gray-100">Auto-Detect</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">- Let AI determine type</span>
                </div>
              </label>
            </div>
          </div>

          {/* Processing Mode Selection */}
          <div className="mb-6 bg-white dark:bg-gray-800 p-6 rounded-lg border border-indigo-200 dark:border-indigo-700">
            <label className="block text-sm font-semibold text-indigo-800 dark:text-indigo-200 mb-4">
              Processing Mode for Long Texts (&gt;500 words):
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label 
                className={`flex items-start gap-3 cursor-pointer p-5 rounded border-2 transition ${
                  coherenceProcessingMode === "simple" 
                    ? "bg-indigo-100 dark:bg-indigo-900/40 border-indigo-500" 
                    : "bg-white dark:bg-gray-800 border-indigo-200 dark:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                }`}
              >
                <input
                  type="radio"
                  name="coherence-processing-mode"
                  value="simple"
                  checked={coherenceProcessingMode === "simple"}
                  onChange={(e) => setCoherenceProcessingMode(e.target.value as any)}
                  className="w-5 h-5 text-indigo-600 mt-1"
                  data-testid="radio-mode-simple"
                />
                <div className="flex-1">
                  <span className="font-semibold text-gray-900 dark:text-gray-100 block mb-2 text-lg">⚡ Simple Chunking</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300 block mb-2">Process sections independently for speed</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">• Faster processing<br/>• Good for quick analysis<br/>• Each section processed separately</span>
                </div>
              </label>

              <label 
                className={`flex items-start gap-3 cursor-pointer p-5 rounded border-2 transition ${
                  coherenceProcessingMode === "outline-guided" 
                    ? "bg-indigo-100 dark:bg-indigo-900/40 border-indigo-500" 
                    : "bg-white dark:bg-gray-800 border-indigo-200 dark:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                }`}
              >
                <input
                  type="radio"
                  name="coherence-processing-mode"
                  value="outline-guided"
                  checked={coherenceProcessingMode === "outline-guided"}
                  onChange={(e) => setCoherenceProcessingMode(e.target.value as any)}
                  className="w-5 h-5 text-indigo-600 mt-1"
                  data-testid="radio-mode-outline"
                />
                <div className="flex-1">
                  <span className="font-semibold text-gray-900 dark:text-gray-100 block mb-2 text-lg">🎯 Outline-Guided (Recommended)</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300 block mb-2">Two-stage process for maximum global coherence</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">• Creates coherent outline first<br/>• Rewrites sections to align with outline<br/>• Better consistency across entire document</span>
                </div>
              </label>
            </div>
          </div>

          {/* Rewrite Aggressiveness Selection */}
          <div className="mb-6 bg-white dark:bg-gray-800 p-6 rounded-lg border border-purple-200 dark:border-purple-700">
            <label className="block text-sm font-semibold text-purple-800 dark:text-purple-200 mb-4">
              Rewrite Aggressiveness (for "Rewrite to Max Coherence"):
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label 
                className={`flex items-start gap-3 cursor-pointer p-4 rounded border-2 transition ${
                  coherenceAggressiveness === "conservative" 
                    ? "bg-purple-100 dark:bg-purple-900/40 border-purple-500" 
                    : "bg-white dark:bg-gray-800 border-purple-200 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                }`}
              >
                <input
                  type="radio"
                  name="coherence-aggressiveness"
                  value="conservative"
                  checked={coherenceAggressiveness === "conservative"}
                  onChange={(e) => setCoherenceAggressiveness(e.target.value as any)}
                  className="w-4 h-4 text-purple-600 mt-1"
                  data-testid="radio-aggressiveness-conservative"
                />
                <div className="flex-1">
                  <span className="font-semibold text-gray-900 dark:text-gray-100 block mb-1">Conservative</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">Minimal changes - preserve original structure and wording as much as possible</span>
                </div>
              </label>

              <label 
                className={`flex items-start gap-3 cursor-pointer p-4 rounded border-2 transition ${
                  coherenceAggressiveness === "moderate" 
                    ? "bg-purple-100 dark:bg-purple-900/40 border-purple-500" 
                    : "bg-white dark:bg-gray-800 border-purple-200 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                }`}
              >
                <input
                  type="radio"
                  name="coherence-aggressiveness"
                  value="moderate"
                  checked={coherenceAggressiveness === "moderate"}
                  onChange={(e) => setCoherenceAggressiveness(e.target.value as any)}
                  className="w-4 h-4 text-purple-600 mt-1"
                  data-testid="radio-aggressiveness-moderate"
                />
                <div className="flex-1">
                  <span className="font-semibold text-gray-900 dark:text-gray-100 block mb-1">Moderate</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">Fix major issues - add missing arguments and clarify key points</span>
                </div>
              </label>

              <label 
                className={`flex items-start gap-3 cursor-pointer p-4 rounded border-2 transition ${
                  coherenceAggressiveness === "aggressive" 
                    ? "bg-purple-100 dark:bg-purple-900/40 border-purple-500" 
                    : "bg-white dark:bg-gray-800 border-purple-200 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                }`}
              >
                <input
                  type="radio"
                  name="coherence-aggressiveness"
                  value="aggressive"
                  checked={coherenceAggressiveness === "aggressive"}
                  onChange={(e) => setCoherenceAggressiveness(e.target.value as any)}
                  className="w-4 h-4 text-purple-600 mt-1"
                  data-testid="radio-aggressiveness-aggressive"
                />
                <div className="flex-1">
                  <span className="font-semibold text-gray-900 dark:text-gray-100 block mb-1">Aggressive ⚡</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">Maximize coherence - expand significantly, restructure completely, add extensive context for 9-10/10 score</span>
                </div>
              </label>
            </div>
          </div>

          {/* Action Buttons - Different layout for mathematical vs other types */}
          {coherenceType === "mathematical" ? (
            /* FOUR BUTTONS FOR MATHEMATICAL PROOFS */
            <div className="space-y-4 mb-6">
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Analysis Functions:</div>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleMathCoherence}
                  disabled={coherenceLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-5 flex-1 min-w-[180px]"
                  data-testid="button-math-coherence"
                >
                  {coherenceLoading && coherenceMode === "analyze" ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing...</>
                  ) : (
                    <><BarChart3 className="w-4 h-4 mr-2" />COHERENCE</>
                  )}
                </Button>
                <Button
                  onClick={handleMathCogency}
                  disabled={coherenceLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-5 flex-1 min-w-[180px]"
                  data-testid="button-math-cogency"
                >
                  {coherenceLoading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing...</>
                  ) : (
                    <><CheckCircle className="w-4 h-4 mr-2" />COGENCY</>
                  )}
                </Button>
              </div>
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 mt-4">Rewrite Functions:</div>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleMathMaxCoherence}
                  disabled={coherenceLoading}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-5 flex-1 min-w-[180px]"
                  data-testid="button-math-max-coherence"
                >
                  {coherenceLoading && coherenceMode === "rewrite" ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Rewriting...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" />MAX COHERENCE</>
                  )}
                </Button>
                <Button
                  onClick={handleMathMaximizeTruth}
                  disabled={coherenceLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-5 flex-1 min-w-[180px]"
                  data-testid="button-math-maximize-truth"
                >
                  {coherenceLoading && mathProofIsCorrected === false ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Correcting...</>
                  ) : (
                    <><Target className="w-4 h-4 mr-2" />MAXIMIZE TRUTH</>
                  )}
                </Button>
              </div>
              <div className="flex justify-end mt-2">
                <Button
                  onClick={handleCoherenceClear}
                  variant="outline"
                  className="border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  data-testid="button-clear-coherence"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear All
                </Button>
              </div>
              {/* Math Mode Explanations */}
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-xs text-gray-600 dark:text-gray-400 space-y-2">
                <p><strong>COHERENCE:</strong> Evaluates structural coherence only (logical flow, notation, organization) - NOT whether the theorem is true.</p>
                <p><strong>COGENCY:</strong> Evaluates whether the theorem is TRUE and whether the proof is mathematically valid.</p>
                <p><strong>MAX COHERENCE:</strong> Rewrites to improve structural coherence without changing the mathematical claims.</p>
                <p><strong>MAXIMIZE TRUTH:</strong> Corrects defective proofs OR replaces proofs of falsehoods with proofs of similar true theorems.</p>
              </div>
            </div>
          ) : (
            /* STANDARD BUTTONS FOR NON-MATHEMATICAL TYPES */
            <div className="flex flex-wrap gap-4 mb-6">
              <Button
                onClick={handleCoherenceAnalyze}
                disabled={coherenceLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-6 text-lg flex-1 min-w-[200px]"
                data-testid="button-analyze-coherence"
              >
                {coherenceLoading && coherenceMode === "analyze" ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <BarChart3 className="w-5 h-5 mr-2" />
                    ANALYZE COHERENCE
                  </>
                )}
              </Button>

              <Button
                onClick={handleCoherenceRewrite}
                disabled={coherenceLoading}
                className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-6 text-lg flex-1 min-w-[200px]"
                data-testid="button-rewrite-coherence"
              >
                {coherenceLoading && coherenceMode === "rewrite" ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Rewriting...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    REWRITE TO MAX COHERENCE
                  </>
                )}
              </Button>

              <Button
                onClick={handleCoherenceClear}
                variant="outline"
                className="border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                data-testid="button-clear-coherence"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            </div>
          )}

          {/* Stage Progress Indicator */}
          {coherenceLoading && coherenceStageProgress && (
            <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border-2 border-blue-400 dark:border-blue-600">
              <div className="flex items-center gap-3 mb-4">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100">Processing Long Document...</h3>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded border border-blue-300 dark:border-blue-700">
                <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-gray-200">
                  {coherenceStageProgress}
                </pre>
              </div>
            </div>
          )}

          {/* Analysis Output - show for coherenceAnalysis OR mathValidityAnalysis (cogency mode) */}
          {coherenceMode === "analyze" && (coherenceAnalysis || mathValidityAnalysis) && (
            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xl font-bold text-indigo-900 dark:text-indigo-100">
                  {coherenceIsScientific ? "Scientific-Explanatory Analysis" : 
                   coherenceIsMathematical ? (mathValidityAnalysis && !coherenceAnalysis ? "Mathematical Cogency Analysis" : "Mathematical Proof Analysis") : "Coherence Analysis"}
                </h3>
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Mathematical dual scores: Coherence + Validity */}
                  {coherenceIsMathematical && coherenceScore !== null && mathValidityScore !== null && (
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Coherence:</span>
                        <Badge className={`px-2 py-1 ${
                          coherenceAssessment === "PASS" ? "bg-blue-600" :
                          coherenceAssessment === "WEAK" ? "bg-blue-400" :
                          "bg-blue-800"
                        }`}>
                          {coherenceScore}/10
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Validity:</span>
                        <Badge className={`px-2 py-1 ${
                          mathValidityVerdict === "VALID" ? "bg-emerald-600" :
                          mathValidityVerdict === "FLAWED" ? "bg-yellow-500" :
                          "bg-red-600"
                        }`}>
                          {mathValidityScore}/10
                        </Badge>
                      </div>
                    </div>
                  )}
                  {/* Cogency-only score display (when no coherence analysis) */}
                  {coherenceIsMathematical && mathValidityScore !== null && coherenceScore === null && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Cogency Score:</span>
                      <Badge className={`text-lg px-3 py-1 ${
                        mathValidityVerdict === "VALID" ? "bg-green-600" :
                        mathValidityVerdict === "FLAWED" ? "bg-yellow-600" :
                        "bg-red-600"
                      }`}>
                        {mathValidityScore}/10 - {mathValidityVerdict}
                      </Badge>
                    </div>
                  )}
                  {/* Coherence-only score display (when no validity analysis) */}
                  {coherenceIsMathematical && coherenceScore !== null && mathValidityScore === null && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Coherence Score:</span>
                      <Badge className={`text-lg px-3 py-1 ${
                        coherenceAssessment === "PASS" ? "bg-green-600" :
                        coherenceAssessment === "WEAK" ? "bg-yellow-600" :
                        "bg-red-600"
                      }`}>
                        {coherenceScore}/10 - {coherenceAssessment}
                      </Badge>
                    </div>
                  )}
                  {coherenceScore !== null && !coherenceIsScientific && !coherenceIsMathematical && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">Score:</span>
                      <Badge className={`text-lg px-3 py-1 ${
                        coherenceAssessment === "PASS" ? "bg-green-600" :
                        coherenceAssessment === "WEAK" ? "bg-yellow-600" :
                        "bg-red-600"
                      }`}>
                        {coherenceScore}/10 - {coherenceAssessment}
                      </Badge>
                      {detectedCoherenceType && (
                        <Badge variant="outline" className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border-purple-400">
                          Auto-Detected: {detectedCoherenceType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Badge>
                      )}
                    </div>
                  )}
                  {coherenceIsScientific && coherenceLogicalScore && coherenceScientificScore && (
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Overall:</span>
                        <Badge className={`px-2 py-1 ${
                          coherenceAssessment === "PASS" ? "bg-green-600" :
                          coherenceAssessment === "WEAK" ? "bg-yellow-600" :
                          "bg-red-600"
                        }`}>
                          {coherenceScore}/10
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Logical:</span>
                        <Badge className={`px-2 py-1 ${
                          coherenceLogicalScore.assessment === "PASS" ? "bg-blue-600" :
                          coherenceLogicalScore.assessment === "WEAK" ? "bg-blue-400" :
                          "bg-blue-800"
                        }`}>
                          {coherenceLogicalScore.score}/10
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Scientific:</span>
                        <Badge className={`px-2 py-1 ${
                          coherenceScientificScore.assessment === "PASS" ? "bg-purple-600" :
                          coherenceScientificScore.assessment === "WEAK" ? "bg-purple-400" :
                          "bg-purple-800"
                        }`}>
                          {coherenceScientificScore.score}/10
                        </Badge>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadText(coherenceAnalysis, `coherence-analysis-${coherenceType}.txt`)}
                      data-testid="button-download-coherence-analysis"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                    <CopyButton text={coherenceAnalysis} />
                    <SendToButton
                      text={coherenceAnalysis}
                      onSendToIntelligence={(text) => {
                        setDocumentA({ ...documentA, content: text });
                        toast({
                          title: "Analysis sent to Intelligence Analysis",
                          description: "Coherence analysis has been sent to the intelligence analysis input"
                        });
                      }}
                      onSendToHumanizer={(text) => {
                        setBoxA(text);
                        toast({
                          title: "Analysis sent to Humanizer",
                          description: "Coherence analysis has been sent to the Humanizer input box"
                        });
                      }}
                      onSendToChat={(text) => {
                        toast({
                          title: "Analysis available to Chat",
                          description: "The coherence analysis is now available as context for AI chat"
                        });
                      }}
                    />
                  </div>
                </div>
              </div>
              {/* Show coherence analysis text only if there is coherence analysis */}
              {coherenceAnalysis && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-indigo-200 dark:border-indigo-700">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 dark:text-gray-200">
                    {coherenceAnalysis}
                  </pre>
                </div>
              )}
              
              {/* Scientific Inaccuracies Section */}
              {coherenceIsScientific && coherenceScientificScore && coherenceScientificScore.inaccuracies.length > 0 && (
                <div className="mt-6 bg-red-50 dark:bg-red-900/20 p-6 rounded-lg border-2 border-red-300 dark:border-red-700">
                  <h4 className="text-lg font-bold text-red-900 dark:text-red-100 mb-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Scientific Inaccuracies Found ({coherenceScientificScore.inaccuracies.length})
                  </h4>
                  <ul className="space-y-2">
                    {coherenceScientificScore.inaccuracies.map((inaccuracy, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-red-800 dark:text-red-200">
                        <span className="font-bold text-red-600 dark:text-red-400">{idx + 1}.</span>
                        <span>{inaccuracy}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Mathematical Proof Veridicality Analysis Section */}
              {coherenceIsMathematical && mathValidityAnalysis && (
                <div className="mt-8 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-xl font-bold text-emerald-900 dark:text-emerald-100">
                      Proof Veridicality Analysis (Is the theorem actually TRUE?)
                    </h3>
                    <div className="flex items-center gap-4 flex-wrap">
                      {mathValidityScore !== null && mathValidityVerdict && (
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Validity Score:</span>
                            <Badge className={`text-lg px-3 py-1 ${
                              mathValidityVerdict === "VALID" ? "bg-green-600" :
                              mathValidityVerdict === "FLAWED" ? "bg-yellow-600" :
                              "bg-red-600"
                            }`}>
                              {mathValidityScore}/10 - {mathValidityVerdict}
                            </Badge>
                          </div>
                        </div>
                      )}
                      {/* Copy All Cogency Results Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const fullOutput = [
                            `MATHEMATICAL COGENCY ANALYSIS`,
                            `=============================`,
                            ``,
                            `COGENCY SCORE: ${mathValidityScore}/10 - ${mathValidityVerdict}`,
                            ``,
                            mathValiditySubscores ? `SUBSCORES:` : '',
                            mathValiditySubscores ? `- Claim Truth: ${mathValiditySubscores.claimTruth}/10` : '',
                            mathValiditySubscores ? `- Inference Validity: ${mathValiditySubscores.inferenceValidity}/10` : '',
                            mathValiditySubscores ? `- Boundary Conditions: ${mathValiditySubscores.boundaryConditions}/10` : '',
                            mathValiditySubscores ? `- Overall Soundness: ${mathValiditySubscores.overallSoundness}/10` : '',
                            ``,
                            mathValidityCounterexamples.length > 0 ? `COUNTEREXAMPLES FOUND (${mathValidityCounterexamples.length}):` : '',
                            ...mathValidityCounterexamples.map((ce, idx) => `${idx + 1}. ${ce}`),
                            ``,
                            mathValidityFlaws.length > 0 ? `MATHEMATICAL FLAWS IDENTIFIED (${mathValidityFlaws.length}):` : '',
                            ...mathValidityFlaws.map((flaw, idx) => `${idx + 1}. ${flaw}`),
                            ``,
                            `DETAILED ANALYSIS:`,
                            `------------------`,
                            mathValidityAnalysis
                          ].filter(line => line !== '').join('\n');
                          
                          navigator.clipboard.writeText(fullOutput);
                          toast({
                            title: "Copied!",
                            description: "Full cogency analysis copied to clipboard"
                          });
                        }}
                        className="bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-800/50 border-emerald-300"
                        data-testid="button-copy-all-cogency"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy All Results
                      </Button>
                    </div>
                  </div>
                  
                  {/* Validity Subscores */}
                  {mathValiditySubscores && (
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg border border-emerald-200 dark:border-emerald-700">
                      <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-3">Veridicality Subscores:</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs text-muted-foreground">Claim Truth</span>
                          <Badge className={`${
                            mathValiditySubscores.claimTruth >= 7 ? "bg-green-500" :
                            mathValiditySubscores.claimTruth >= 4 ? "bg-yellow-500" :
                            "bg-red-500"
                          }`}>
                            {mathValiditySubscores.claimTruth}/10
                          </Badge>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs text-muted-foreground">Inference Validity</span>
                          <Badge className={`${
                            mathValiditySubscores.inferenceValidity >= 7 ? "bg-green-500" :
                            mathValiditySubscores.inferenceValidity >= 4 ? "bg-yellow-500" :
                            "bg-red-500"
                          }`}>
                            {mathValiditySubscores.inferenceValidity}/10
                          </Badge>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs text-muted-foreground">Boundary Conditions</span>
                          <Badge className={`${
                            mathValiditySubscores.boundaryConditions >= 7 ? "bg-green-500" :
                            mathValiditySubscores.boundaryConditions >= 4 ? "bg-yellow-500" :
                            "bg-red-500"
                          }`}>
                            {mathValiditySubscores.boundaryConditions}/10
                          </Badge>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs text-muted-foreground">Overall Soundness</span>
                          <Badge className={`${
                            mathValiditySubscores.overallSoundness >= 7 ? "bg-green-500" :
                            mathValiditySubscores.overallSoundness >= 4 ? "bg-yellow-500" :
                            "bg-red-500"
                          }`}>
                            {mathValiditySubscores.overallSoundness}/10
                          </Badge>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Counterexamples Found */}
                  {mathValidityCounterexamples.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border-2 border-red-300 dark:border-red-700">
                      <h4 className="text-md font-bold text-red-900 dark:text-red-100 mb-3 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        Counterexamples Found ({mathValidityCounterexamples.length})
                      </h4>
                      <ul className="space-y-2">
                        {mathValidityCounterexamples.map((ce, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-red-800 dark:text-red-200">
                            <span className="font-bold text-red-600 dark:text-red-400">{idx + 1}.</span>
                            <span>{ce}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Mathematical Flaws */}
                  {mathValidityFlaws.length > 0 && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border-2 border-orange-300 dark:border-orange-700">
                      <h4 className="text-md font-bold text-orange-900 dark:text-orange-100 mb-3 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        Mathematical Flaws Identified ({mathValidityFlaws.length})
                      </h4>
                      <ul className="space-y-2">
                        {mathValidityFlaws.map((flaw, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-orange-800 dark:text-orange-200">
                            <span className="font-bold text-orange-600 dark:text-orange-400">{idx + 1}.</span>
                            <span>{flaw}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Full Validity Analysis */}
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-emerald-200 dark:border-emerald-700">
                    <h4 className="text-md font-bold text-emerald-900 dark:text-emerald-100 mb-3">Detailed Veridicality Analysis:</h4>
                    <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 dark:text-gray-200 max-h-96 overflow-y-auto">
                      {mathValidityAnalysis}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rewrite Output */}
          {coherenceMode === "rewrite" && coherenceRewrite && (
            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-xl font-bold text-indigo-900 dark:text-indigo-100">
                    {coherenceIsScientific ? "Scientifically Corrected Version" : "Rewritten Version"}
                  </h3>
                  {coherenceRewriteAccuracyScore !== null && (
                    <Badge 
                      className={`text-sm ${
                        coherenceRewriteAccuracyScore >= 8 ? 'bg-green-500 hover:bg-green-600' :
                        coherenceRewriteAccuracyScore >= 5 ? 'bg-yellow-500 hover:bg-yellow-600' :
                        'bg-red-500 hover:bg-red-600'
                      } text-white`}
                    >
                      Scientific Accuracy: {coherenceRewriteAccuracyScore}/10
                    </Badge>
                  )}
                  {detectedCoherenceType && (
                    <Badge variant="outline" className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border-purple-400">
                      Auto-Detected: {detectedCoherenceType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadText(coherenceRewrite, `coherence-rewrite-${coherenceType}.txt`)}
                    data-testid="button-download-coherence-rewrite"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  <CopyButton text={coherenceRewrite} />
                  <SendToButton
                    text={coherenceRewrite}
                    onSendToIntelligence={(text) => {
                      setDocumentA({ ...documentA, content: text });
                      toast({
                        title: "Text sent to Intelligence Analysis",
                        description: "Rewritten text has been sent to the intelligence analysis input"
                      });
                    }}
                    onSendToHumanizer={(text) => {
                      setBoxA(text);
                      toast({
                        title: "Text sent to Humanizer",
                        description: "Rewritten text has been sent to the Humanizer input box"
                      });
                    }}
                    onSendToChat={(text) => {
                      toast({
                        title: "Text available to Chat",
                        description: "The rewritten text is now available as context for AI chat"
                      });
                    }}
                  />
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-indigo-200 dark:border-indigo-700 max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 dark:text-gray-200">
                  {coherenceRewrite}
                </pre>
              </div>

              {/* Scientific Corrections Applied */}
              {coherenceIsScientific && coherenceCorrectionsApplied.length > 0 && (
                <div className="mt-6 bg-green-50 dark:bg-green-900/20 p-6 rounded-lg border-2 border-green-300 dark:border-green-700">
                  <h4 className="text-lg font-bold text-green-900 dark:text-green-100 mb-4 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Scientific Corrections Applied ({coherenceCorrectionsApplied.length})
                  </h4>
                  <ul className="space-y-2">
                    {coherenceCorrectionsApplied.map((correction, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-green-800 dark:text-green-200">
                        <span className="font-bold text-green-600 dark:text-green-400">{idx + 1}.</span>
                        <span>{correction}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Changes Made */}
              {coherenceChanges && (
                <div className="mt-6">
                  <h4 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 mb-3">
                    {coherenceIsScientific ? "Scientific Accuracy Changes" : "Changes Made"}
                  </h4>
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-lg border border-indigo-200 dark:border-indigo-700">
                    <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 dark:text-gray-200">
                      {coherenceChanges}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Math Proof Correction Output */}
          {mathProofIsCorrected && mathProofCorrectedProof && (
            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-xl font-bold text-emerald-900 dark:text-emerald-100">
                    Corrected Mathematical Proof
                  </h3>
                  <Badge 
                    className={`text-sm ${
                      mathProofTheoremStatus === "TRUE" ? 'bg-green-500 hover:bg-green-600' :
                      mathProofTheoremStatus === "PARTIALLY_TRUE" ? 'bg-yellow-500 hover:bg-yellow-600' :
                      'bg-orange-500 hover:bg-orange-600'
                    } text-white`}
                  >
                    Theorem: {mathProofTheoremStatus === "TRUE" ? "TRUE" : 
                              mathProofTheoremStatus === "PARTIALLY_TRUE" ? "PARTIALLY TRUE" : 
                              "FALSE (Corrected)"}
                  </Badge>
                  {mathProofValidityScore !== null && (
                    <Badge 
                      className={`text-sm ${
                        mathProofValidityScore >= 8 ? 'bg-green-500 hover:bg-green-600' :
                        mathProofValidityScore >= 5 ? 'bg-yellow-500 hover:bg-yellow-600' :
                        'bg-red-500 hover:bg-red-600'
                      } text-white`}
                    >
                      Proof Validity: {mathProofValidityScore}/10
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadText(mathProofCorrectedProof, `corrected-math-proof.txt`)}
                    data-testid="button-download-math-proof"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  <CopyButton text={mathProofCorrectedProof} />
                </div>
              </div>

              {/* Original Theorem */}
              {mathProofOriginalTheorem && (
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Original Theorem:</h4>
                  <p className="text-sm text-gray-800 dark:text-gray-200 font-mono">{mathProofOriginalTheorem}</p>
                </div>
              )}

              {/* Corrected Theorem (if theorem was false) */}
              {mathProofCorrectedTheorem && (
                <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border-2 border-orange-300 dark:border-orange-700">
                  <h4 className="text-sm font-semibold text-orange-700 dark:text-orange-300 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Corrected Theorem (Original was FALSE):
                  </h4>
                  <p className="text-sm text-orange-800 dark:text-orange-200 font-mono">{mathProofCorrectedTheorem}</p>
                </div>
              )}

              {/* Proof Strategy */}
              {mathProofStrategy && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                  <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2">Proof Strategy:</h4>
                  <p className="text-sm text-blue-800 dark:text-blue-200">{mathProofStrategy}</p>
                </div>
              )}

              {/* The Corrected Proof */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border-2 border-emerald-300 dark:border-emerald-700">
                <h4 className="text-lg font-bold text-emerald-900 dark:text-emerald-100 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  Rigorous Proof
                </h4>
                <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-gray-200 overflow-x-auto">
                  {mathProofCorrectedProof}
                </pre>
              </div>

              {/* Key Corrections */}
              {mathProofKeyCorrections.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-lg border-2 border-amber-300 dark:border-amber-700">
                  <h4 className="text-lg font-bold text-amber-900 dark:text-amber-100 mb-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Key Corrections Made ({mathProofKeyCorrections.length})
                  </h4>
                  <ul className="space-y-2">
                    {mathProofKeyCorrections.map((correction, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
                        <span className="font-bold text-amber-600 dark:text-amber-400">{idx + 1}.</span>
                        <span>{correction}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Loading State */}
          {coherenceLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                {coherenceMode === "analyze" ? "Analyzing text coherence..." : "Rewriting text for maximum coherence..."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* GPT BYPASS HUMANIZER - Following Exact Protocol - HIDDEN BY USER REQUEST */}
      <div className="hidden mt-16 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10 p-8 rounded-lg border-2 border-blue-200 dark:border-blue-700">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-blue-900 dark:text-blue-100 mb-3 flex items-center justify-center gap-3">
              <Shield className="w-8 h-8 text-blue-600" />
              GPT Bypass Humanizer
            </h2>
            <p className="text-lg text-gray-700 dark:text-gray-300 mb-2">
              Transform AI text into undetectable human writing with surgical precision
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Box A: AI Text → Box B: Human Style Sample → Box C: Humanized Output
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-4">
            {/* Left Column - Writing Samples & Style Presets */}
            <div className="lg:col-span-1 space-y-6">
              {/* Writing Samples Dropdown */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-blue-800 dark:text-blue-200">
                  Writing Samples
                </label>
                <Select value={selectedWritingSample} onValueChange={(value) => {
                  setSelectedWritingSample(value);
                  const [category, sample] = value.split('|');
                  if (writingSamples[category] && writingSamples[category][sample]) {
                    setBoxB(writingSamples[category][sample]);
                  }
                }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose writing sample...">
                      {selectedWritingSample ? selectedWritingSample.split('|')[1] : "Choose writing sample..."}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {Object.entries(writingSamples).map(([category, samples]) => (
                      <div key={category}>
                        <div className="px-2 py-1 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase bg-gray-100 dark:bg-gray-800">
                          {category.replace(/([A-Z])/g, ' $1').trim()}
                        </div>
                        {Object.keys(samples as object).map((sampleName) => (
                          <SelectItem key={`${category}|${sampleName}`} value={`${category}|${sampleName}`}>
                            {sampleName}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Style Presets */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-blue-800 dark:text-blue-200">
                  Style Presets
                </label>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-blue-200 dark:border-blue-700 max-h-96 overflow-y-auto">
                  {/* Most Important (1-8) */}
                  <div className="mb-4">
                    <h4 className="text-xs font-bold text-green-700 dark:text-green-300 mb-2 uppercase bg-green-50 dark:bg-green-900/20 p-2 rounded">
                      ⭐ Most Important for Humanizing (1-8)
                    </h4>
                    <div className="space-y-2">
                      {[
                        "Mixed cadence + clause sprawl",
                        "Asymmetric emphasis", 
                        "One aside",
                        "Hedge twice",
                        "Local disfluency",
                        "Analogy injection",
                        "Topic snap",
                        "Friction detail"
                      ].map((preset) => (
                        <label key={preset} className="flex items-start gap-2 text-xs cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/10 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={selectedStylePresets.includes(preset)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStylePresets([...selectedStylePresets, preset]);
                              } else {
                                setSelectedStylePresets(selectedStylePresets.filter(p => p !== preset));
                              }
                            }}
                            className="mt-0.5"
                          />
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100">{preset}</div>
                            <div className="text-gray-600 dark:text-gray-400">{stylePresets[preset]}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Other Style Techniques */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase">Additional Techniques</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {Object.entries(stylePresets).filter(([preset]) => ![
                        "Mixed cadence + clause sprawl",
                        "Asymmetric emphasis", 
                        "One aside",
                        "Hedge twice",
                        "Local disfluency",
                        "Analogy injection",
                        "Topic snap",
                        "Friction detail"
                      ].includes(preset)).map(([preset, description]) => (
                        <label key={preset} className="flex items-start gap-2 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={selectedStylePresets.includes(preset)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStylePresets([...selectedStylePresets, preset]);
                              } else {
                                setSelectedStylePresets(selectedStylePresets.filter(p => p !== preset));
                              }
                            }}
                            className="mt-0.5"
                          />
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100">{preset}</div>
                            <div className="text-gray-600 dark:text-gray-400">{String(description)}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* LLM Provider Selection */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-blue-800 dark:text-blue-200">
                  AI Provider
                </label>
                <Select value={humanizerProvider} onValueChange={(value) => setHumanizerProvider(value as LLMProvider)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zhi2">ZHI 2 - Default</SelectItem>
                    <SelectItem value="zhi1">ZHI 1</SelectItem>
                    <SelectItem value="zhi3">ZHI 3</SelectItem>
                    <SelectItem value="zhi4">ZHI 4</SelectItem>
                    <SelectItem value="zhi5">ZHI 5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Center & Right Columns - Main Boxes */}
            <div className="lg:col-span-3 space-y-6">
              {/* Top Row - Box A and Box B */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Box A - AI Text Input */}
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-blue-800 dark:text-blue-200">
                    Box A - AI-Generated Text to Humanize
                    {boxAScore !== null && (
                      <span className={`ml-2 px-3 py-1 text-sm rounded font-bold ${
                        boxAScore >= 70 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                        boxAScore >= 50 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : 
                        'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {boxAScore}% HUMAN
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <Textarea
                      value={boxA}
                      onChange={(e) => {
                        setBoxA(e.target.value);
                        if (e.target.value.length > 100) {
                          debounce(() => evaluateTextAI(e.target.value, setBoxAScore), 2000)();
                        }
                      }}
                      placeholder="Paste or upload AI-generated text here that needs to be humanized..."
                      className="min-h-[300px] border-blue-200 dark:border-blue-700 focus:border-blue-500 dark:focus:border-blue-400 pr-12"
                      data-testid="textarea-box-a"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 hover:bg-blue-100 dark:hover:bg-blue-800"
                      onClick={() => {
                        document.getElementById('file-upload-a')?.click();
                      }}
                      data-testid="button-upload-box-a"
                    >
                      <Upload className="w-4 h-4" />
                    </Button>
                    <input
                      id="file-upload-a"
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, setBoxA);
                      }}
                    />
                  </div>
                  
                  {/* Chunk Text Button for Large Documents */}
                  {boxA.length > 3000 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleChunkText(boxA)}
                      className="text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                      data-testid="button-chunk-box-a"
                    >
                      <FileText className="w-3 h-3 mr-1" />
                      Chunk Large Text (500 words)
                    </Button>
                  )}
                </div>

                {/* Box B - Human Style Sample */}
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-blue-800 dark:text-blue-200">
                    Box B - Human Writing Style Sample
                    {boxBScore !== null && (
                      <span className={`ml-2 px-3 py-1 text-sm rounded font-bold ${
                        boxBScore >= 70 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                        boxBScore >= 50 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : 
                        'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {boxBScore}% HUMAN
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <Textarea
                      value={boxB}
                      onChange={(e) => {
                        setBoxB(e.target.value);
                        if (e.target.value.length > 100) {
                          debounce(() => evaluateTextAI(e.target.value, setBoxBScore), 2000)();
                        }
                      }}
                      placeholder="Paste or upload human-written text whose style you want to mimic..."
                      className="min-h-[300px] border-blue-200 dark:border-blue-700 focus:border-blue-500 dark:focus:border-blue-400 pr-12"
                      data-testid="textarea-box-b"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 hover:bg-blue-100 dark:hover:bg-blue-800"
                      onClick={() => {
                        document.getElementById('file-upload-b')?.click();
                      }}
                      data-testid="button-upload-box-b"
                    >
                      <Upload className="w-4 h-4" />
                    </Button>
                    <input
                      id="file-upload-b"
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, setBoxB);
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Custom Instructions Box - Under Box A */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-blue-800 dark:text-blue-200">
                  Custom Instructions (Optional)
                </label>
                <Textarea
                  value={humanizerCustomInstructions}
                  onChange={(e) => setHumanizerCustomInstructions(e.target.value)}
                  placeholder="Enter specific instructions for the rewrite (e.g., 'maintain technical terminology', 'use more casual tone', 'preserve all statistics')..."
                  className="min-h-[120px] border-blue-200 dark:border-blue-700 focus:border-blue-500 dark:focus:border-blue-400"
                  rows={4}
                  data-testid="textarea-custom-instructions"
                />
              </div>

              {/* Action Button */}
              <div className="flex justify-center">
                <Button
                  onClick={handleHumanize}
                  disabled={isHumanizerLoading || !boxA.trim() || !boxB.trim()}
                  className="px-12 py-4 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 text-lg font-semibold"
                  data-testid="button-humanize"
                >
                  {isHumanizerLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                      Humanizing with Surgical Precision...
                    </>
                  ) : (
                    <>
                      <Shield className="w-5 h-5 mr-3" />
                      Humanize Text
                    </>
                  )}
                </Button>
              </div>

              {/* Box C - Large Output */}
              {boxC && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="block text-sm font-semibold text-blue-800 dark:text-blue-200">
                      Box C - Humanized Output
                      {boxCScore !== null && (
                        <span className={`ml-2 px-3 py-1 text-sm rounded font-bold ${
                          boxCScore >= 70 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                          boxCScore >= 50 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : 
                          'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {boxCScore}% HUMAN
                        </span>
                      )}
                    </label>
                    <div className="flex gap-2">
                      <CopyButton text={boxC} />
                      <SendToButton 
                        text={boxC}
                        onSendToIntelligence={handleSendToIntelligence}
                        onSendToChat={handleSendToChat}
                      />
                    </div>
                  </div>
                  <Textarea
                    value={boxC}
                    onChange={(e) => setBoxC(e.target.value)}
                    className="min-h-[500px] border-green-200 dark:border-green-700 focus:border-green-500 dark:focus:border-green-400 bg-green-50/50 dark:bg-green-900/10"
                    data-testid="textarea-box-c"
                    readOnly
                  />
                  
                  {/* Re-rewrite Function & Download Options - Under Box C */}
                  <div className="flex flex-wrap gap-3 justify-between items-center bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <div className="flex gap-3">
                      <Button
                        onClick={handleReRewrite}
                        disabled={isReRewriteLoading || !boxC.trim()}
                        variant="outline"
                        className="border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-600 dark:text-orange-300"
                        data-testid="button-re-rewrite"
                      >
                        {isReRewriteLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Re-rewriting...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Re-rewrite (Recursive)
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => {
                          setBoxA("");
                          setBoxB("");
                          setBoxC("");
                          setBoxAScore(null);
                          setBoxBScore(null);
                          setBoxCScore(null);
                          setHumanizerCustomInstructions("");
                          setSelectedStylePresets([]);
                        }}
                        variant="outline"
                        className="border-gray-300 text-gray-700 hover:bg-gray-50"
                        data-testid="button-clear-all"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Clear All
                      </Button>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        onClick={() => downloadHumanizerResult('txt')}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        data-testid="button-download-txt"
                      >
                        <Download className="w-3 h-3 mr-1" />
                        TXT
                      </Button>
                      <Button
                        onClick={() => downloadHumanizerResult('pdf')}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        data-testid="button-download-pdf"
                      >
                        <Download className="w-3 h-3 mr-1" />
                        PDF
                      </Button>
                      <Button
                        onClick={() => downloadHumanizerResult('docx')}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        data-testid="button-download-docx"
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Word
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chat Dialog - Always visible below everything */}
      <ChatDialog 
        currentDocument={documentA.content}
        analysisResults={mode === "single" ? analysisA : comparison}
        onSendToInput={(content: string) => {
          setDocumentA({ ...documentA, content: content });
        }}
        onSendToHumanizer={handleSendToHumanizer}
        onSendToIntelligence={handleSendToIntelligence}
        onSendToChat={handleSendToChat}
        onSendToValidator={(text: string) => setValidatorInputText(text)}
      />

      {/* Fiction Assessment Popup */}
      <FictionAssessmentPopup 
        isOpen={fictionPopupOpen}
        onClose={() => setFictionPopupOpen(false)}
      />
    </div>
  );
};

export default HomePage;
