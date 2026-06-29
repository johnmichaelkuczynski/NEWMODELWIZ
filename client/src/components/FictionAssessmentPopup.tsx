import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Download, Loader2, FileText, BookOpen } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { apiRequest } from '@/lib/queryClient';
import { Textarea } from '@/components/ui/textarea';
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

interface FictionAssessmentPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FictionAssessmentPopup({ isOpen, onClose }: FictionAssessmentPopupProps) {
  const [fictionText, setFictionText] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("openai");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<FictionAssessmentResult | null>(null);

  const handleAssessment = async () => {
    if (!fictionText.trim()) {
      alert('Please enter some fiction text to assess');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/fiction-assessment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: fictionText.trim(),
          provider: selectedProvider
        }),
      });

      if (!response.ok) {
        throw new Error('Fiction assessment failed');
      }

      const data = await response.json();
      console.log('Fiction Assessment API Response:', data);
      
      // Handle the response properly
      if (data.success && data.result) {
        setResult(data.result);
      } else if (data && (data.worldCoherence !== undefined || data.overallFictionScore !== undefined)) {
        setResult(data);
      } else {
        console.error('Invalid fiction assessment response format:', data);
        throw new Error('Invalid response format - no scores found');
      }
    } catch (error) {
      console.error('Fiction assessment error:', error);
      alert('Fiction assessment failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadReport = (format: 'txt' | 'pdf') => {
    if (!result) return;
    
    const reportContent = `FICTION ASSESSMENT REPORT
Generated: ${new Date().toLocaleString()}
Provider: ${selectedProvider}

OVERALL FICTION SCORE: ${result.overallFictionScore}/100

DIMENSION BREAKDOWN:
World Coherence: ${result.worldCoherence}/100 - How consistent and believable is the fictional world
Emotional Plausibility: ${result.emotionalPlausibility}/100 - Authenticity of characters' emotions and responses
Thematic Depth: ${result.thematicDepth}/100 - Meaningful exploration of underlying themes
Narrative Structure: ${result.narrativeStructure}/100 - Effectiveness of story construction and pacing
Prose Control: ${result.proseControl}/100 - Mastery of language and writing craft

DETAILED ASSESSMENT:
${result.detailedAssessment}

ANALYZED TEXT:
${fictionText}`;

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
      pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, yPosition);
      yPosition += 7;
      pdf.text(`Provider: ${selectedProvider}`, margin, yPosition);
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
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <BookOpen className="w-7 h-7 text-purple-600" />
            Fiction Assessment
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 overflow-y-auto flex-1 pr-2">
          {/* Input Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Fiction Text to Analyze</h3>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium">ZHI Model:</label>
                <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">ZHI 1</SelectItem>
                    <SelectItem value="anthropic">ZHI 2</SelectItem>
                    <SelectItem value="deepseek">ZHI 3</SelectItem>
                    <SelectItem value="perplexity">ZHI 4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Textarea
              placeholder="Paste your fiction text here for literary assessment..."
              value={fictionText}
              onChange={(e) => setFictionText(e.target.value)}
              className="min-h-[200px] text-base"
              data-testid="fiction-text-input"
            />
            
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {fictionText.length} characters, ~{Math.ceil(fictionText.split(' ').filter(w => w.trim()).length)} words
              </div>
              <Button 
                onClick={handleAssessment}
                disabled={isLoading || !fictionText.trim()}
                className="bg-purple-600 hover:bg-purple-700"
                data-testid="button-assess-fiction"
              >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Assess Fiction
              </Button>
            </div>
          </div>

          {/* Results Section */}
          {result && (
            <div className="space-y-6 border-t pt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Assessment Results</h3>
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
              </div>

              {/* Overall Score */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-center text-xl">
                    Overall Fiction Score: {result.overallFictionScore}/100
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Progress value={result.overallFictionScore} className="h-4" />
                </CardContent>
              </Card>

              {/* Dimension Scores */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">World Coherence</CardTitle>
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
                    <CardTitle className="text-base">Emotional Plausibility</CardTitle>
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
                    <CardTitle className="text-base">Thematic Depth</CardTitle>
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
                    <CardTitle className="text-base">Narrative Structure</CardTitle>
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
                    <CardTitle className="text-base">Prose Control</CardTitle>
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

              {/* Detailed Assessment */}
              <Card>
                <CardHeader>
                  <CardTitle>Detailed Assessment</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose max-w-none">
                    <pre className="whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100 font-medium leading-relaxed bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
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