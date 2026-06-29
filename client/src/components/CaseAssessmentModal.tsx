import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Download, Mail, X, FileText } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import jsPDF from 'jspdf';
import { cleanAIResponse } from "@/lib/textUtils";

// Provider name mapping - ZHI branding only, never expose actual LLM names
const getProviderDisplayName = (provider: string): string => {
  const providerMap: { [key: string]: string } = {
    'openai': 'ZHI 1',
    'anthropic': 'ZHI 2', 
    'deepseek': 'ZHI 3',
    'perplexity': 'ZHI 4',
    'grok': 'ZHI 5',
    'zhi1': 'ZHI 1',
    'zhi2': 'ZHI 2',
    'zhi3': 'ZHI 3',
    'zhi4': 'ZHI 4',
    'zhi5': 'ZHI 5'
  };
  return providerMap[provider.toLowerCase()] || 'ZHI';
};

interface CaseAssessmentResult {
  proofEffectiveness: number;
  claimCredibility: number;
  nonTriviality: number;
  proofQuality: number;
  functionalWriting: number;
  overallCaseScore: number;
  detailedAssessment: string;
}

interface CaseAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: CaseAssessmentResult | null;
  provider: string;
  documentTitle?: string;
}

export default function CaseAssessmentModal({ 
  isOpen, 
  onClose, 
  result, 
  provider, 
  documentTitle 
}: CaseAssessmentModalProps) {
  if (!result) return null;

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-100 text-green-800";
    if (score >= 60) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const dimensions = [
    { label: "Proof Effectiveness", score: result.proofEffectiveness, description: "How effectively the paper proves what it sets out to prove" },
    { label: "Claim Credibility", score: result.claimCredibility, description: "Whether claims are credible and worth proving" },
    { label: "Non-Triviality", score: result.nonTriviality, description: "Significance and importance of the conclusions" },
    { label: "Proof Quality", score: result.proofQuality, description: "Logical rigor, evidence quality, reasoning structure" },
    { label: "Functional Writing", score: result.functionalWriting, description: "Clarity, organization, and accessibility" },
  ];

  const handleDownload = (format: 'txt' | 'pdf') => {
    const content = `
CASE ASSESSMENT REPORT
Document: ${documentTitle || 'Untitled Document'}
Provider: ${provider}
Generated: ${new Date().toLocaleString()}

OVERALL CASE SCORE: ${result.overallCaseScore}/100

DIMENSION BREAKDOWN:
${dimensions.map(d => `${d.label}: ${d.score}/100 - ${d.description}`).join('\n')}

DETAILED ASSESSMENT:
${result.detailedAssessment}
    `.trim();

    if (format === 'pdf') {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 15;
      let yPosition = 20;

      // Helper function to manage page breaks
      const ensureSpaceForContent = (neededSpace: number) => {
        if (yPosition + neededSpace > 280) {
          pdf.addPage();
          yPosition = 20;
        }
      };

      // Title
      pdf.setFontSize(18);
      pdf.text("CASE ASSESSMENT REPORT", pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Document info
      pdf.setFontSize(12);
      pdf.text(`Document: ${documentTitle || 'Untitled Document'}`, margin, yPosition);
      yPosition += 7;
      pdf.text(`Provider: ${provider}`, margin, yPosition);
      yPosition += 7;
      pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, yPosition);
      yPosition += 15;

      // Overall score
      pdf.setFontSize(16);
      pdf.text(`OVERALL CASE SCORE: ${result.overallCaseScore}/100`, margin, yPosition);
      yPosition += 15;

      // Dimension breakdown
      pdf.setFontSize(14);
      pdf.text("DIMENSION BREAKDOWN:", margin, yPosition);
      yPosition += 10;

      pdf.setFontSize(11);
      dimensions.forEach(d => {
        ensureSpaceForContent(7);
        pdf.text(`${d.label}: ${d.score}/100`, margin, yPosition);
        yPosition += 5;
        const description = pdf.splitTextToSize(`   ${d.description}`, pageWidth - 2 * margin);
        ensureSpaceForContent(description.length * 4);
        pdf.text(description, margin, yPosition);
        yPosition += description.length * 4 + 3;
      });

      // Detailed assessment
      yPosition += 5;
      ensureSpaceForContent(15);
      pdf.setFontSize(14);
      pdf.text("DETAILED ASSESSMENT:", margin, yPosition);
      yPosition += 10;

      pdf.setFontSize(10);
      const splitAssessment = pdf.splitTextToSize(result.detailedAssessment, pageWidth - 2 * margin);
      
      splitAssessment.forEach((line: string) => {
        ensureSpaceForContent(5);
        pdf.text(line, margin, yPosition);
        yPosition += 5;
      });

      pdf.save(`case-assessment-${Date.now()}.pdf`);
    } else {
      // Text format
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `case-assessment-${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] w-full">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-xl font-bold">
            Case Assessment Report
          </DialogTitle>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => handleDownload('pdf')}>
                  <FileText className="w-4 h-4 mr-2" />
                  PDF Report
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleDownload('txt')}>
                  <FileText className="w-4 h-4 mr-2" />
                  Text File
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <ScrollArea className="max-h-[75vh] pr-4">
          <div className="space-y-6">
            {/* Overall Score */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Overall Case Score
                  <Badge className={`text-lg px-4 py-2 ${getScoreColor(result.overallCaseScore)}`}>
                    {result.overallCaseScore}/100
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-600 mb-2">
                  Document: {documentTitle || 'Untitled Document'}
                </div>
                <div className="text-sm text-gray-600">
                  Analyzed by: {getProviderDisplayName(provider)}
                </div>
              </CardContent>
            </Card>

            {/* Dimension Scores */}
            <Card>
              <CardHeader>
                <CardTitle>Assessment Dimensions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {dimensions.map((dimension, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{dimension.label}</div>
                        <div className="text-sm text-gray-600">{dimension.description}</div>
                      </div>
                      <Badge className={`ml-4 ${getScoreColor(dimension.score)}`}>
                        {dimension.score}/100
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Detailed Assessment */}
            <Card>
              <CardHeader>
                <CardTitle>Detailed Assessment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {cleanAIResponse(result.detailedAssessment)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}