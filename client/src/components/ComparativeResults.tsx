import React, { useState } from "react";
import { DocumentAnalysis, DocumentComparison } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import ShareViaEmailModal from "./ShareViaEmailModal";
import ReportDownloadButton from "./ReportDownloadButton";
import IntelligentRewriteButton from "./IntelligentRewriteButton";

interface ComparativeResultsProps {
  analysisA: DocumentAnalysis;
  analysisB: DocumentAnalysis;
  comparison: DocumentComparison;
  documentAText?: string;
  documentBText?: string;
  onSendToHumanizer?: (text: string) => void;
  onSendToIntelligence?: (text: string) => void;
  onSendToChat?: (text: string) => void;
}

const ComparativeResults: React.FC<ComparativeResultsProps> = ({
  analysisA,
  analysisB,
  comparison,
  documentAText,
  documentBText,
  onSendToHumanizer,
  onSendToIntelligence,
  onSendToChat,
}) => {
  const [showShareModal, setShowShareModal] = useState(false);
  
  // Helper function to get badge variant
  const getBadgeVariant = (rating: string) => {
    switch (rating) {
      case "Strong":
        return "strong";
      case "Moderate":
        return "moderate";
      case "Weak":
        return "weak";
      default:
        return "default";
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Comparative Analysis</h2>
        <div className="flex flex-wrap gap-2">
          {documentAText && (
            <IntelligentRewriteButton
              originalText={documentAText}
              originalAnalysis={analysisA}
              className="text-xs"
              onSendToHumanizer={onSendToHumanizer}
              onSendToIntelligence={onSendToIntelligence}
              onSendToChat={onSendToChat}
            />
          )}
          {documentBText && (
            <IntelligentRewriteButton
              originalText={documentBText}
              originalAnalysis={analysisB}
              className="text-xs"
              onSendToHumanizer={onSendToHumanizer}
              onSendToIntelligence={onSendToIntelligence}
              onSendToChat={onSendToChat}
            />
          )}
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
            analysisA={analysisA}
            analysisB={analysisB}
            comparison={comparison}
            mode="compare"
          />
        </div>
      </div>
      
      {/* Intelligence Comparison */}
      <div className="mb-6">
        <h3 className="font-semibold text-gray-800 mb-3">Intelligence Level Comparison</h3>
        <div className="flex flex-col md:flex-row gap-6 mb-4">
          <div className="flex-1 bg-blue-50 p-4 rounded-md">
            <h4 className="font-medium text-gray-800 mb-2">Document A</h4>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1">
                <div className="h-2 w-full bg-gray-200 rounded-full">
                  <div 
                    className="h-2 bg-blue-600 rounded-full" 
                    style={{ width: `${analysisA.overallScore}%` }}
                  ></div>
                </div>
              </div>
              <span className="font-semibold text-blue-800">{analysisA.overallScore}/100</span>
            </div>
          </div>
          <div className="flex-1 bg-blue-50 p-4 rounded-md">
            <h4 className="font-medium text-gray-800 mb-2">Document B</h4>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1">
                <div className="h-2 w-full bg-gray-200 rounded-full">
                  <div 
                    className="h-2 bg-blue-600 rounded-full" 
                    style={{ width: `${analysisB.overallScore}%` }}
                  ></div>
                </div>
              </div>
              <span className="font-semibold text-blue-800">{analysisB.overallScore}/100</span>
            </div>
          </div>
        </div>
        <p className="text-gray-700">{comparison.finalJudgment}</p>
      </div>

      {/* Strengths and Weaknesses Table */}
      <div className="mb-6">
        <h3 className="font-semibold text-gray-800 mb-3">Strengths and Weaknesses</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 rounded-md">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-2 text-left text-gray-800 border-b">Dimension</th>
                <th className="px-4 py-2 text-left text-gray-800 border-b">Document A</th>
                <th className="px-4 py-2 text-left text-gray-800 border-b">Document B</th>
              </tr>
            </thead>
            <tbody>
              {comparison?.comparisonTable && Array.isArray(comparison.comparisonTable) ? 
                comparison.comparisonTable.map((row, index) => (
                  <tr key={index} className="border-b border-gray-200">
                    <td className="px-4 py-3 font-medium">{row.dimension}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={getBadgeVariant(row.documentA) as any}
                        className="px-2 py-1 text-xs rounded-full"
                      >
                        {row.documentA}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={getBadgeVariant(row.documentB) as any}
                        className="px-2 py-1 text-xs rounded-full"
                      >
                        {row.documentB}
                      </Badge>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-center text-gray-500">
                      Comparison data not available
                    </td>
                  </tr>
                )
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Style and Structure Comparison */}
      <div className="mb-6">
        <h3 className="font-semibold text-gray-800 mb-3">Style and Structure</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 p-4 rounded-md">
            <h4 className="font-medium text-gray-800 mb-2">Document A</h4>
            <ul className="list-disc list-inside text-gray-700 space-y-1">
              {comparison?.documentA?.style && Array.isArray(comparison.documentA.style) ? 
                comparison.documentA.style.map((item, index) => (
                  <li key={index}>{item}</li>
                )) : (
                  <li className="text-gray-500">Style analysis not available</li>
                )
              }
            </ul>
          </div>
          <div className="bg-gray-50 p-4 rounded-md">
            <h4 className="font-medium text-gray-800 mb-2">Document B</h4>
            <ul className="list-disc list-inside text-gray-700 space-y-1">
              {comparison?.documentB?.style && Array.isArray(comparison.documentB.style) ? 
                comparison.documentB.style.map((item, index) => (
                  <li key={index}>{item}</li>
                )) : (
                  <li className="text-gray-500">Style analysis not available</li>
                )
              }
            </ul>
          </div>
        </div>
      </div>

      {/* Detailed Analysis Reports */}
      <div className="mb-6">
        <h3 className="font-semibold text-gray-800 mb-3">Detailed Analysis Reports</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-50 p-4 rounded-md">
            <h4 className="font-medium text-gray-800 mb-3">Document A Analysis</h4>
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-gray-700 text-sm">
                {analysisA.formattedReport || analysisA.analysis || "Analysis not available"}
              </div>
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-md">
            <h4 className="font-medium text-gray-800 mb-3">Document B Analysis</h4>
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-gray-700 text-sm">
                {analysisB.formattedReport || analysisB.analysis || "Analysis not available"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Final Judgment */}
      <div className="bg-blue-50 p-4 rounded-md">
        <h3 className="font-semibold text-gray-800 mb-2">Final Assessment</h3>
        <div className="text-gray-700">
          <p className="mb-2"><strong>Comprehensive evaluation of cognitive architecture and intelligence type</strong></p>
          <div className="whitespace-pre-wrap">
            {comparison.finalJudgment}
          </div>
        </div>
      </div>
      
      {/* Share via Email Modal */}
      <ShareViaEmailModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        analysisA={analysisA}
        analysisB={analysisB}
        comparison={comparison}
      />
    </div>
  );
};

export default ComparativeResults;
