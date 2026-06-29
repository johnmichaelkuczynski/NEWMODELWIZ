import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Download, BarChart3, TrendingUp, Brain, FileText, Target } from "lucide-react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useToast } from "@/hooks/use-toast";

interface TextUnit {
  id: string;
  index: number;
  content: string;
  type: 'sentence' | 'paragraph';
  semanticDensity: number;
  tokenEntropy: number;
  lexicalRarity: number;
  embeddingDistinctiveness: number;
}

interface UnitStatistics {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  densest: TextUnit[];
  flabbiest: TextUnit[];
}

interface SemanticAnalysisResult {
  sentences: TextUnit[];
  paragraphs: TextUnit[];
  statistics: {
    sentences: UnitStatistics;
    paragraphs: UnitStatistics;
  };
}

interface SemanticDensityAnalyzerProps {
  text: string;
}

const SemanticDensityAnalyzer: React.FC<SemanticDensityAnalyzerProps> = ({ text }) => {
  const [analysisResult, setAnalysisResult] = useState<SemanticAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeView, setActiveView] = useState<'sentence' | 'paragraph'>('sentence');
  const { toast } = useToast();

  const analyzeSemanticDensity = async () => {
    if (!text.trim()) {
      toast({
        title: "No text provided",
        description: "Please provide text to analyze semantic density",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/semantic-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const result = await response.json();
      setAnalysisResult(result);
      
      toast({
        title: "Analysis complete",
        description: `Analyzed ${result.sentences.length} sentences and ${result.paragraphs.length} paragraphs`
      });
    } catch (error: any) {
      console.error("Semantic analysis error:", error);
      toast({
        title: "Analysis failed",
        description: error.message || "Failed to analyze semantic density",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getColorByDensity = (density: number): string => {
    if (density >= 0.7) return '#22c55e'; // Green for high density
    if (density >= 0.4) return '#eab308'; // Yellow for medium density
    return '#ef4444'; // Red for low density
  };

  const exportToPDF = async (viewType: 'sentence' | 'paragraph') => {
    if (!analysisResult) return;

    try {
      const chartElement = document.getElementById(`${viewType}-chart-container`);
      if (!chartElement) {
        toast({
          title: "Export failed",
          description: "Chart not found for export",
          variant: "destructive"
        });
        return;
      }

      // Capture the chart as canvas
      const canvas = await html2canvas(chartElement, {
        backgroundColor: '#ffffff',
        scale: 2
      });

      // Create PDF
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');
      
      // Add title
      pdf.setFontSize(16);
      pdf.text(`Semantic Density Analysis - ${viewType.charAt(0).toUpperCase() + viewType.slice(1)} Level`, 20, 20);
      
      // Add chart
      const imgWidth = 250;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 20, 30, imgWidth, imgHeight);
      
      // Add comprehensive statistics
      const stats = analysisResult.statistics[`${viewType}s` as keyof typeof analysisResult.statistics];
      let yPos = 30 + imgHeight + 20;
      
      pdf.setFontSize(14);
      pdf.text('Semantic Density Report', 20, yPos);
      yPos += 15;
      
      pdf.setFontSize(12);
      pdf.text('Core Statistics:', 20, yPos);
      yPos += 10;
      pdf.text(`Mean Density: ${stats.mean.toFixed(3)}`, 25, yPos);
      yPos += 7;
      pdf.text(`Standard Deviation: ${stats.stdDev.toFixed(3)}`, 25, yPos);
      yPos += 7;
      pdf.text(`Range: ${stats.min.toFixed(3)} – ${stats.max.toFixed(3)}`, 25, yPos);
      yPos += 15;
      
      // Add interpretation
      pdf.text('Interpretation:', 20, yPos);
      yPos += 10;
      const variance = stats.stdDev < 0.05 ? 'low variance' : stats.stdDev < 0.1 ? 'moderate variance' : 'high variance';
      const pressure = stats.mean > 0.6 ? 'high conceptual pressure' : stats.mean > 0.4 ? 'moderate conceptual pressure' : 'low conceptual pressure';
      pdf.text(`Consistently ${stats.mean > 0.5 ? 'high' : 'moderate'} semantic density with ${variance}.`, 25, yPos);
      yPos += 7;
      pdf.text(`This implies ${pressure} with ${stats.stdDev < 0.05 ? 'very few' : 'some'} empty sentences.`, 25, yPos);
      yPos += 7;
      pdf.text(`The writing is ${stats.mean > 0.6 ? 'tight, information-rich, and inferentially loaded' : 'moderately dense'}.`, 25, yPos);
      
      // Add highest density examples if space allows
      if (yPos < 180) {
        yPos += 15;
        pdf.text(`Top 3 Highest Density ${viewType.charAt(0).toUpperCase() + viewType.slice(1)}s:`, 20, yPos);
        yPos += 10;
        stats.densest.slice(0, 3).forEach((unit, index) => {
          if (yPos < 200) {
            pdf.text(`${index + 1}. [${unit.semanticDensity.toFixed(3)}] ${unit.content.substring(0, 80)}${unit.content.length > 80 ? '...' : ''}`, 25, yPos);
            yPos += 7;
          }
        });
      }
      
      // Save PDF
      pdf.save(`semantic_density_${viewType}_level.pdf`);
      
      toast({
        title: "PDF exported",
        description: `Semantic density ${viewType} analysis saved successfully`
      });
    } catch (error) {
      console.error("PDF export error:", error);
      toast({
        title: "Export failed",
        description: "Failed to export PDF",
        variant: "destructive"
      });
    }
  };

  if (!analysisResult) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Semantic Density Analysis
          </CardTitle>
          <CardDescription>
            Analyze the semantic richness and information density of your text at sentence and paragraph levels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={analyzeSemanticDensity} 
            disabled={isAnalyzing || !text.trim()}
            className="w-full"
          >
            {isAnalyzing ? "Analyzing..." : "Analyze Semantic Density"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const currentUnits = activeView === 'sentence' ? analysisResult.sentences : analysisResult.paragraphs;
  const currentStats = analysisResult.statistics[`${activeView}s` as keyof typeof analysisResult.statistics];

  // Prepare chart data
  const lineChartData = currentUnits.map(unit => ({
    index: unit.index,
    density: unit.semanticDensity,
    entropy: unit.tokenEntropy,
    rarity: unit.lexicalRarity,
    distinctiveness: unit.embeddingDistinctiveness
  }));

  const barChartData = currentUnits.map(unit => ({
    index: unit.index,
    density: unit.semanticDensity,
    color: getColorByDensity(unit.semanticDensity)
  }));

  return (
    <div className="w-full space-y-6">
      {/* Header with controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Semantic Density Analysis
              </CardTitle>
              <CardDescription>
                Interactive visualization of semantic richness and information density
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={analyzeSemanticDensity} 
                disabled={isAnalyzing}
                variant="outline"
                size="sm"
              >
                Re-analyze
              </Button>
              <Button 
                onClick={() => exportToPDF(activeView)} 
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* View Toggle and Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <Tabs value={activeView} onValueChange={(value) => setActiveView(value as 'sentence' | 'paragraph')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="sentence" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Sentence Level
                </TabsTrigger>
                <TabsTrigger value="paragraph" className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Paragraph Level
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Mean Density:</span>
              <Badge variant="secondary">{currentStats.mean.toFixed(3)}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Std Deviation:</span>
              <Badge variant="secondary">{currentStats.stdDev.toFixed(3)}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Range:</span>
              <Badge variant="secondary">{currentStats.min.toFixed(3)} - {currentStats.max.toFixed(3)}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Units:</span>
              <Badge variant="secondary">{currentUnits.length}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="space-y-6">
        {/* Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Semantic Density Fluctuation
            </CardTitle>
            <CardDescription>
              How semantic density varies across {activeView}s
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div id={`${activeView}-chart-container`} className="w-full h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="index" 
                    label={{ value: `${activeView.charAt(0).toUpperCase() + activeView.slice(1)} Index`, position: 'insideBottom', offset: -5 }} 
                  />
                  <YAxis 
                    label={{ value: 'Semantic Density Score', angle: -90, position: 'insideLeft' }} 
                    domain={[0, 1]}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [value.toFixed(3), name]}
                    labelFormatter={(value) => `${activeView.charAt(0).toUpperCase() + activeView.slice(1)} ${value}`}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="density" 
                    stroke="#2563eb" 
                    strokeWidth={2}
                    name="Semantic Density"
                    dot={{ fill: '#2563eb', strokeWidth: 2, r: 4 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="entropy" 
                    stroke="#dc2626" 
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    name="Token Entropy"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="rarity" 
                    stroke="#16a34a" 
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    name="Lexical Rarity"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="distinctiveness" 
                    stroke="#ca8a04" 
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    name="Embedding Distinctiveness"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Individual Unit Scores
            </CardTitle>
            <CardDescription>
              Semantic density score for each {activeView} (colored by density level)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="index" 
                    label={{ value: `${activeView.charAt(0).toUpperCase() + activeView.slice(1)} Index`, position: 'insideBottom', offset: -5 }} 
                  />
                  <YAxis 
                    label={{ value: 'Semantic Density', angle: -90, position: 'insideLeft' }} 
                    domain={[0, 1]}
                  />
                  <Tooltip 
                    formatter={(value: number) => [value.toFixed(3), 'Semantic Density']}
                    labelFormatter={(value) => `${activeView.charAt(0).toUpperCase() + activeView.slice(1)} ${value}`}
                  />
                  <Bar dataKey="density">
                    {barChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top and Bottom Units */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-green-600">Densest {activeView}s</CardTitle>
            <CardDescription>
              Highest semantic density scores
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentStats.densest.map((unit, index) => (
              <div key={unit.id} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="secondary">#{unit.index}</Badge>
                  <Badge className="bg-green-100 text-green-800">
                    {unit.semanticDensity.toFixed(3)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {unit.content}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-red-600">Least Dense {activeView}s</CardTitle>
            <CardDescription>
              Lowest semantic density scores
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentStats.flabbiest.map((unit, index) => (
              <div key={unit.id} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="secondary">#{unit.index}</Badge>
                  <Badge className="bg-red-100 text-red-800">
                    {unit.semanticDensity.toFixed(3)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {unit.content}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SemanticDensityAnalyzer;