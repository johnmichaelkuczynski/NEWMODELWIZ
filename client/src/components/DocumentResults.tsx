import React, { useState } from "react";
import { DocumentAnalysis, DocumentInput as DocumentInputType } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Bot, Share2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import ShareViaEmailModal from "./ShareViaEmailModal";
import AIDetectionModal from "./AIDetectionModal";
import ReportDownloadButton from "./ReportDownloadButton";
import PhilosophicalIntelligenceReport from "./PhilosophicalIntelligenceReport";
import { checkForAI } from "@/lib/analysis";
import { useToast } from "@/hooks/use-toast";
import IntelligentRewriteButton from "./IntelligentRewriteButton";

interface DocumentResultsProps {
  id: "A" | "B";
  analysis: DocumentAnalysis;
  originalDocument?: DocumentInputType;
  analysisMode?: "quick" | "comprehensive";
  onSendToHumanizer?: (text: string) => void;
  onSendToIntelligence?: (text: string) => void;
  onSendToChat?: (text: string) => void;
}

const DocumentResults: React.FC<DocumentResultsProps> = ({ 
  id, 
  analysis, 
  originalDocument,
  analysisMode = "comprehensive",
  onSendToHumanizer,
  onSendToIntelligence,
  onSendToChat
}) => {
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAIDetectionModal, setShowAIDetectionModal] = useState(false);
  const [isCheckingAI, setIsCheckingAI] = useState(false);
  const [aiDetectionResult, setAIDetectionResult] = useState<any>(null);
  const { toast } = useToast();

  // Function to check if the analysis result contains an error
  function isErrorAnalysis(analysis: any): boolean {
    if (typeof analysis?.formattedReport === 'string' && 
       (analysis.formattedReport.includes('<!DOCTYPE html>') || 
        analysis.formattedReport.includes('<html') ||
        analysis.formattedReport.includes('Error:') ||
        analysis.error === true)) {
      return true;
    }
    return false;
  }

  // Function to check if text is AI-generated
  const handleCheckAI = async () => {
    if (!originalDocument?.content) {
      toast({
        title: "Missing input",
        description: "Document content not found. Please try again.",
        variant: "destructive"
      });
      return;
    }
    
    setIsCheckingAI(true);
    setShowAIDetectionModal(true);
    
    try {
      const result = await checkForAI(originalDocument);
      setAIDetectionResult(result);
      console.log("AI detection result:", result);
    } catch (error) {
      console.error("Error checking for AI:", error);
      toast({
        title: "AI detection failed",
        description: "An error occurred while checking for AI content.",
        variant: "destructive"
      });
    } finally {
      setIsCheckingAI(false);
    }
  };

  // Don't render if this is an error analysis
  if (isErrorAnalysis(analysis)) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
        <div className="flex items-center">
          <div className="text-red-600 mr-3">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-red-800 mb-2">Analysis Error</h3>
            <p className="text-red-700">
              There was an error analyzing this document. This could be due to format issues, 
              content that's too short, or temporary API problems. Please try uploading a 
              different document or try again later.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-8 mb-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-200 dark:to-slate-400 bg-clip-text text-transparent">Document {id} Analysis</h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm">{analysisMode === "quick" ? "Phase 1 Assessment" : "Comprehensive Evaluation"}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {originalDocument?.content && (
            <IntelligentRewriteButton
              originalText={originalDocument.content}
              originalAnalysis={analysis}
              onSendToHumanizer={onSendToHumanizer}
              onSendToIntelligence={onSendToIntelligence}
              onSendToChat={onSendToChat}
            />
          )}
          <Button
            size="sm"
            variant="outline"
            className="flex items-center gap-2 bg-amber-100 text-amber-800 hover:bg-amber-200"
            onClick={handleCheckAI}
            disabled={!originalDocument?.content}
          >
            <ShieldAlert className="h-4 w-4" />
            Check AI
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={() => setShowShareModal(true)}
          >
            <Share2 className="h-4 w-4" />
            Share via Email
          </Button>
          <ReportDownloadButton
            analysisA={analysis}
            mode="single"
          />
        </div>
      </div>
      
      {/* Enhanced Intelligence Report Display */}
      <div className="mb-8">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm overflow-hidden">
          <PhilosophicalIntelligenceReport 
            analysis={analysis} 
            analysisMode={analysisMode}
          />
        </div>
      </div>

      {/* AI Detection Result (if available) */}
      {analysis.aiDetection && (
        <div className="bg-amber-50 p-4 rounded-md mb-4">
          <div className="flex items-start">
            <div className="mr-3 text-amber-600">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-1">AI Detection Result</h3>
              <p className="text-gray-700">
                This document has a <span className="font-semibold">{analysis.aiDetection.probability}% probability</span> of being AI-generated. It was analyzed using GPTZero detection tools.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Share via Email Modal */}
      <ShareViaEmailModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        analysisA={analysis}
        rewrittenAnalysis={undefined}
      />
      
      
      {/* AI Detection Modal */}
      <AIDetectionModal
        isOpen={showAIDetectionModal}
        onClose={() => setShowAIDetectionModal(false)}
        result={aiDetectionResult}
        isLoading={isCheckingAI}
      />
    </div>
  );
};

export default DocumentResults;