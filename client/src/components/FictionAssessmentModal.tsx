import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Download, Loader2, FileText } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { apiRequest } from '@/lib/queryClient';
import jsPDF from 'jspdf';

interface FictionAssessmentResult {
  worldCoherence: number;
  emotionalPlausibility: number;
  thematicDepth: number;
  narrativeStructure: number;
  proseControl: number;
  overallFictionScore: number;
  detailedAssessment: string;
}

interface FictionAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentContent: string;
  documentTitle: string;
  result: FictionAssessmentResult | null;
  selectedProvider: string;
}

export function FictionAssessmentModal({ isOpen, onClose, documentContent, documentTitle, result, selectedProvider }: FictionAssessmentModalProps) {

  const downloadReport = (format: 'txt' | 'pdf') => {
    if (!result) return;
    
    const reportContent = `FICTION ASSESSMENT REPORT
Document: ${documentTitle}
Provider: ${selectedProvider}
Generated: ${new Date().toLocaleString()}

OVERALL FICTION SCORE: ${result.overallFictionScore}/100

DIMENSION BREAKDOWN:
World Coherence: ${result.worldCoherence}/100 - How consistent and believable is the fictional world
Emotional Plausibility: ${result.emotionalPlausibility}/100 - Authenticity of characters' emotions and responses
Thematic Depth: ${result.thematicDepth}/100 - Meaningful exploration of underlying themes
Narrative Structure: ${result.narrativeStructure}/100 - Effectiveness of story construction and pacing
Prose Control: ${result.proseControl}/100 - Mastery of language and writing craft

DETAILED ASSESSMENT:
${result.detailedAssessment}`;

    if (format === 'pdf') {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 15;
      let yPosition = 20;

      const ensureSpaceForContent = (neededSpace: number) => {
        if (yPosition + neededSpace > 280) {
          pdf.addPage();
          yPosition = 20;
        }
      };

      // Title
      pdf.setFontSize(18);
      pdf.text("FICTION ASSESSMENT REPORT", pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Document info
      pdf.setFontSize(12);
      pdf.text(`Document: ${documentTitle}`, margin, yPosition);
      yPosition += 7;
      pdf.text(`Provider: ${selectedProvider}`, margin, yPosition);
      yPosition += 7;
      pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, yPosition);
      yPosition += 15;

      // Overall score
      pdf.setFontSize(16);
      pdf.text(`OVERALL FICTION SCORE: ${result.overallFictionScore}/100`, margin, yPosition);
      yPosition += 15;

      // Dimension breakdown
      pdf.setFontSize(14);
      pdf.text("DIMENSION BREAKDOWN:", margin, yPosition);
      yPosition += 10;

      const dimensions = [
        { label: "World Coherence", score: result.worldCoherence, description: "How consistent and believable is the fictional world" },
        { label: "Emotional Plausibility", score: result.emotionalPlausibility, description: "Authenticity of characters' emotions and responses" },
        { label: "Thematic Depth", score: result.thematicDepth, description: "Meaningful exploration of underlying themes" },
        { label: "Narrative Structure", score: result.narrativeStructure, description: "Effectiveness of story construction and pacing" },
        { label: "Prose Control", score: result.proseControl, description: "Mastery of language and writing craft" }
      ];

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

      pdf.save(`fiction-assessment-${Date.now()}.pdf`);
    } else {
      const blob = new Blob([reportContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fiction-assessment-${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="fiction-assessment-modal-description">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Fiction Assessment - {documentTitle}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Analyzed with: <span className="font-medium capitalize">{selectedProvider}</span>
            </div>
            
            {result && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Download Report
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={() => downloadReport('pdf')}>
                    <FileText className="w-4 h-4 mr-2" />
                    PDF Report
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => downloadReport('txt')}>
                    <FileText className="w-4 h-4 mr-2" />
                    Text File
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {result && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-center">
                    Overall Fiction Score: {result.overallFictionScore}/100
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Progress value={result.overallFictionScore} className="h-3" />
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">World Coherence</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Progress value={result.worldCoherence} className="flex-1 h-2" />
                      <span className="text-sm font-medium">{result.worldCoherence}/100</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Consistency and believability of the fictional world
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Emotional Plausibility</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Progress value={result.emotionalPlausibility} className="flex-1 h-2" />
                      <span className="text-sm font-medium">{result.emotionalPlausibility}/100</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Authenticity of characters' emotions and responses
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Thematic Depth</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Progress value={result.thematicDepth} className="flex-1 h-2" />
                      <span className="text-sm font-medium">{result.thematicDepth}/100</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Meaningful exploration of underlying themes
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Narrative Structure</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Progress value={result.narrativeStructure} className="flex-1 h-2" />
                      <span className="text-sm font-medium">{result.narrativeStructure}/100</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Effectiveness of story construction and pacing
                    </p>
                  </CardContent>
                </Card>

                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-sm">Prose Control</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Progress value={result.proseControl} className="flex-1 h-2" />
                      <span className="text-sm font-medium">{result.proseControl}/100</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Mastery of language and writing craft
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Detailed Assessment</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose max-w-none">
                    <pre className="whitespace-pre-wrap text-base text-gray-900 dark:text-gray-100 font-medium leading-relaxed">
                      {result.detailedAssessment}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}