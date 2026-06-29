import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface FictionComparisonResult {
  winnerDocument: 'A' | 'B';
  documentAScore: number;
  documentBScore: number;
  comparisonAnalysis: string;
  detailedBreakdown: string;
}

interface FictionComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentA: { content: string; title: string };
  documentB: { content: string; title: string };
}

export function FictionComparisonModal({ isOpen, onClose, documentA, documentB }: FictionComparisonModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<string>('openai');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<FictionComparisonResult | null>(null);

  const handleComparison = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/fiction-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentA: documentA.content,
          documentB: documentB.content,
          provider: selectedProvider
        })
      });
      
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error performing fiction comparison:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadReport = () => {
    if (!result) return;
    
    const reportContent = `FICTION COMPARISON REPORT
Document A: ${documentA.title}
Document B: ${documentB.title}
Provider: ${selectedProvider}
Generated: ${new Date().toLocaleString()}

WINNER: Document ${result.winnerDocument}
Document A Score: ${result.documentAScore}/100
Document B Score: ${result.documentBScore}/100

COMPARATIVE ANALYSIS:
${result.comparisonAnalysis}

DETAILED BREAKDOWN:
${result.detailedBreakdown}`;

    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fiction-comparison-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fiction Comparison</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Document A</CardTitle>
                <p className="text-sm text-gray-600">{documentA.title}</p>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Document B</CardTitle>
                <p className="text-sm text-gray-600">{documentB.title}</p>
              </CardHeader>
            </Card>
          </div>

          <div className="flex items-center gap-4">
            <Select value={selectedProvider} onValueChange={setSelectedProvider}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select ZHI Model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">ZHI 1</SelectItem>
                <SelectItem value="anthropic">ZHI 2</SelectItem>
                <SelectItem value="deepseek">ZHI 3</SelectItem>
                <SelectItem value="perplexity">ZHI 4</SelectItem>
              </SelectContent>
            </Select>
            
            <Button 
              onClick={handleComparison}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? 'Comparing Fiction...' : 'Compare Fiction'}
            </Button>
            
            {result && (
              <Button
                onClick={downloadReport}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download Report
              </Button>
            )}
          </div>

          {result && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-center">Comparison Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold">Document A</h3>
                        {result.winnerDocument === 'A' && (
                          <Badge variant="default" className="bg-green-600">
                            Winner
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{documentA.title}</p>
                      <div className="text-3xl font-bold text-blue-600">
                        {result.documentAScore}/100
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold">Document B</h3>
                        {result.winnerDocument === 'B' && (
                          <Badge variant="default" className="bg-green-600">
                            Winner
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{documentB.title}</p>
                      <div className="text-3xl font-bold text-purple-600">
                        {result.documentBScore}/100
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Comparative Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap text-sm">
                      {result.comparisonAnalysis}
                    </pre>
                  </div>
                </CardContent>
              </Card>

              {result.detailedBreakdown !== result.comparisonAnalysis && (
                <Card>
                  <CardHeader>
                    <CardTitle>Detailed Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap text-sm">
                        {result.detailedBreakdown}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}