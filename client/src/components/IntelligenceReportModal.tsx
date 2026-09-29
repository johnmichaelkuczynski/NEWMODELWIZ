import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, TrendingUp, Target, Zap, Eye, Lightbulb, FileText } from 'lucide-react';
import { DocumentAnalysis } from '@/lib/types';
import { cleanAIResponse } from '@/lib/textUtils';

// Provider name mapping
const getProviderDisplayName = (provider: string): string => {
  const providerMap: { [key: string]: string } = {
    'deepseek': 'Zhi 3',
    'openai': 'Zhi 2', 
    'anthropic': 'Zhi 1',
    'perplexity': 'Zhi 4'
  };
  return providerMap[provider.toLowerCase()] || provider;
};

interface IntelligenceReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: DocumentAnalysis;
  analysisMode?: "quick" | "comprehensive";
}

function extractIntelligenceScore(text: string): number | null {
  const patterns = [
    /🧠\s*Final Intelligence Score:\s*(\d+)\/100/i,
    /Final Intelligence Score:\s*(\d+)\/100/i,
    /Intelligence Score:\s*(\d+)\/100/i,
    /Overall Score:\s*(\d+)\/100/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
  }
  return null;
}

function extractExecutiveSummary(text: string): string {
  const summaryMatch = text.match(/## Executive Summary([\s\S]*?)(?=## Detailed|$)/i);
  if (summaryMatch) return summaryMatch[1].trim();
  
  // Fallback: Look for any paragraph after the score
  const scoreMatch = text.match(/🧠\s*Final Intelligence Score:\s*\d+\/100([\s\S]*?)(?=##|$)/i);
  if (scoreMatch) {
    const afterScore = scoreMatch[1].trim();
    const firstParagraphs = afterScore.split('\n\n').slice(0, 2).join('\n\n');
    return firstParagraphs;
  }
  
  return '';
}

function extractDimensions(text: string): Array<{name: string, score: string, icon: React.ReactNode, analysis: string}> {
  const dimensions = [];
  const dimensionPatterns = [
    { name: 'Semantic Compression', pattern: /### 1\. Semantic Compression Assessment:\s*([\d.]+\/10)([\s\S]*?)(?=### 2\.|\n## |$)/i, icon: <Zap className="w-5 h-5" /> },
    { name: 'Inferential Control', pattern: /### 2\. Inferential Control Assessment:\s*([\d.]+\/10)([\s\S]*?)(?=### 3\.|\n## |$)/i, icon: <Target className="w-5 h-5" /> },
    { name: 'Cognitive Risk', pattern: /### 3\. Cognitive Risk Assessment:\s*([\d.]+\/10)([\s\S]*?)(?=### 4\.|\n## |$)/i, icon: <TrendingUp className="w-5 h-5" /> },
    { name: 'Meta-Theoretical Awareness', pattern: /### 4\. Meta-Theoretical Awareness Assessment:\s*([\d.]+\/10)([\s\S]*?)(?=### 5\.|\n## |$)/i, icon: <Eye className="w-5 h-5" /> },
    { name: 'Conceptual Innovation', pattern: /### 5\. Conceptual Innovation Assessment:\s*([\d.]+\/10)([\s\S]*?)(?=### 6\.|\n## |$)/i, icon: <Lightbulb className="w-5 h-5" /> },
    { name: 'Epistemic Resistance', pattern: /### 6\. Epistemic Resistance Assessment:\s*([\d.]+\/10)([\s\S]*?)(?=## |\n## |$)/i, icon: <Brain className="w-5 h-5" /> }
  ];
  
  // Try new structured format first
  for (const dim of dimensionPatterns) {
    const match = text.match(dim.pattern);
    if (match && match[1] && match[2]) {
      dimensions.push({
        name: dim.name,
        score: match[1],
        icon: dim.icon,
        analysis: match[2].trim()
      });
    }
  }
  
  // Fallback: Extract from older format or simpler patterns
  if (dimensions.length === 0) {
    const fallbackPatterns = [
      { name: 'Semantic Compression', pattern: /Semantic Compression.*?(\d+\.?\d*\/10|(\d+\.?\d*)\/10)/i, icon: <Zap className="w-5 h-5" /> },
      { name: 'Inferential Control', pattern: /Inferential Control.*?(\d+\.?\d*\/10|(\d+\.?\d*)\/10)/i, icon: <Target className="w-5 h-5" /> },
      { name: 'Cognitive Risk', pattern: /Cognitive Risk.*?(\d+\.?\d*\/10|(\d+\.?\d*)\/10)/i, icon: <TrendingUp className="w-5 h-5" /> },
      { name: 'Meta-Theoretical Awareness', pattern: /Meta-Theoretical Awareness.*?(\d+\.?\d*\/10|(\d+\.?\d*)\/10)/i, icon: <Eye className="w-5 h-5" /> },
      { name: 'Conceptual Innovation', pattern: /Conceptual Innovation.*?(\d+\.?\d*\/10|(\d+\.?\d*)\/10)/i, icon: <Lightbulb className="w-5 h-5" /> },
      { name: 'Epistemic Resistance', pattern: /Epistemic Resistance.*?(\d+\.?\d*\/10|(\d+\.?\d*)\/10)/i, icon: <Brain className="w-5 h-5" /> }
    ];
    
    for (const dim of fallbackPatterns) {
      const match = text.match(dim.pattern);
      if (match && match[1]) {
        dimensions.push({
          name: dim.name,
          score: match[1],
          icon: dim.icon,
          analysis: `Assessment found in report: ${match[0]}`
        });
      }
    }
  }
  
  return dimensions;
}

function extractComparativePlacement(text: string): string {
  const placementMatch = text.match(/## Comparative Intelligence Placement([\s\S]*?)(?=## Final Verdict|$)/i);
  if (placementMatch) return placementMatch[1].trim();
  
  // Fallback: Look for placement or comparison sections
  const comparisonMatch = text.match(/(comparative|comparison|placement|position).*?:?([\s\S]*?)(?=##|final|verdict|$)/i);
  if (comparisonMatch) return comparisonMatch[2].trim();
  
  return '';
}

function extractFinalVerdict(text: string): string {
  const verdictMatch = text.match(/## Final Verdict([\s\S]*?)(?=## |$)/i);
  if (verdictMatch) return verdictMatch[1].trim();
  
  // Fallback: Look for final assessment or conclusion
  const finalMatch = text.match(/(final|verdict|conclusion|assessment).*?:?([\s\S]*?)(?=analyzed by|$)/i);
  if (finalMatch) return finalMatch[2].trim();
  
  // Get last substantial paragraph
  const paragraphs = text.split('\n\n').filter(p => p.trim().length > 50);
  if (paragraphs.length > 0) {
    return paragraphs[paragraphs.length - 1];
  }
  
  return '';
}

function formatTextContent(text: string, colorClass: string = "text-gray-700 dark:text-gray-300") {
  // Split text into sentences for better readability
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks = [];
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    if (!sentence) continue;
    
    // Handle scores specially
    if (sentence.match(/Score:\s*(\d+)\/(\d+)/i)) {
      const scoreMatch = sentence.match(/Score:\s*(\d+)\/(\d+)/i);
      if (scoreMatch) {
        chunks.push(
          <div key={i} className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-4 rounded-lg my-4 text-center shadow-lg">
            <div className="text-2xl font-bold">{scoreMatch[1]}/{scoreMatch[2]}</div>
            <div className="text-emerald-100 text-sm">Assessment Score</div>
          </div>
        );
        continue;
      }
    }
    
    // Handle section headers (questions)
    if (sentence.endsWith('?') && sentence.length < 200) {
      chunks.push(
        <div key={i} className="bg-blue-50 dark:bg-blue-950 border-l-4 border-blue-500 p-4 my-4 rounded-r-lg">
          <h4 className="font-semibold text-blue-800 dark:text-blue-200 text-base">{sentence}</h4>
        </div>
      );
      continue;
    }
    
    // Handle quotes
    if (sentence.includes('"')) {
      chunks.push(
        <blockquote key={i} className="border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-950 p-4 my-4 rounded-r-lg">
          <div className="text-amber-800 dark:text-amber-200 font-medium italic">
            {sentence}
          </div>
        </blockquote>
      );
      continue;
    }
    
    // Group regular sentences into readable paragraphs (3-4 sentences each)
    const remainingSentences = sentences.slice(i);
    const paragraphSentences = [];
    let paragraphLength = 0;
    
    for (let j = 0; j < remainingSentences.length && j < 4; j++) {
      const nextSentence = remainingSentences[j].trim();
      if (nextSentence && paragraphLength + nextSentence.length < 600) {
        paragraphSentences.push(nextSentence);
        paragraphLength += nextSentence.length;
      } else {
        break;
      }
    }
    
    if (paragraphSentences.length > 0) {
      chunks.push(
        <p key={i} className={`mb-4 ${colorClass} leading-relaxed text-base`}>
          {paragraphSentences.join(' ')}
        </p>
      );
      i += paragraphSentences.length - 1; // Skip the sentences we just processed
    }
  }
  
  return chunks;
}

function formatEnhancedReport(text: string) {
  // Split text into sentences for better processing
  const sentences = text.split(/(?<=[.!?])\s+/);
  const formattedContent = [];
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    if (!sentence) continue;
    
    // Handle main score extraction and highlight it
    if (sentence.match(/Score:\s*(\d+)\/(\d+)/i)) {
      const scoreMatch = sentence.match(/Score:\s*(\d+)\/(\d+)/i);
      if (scoreMatch) {
        formattedContent.push(
          <div key={i} className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-6 rounded-lg my-6 text-center shadow-lg">
            <div className="text-4xl font-bold mb-2">{scoreMatch[1]}/{scoreMatch[2]}</div>
            <div className="text-emerald-100 text-lg">Intelligence Assessment Score</div>
          </div>
        );
        continue;
      }
    }
    
    // Handle section headers (questions)
    if (sentence.endsWith('?') && sentence.length < 200) {
      formattedContent.push(
        <div key={i} className="bg-blue-50 dark:bg-blue-950 border-l-4 border-blue-500 p-4 my-4 rounded-r-lg">
          <h4 className="font-semibold text-blue-800 dark:text-blue-200 text-lg">{sentence}</h4>
        </div>
      );
      continue;
    }
    
    // Handle quoted text
    if (sentence.includes('"')) {
      formattedContent.push(
        <blockquote key={i} className="border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-950 p-6 my-6 rounded-r-lg shadow-sm">
          <div className="text-amber-800 dark:text-amber-200 font-medium text-lg italic leading-relaxed">
            {sentence}
          </div>
        </blockquote>
      );
      continue;
    }
    
    // Handle assessment criteria (sentences with colons)
    if (sentence.includes(':') && !sentence.startsWith('http')) {
      const [label, ...rest] = sentence.split(':');
      const content = rest.join(':').trim();
      if (content && label.length < 100) {
        formattedContent.push(
          <div key={i} className="mb-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
            <dt className="font-semibold text-slate-800 dark:text-slate-200 mb-2 text-lg">{label}:</dt>
            <dd className="text-slate-700 dark:text-slate-300 leading-relaxed">{content}</dd>
          </div>
        );
        continue;
      }
    }
    
    // Group regular sentences into readable paragraphs (3-4 sentences each)
    const remainingSentences = sentences.slice(i);
    const paragraphSentences = [];
    let paragraphLength = 0;
    
    for (let j = 0; j < remainingSentences.length && j < 4; j++) {
      const nextSentence = remainingSentences[j].trim();
      if (nextSentence && paragraphLength + nextSentence.length < 600) {
        paragraphSentences.push(nextSentence);
        paragraphLength += nextSentence.length;
      } else {
        break;
      }
    }
    
    if (paragraphSentences.length > 0) {
      formattedContent.push(
        <p key={i} className="mb-5 text-slate-700 dark:text-slate-300 leading-relaxed text-base bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
          {paragraphSentences.join(' ')}
        </p>
      );
      i += paragraphSentences.length - 1; // Skip the sentences we just processed
    }
  }
  
  return formattedContent;
}

const IntelligenceReportModal: React.FC<IntelligenceReportModalProps> = ({ isOpen, onClose, analysis, analysisMode = "comprehensive" }) => {
  const formattedReport = analysis.formattedReport || analysis.report || "";
  const cleanedReport = cleanAIResponse(formattedReport);
  
  // Use ONLY the final score from 4-phase protocol - no extraction needed
  const intelligenceScore = analysis.overallScore;
  const executiveSummary = extractExecutiveSummary(cleanedReport);
  const dimensions = extractDimensions(cleanedReport);
  const comparativePlacement = extractComparativePlacement(cleanedReport);
  const finalVerdict = extractFinalVerdict(cleanedReport);
  const provider = analysis.provider || "AI";
  
  // Check if we have phase-by-phase data for comprehensive reports
  const hasPhaseData = analysis.phases && analysisMode === "comprehensive";
  const phases = analysis.phases;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden" aria-describedby="intelligence-report-description">
        <DialogHeader className="pb-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Brain className="w-10 h-10 text-blue-600 dark:text-blue-400" />
              <div>
                <DialogTitle className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {analysisMode === "quick" ? "Quick Intelligence Assessment" : "Comprehensive Intelligence Assessment"}
                </DialogTitle>
                <p id="intelligence-report-description" className="text-base text-gray-600 dark:text-gray-400 mt-2">
                  Forensic Cognitive Analysis with Extensive Textual Evidence
                </p>
              </div>
            </div>
            {intelligenceScore && (
              <div className="text-right bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 p-4 rounded-lg">
                <div className="text-5xl font-bold text-blue-600 dark:text-blue-400">{intelligenceScore}/100</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">4-Phase Protocol Final Score</div>
              </div>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="h-[calc(95vh-150px)] pr-6">
          <div className="space-y-8">
            {/* Comprehensive 4-Phase Protocol Display */}
            {hasPhaseData && phases && (
              <div className="space-y-6">
                {/* Phase 1 */}
                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900 dark:to-indigo-900 border-blue-200 dark:border-blue-700">
                  <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Brain className="w-6 h-6" />
                        <div>
                          <h3 className="text-xl font-bold">Phase 1: Initial Questions and Assessment</h3>
                          <p className="text-blue-100 text-sm mt-1">{phases.phase1.prompt}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{phases.phase1.score}/100</div>
                        <div className="text-blue-100 text-sm">Initial Score</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      {formatTextContent(phases.phase1.response)}
                    </div>
                  </CardContent>
                </Card>

                {/* Phase 2 */}
                <Card className={`bg-gradient-to-br ${phases.phase2.applied ? 'from-orange-50 to-red-50 dark:from-orange-900 dark:to-red-900 border-orange-200 dark:border-orange-700' : 'from-green-50 to-emerald-50 dark:from-green-900 dark:to-emerald-900 border-green-200 dark:border-green-700'}`}>
                  <CardHeader className={`bg-gradient-to-r ${phases.phase2.applied ? 'from-orange-600 to-red-600' : 'from-green-600 to-emerald-600'} text-white rounded-t-lg`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Target className="w-6 h-6" />
                        <div>
                          <h3 className="text-xl font-bold">Phase 2: Pushback Protocol</h3>
                          <p className={`${phases.phase2.applied ? 'text-orange-100' : 'text-green-100'} text-sm mt-1`}>
                            {phases.phase2.applied ? 'Applied - Score was < 95' : 'Skipped - Score was ≥ 95'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{phases.phase2.score}/100</div>
                        <div className={`${phases.phase2.applied ? 'text-orange-100' : 'text-green-100'} text-sm`}>Revised Score</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      {formatTextContent(phases.phase2.response)}
                    </div>
                  </CardContent>
                </Card>

                {/* Phase 3 */}
                <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900 dark:to-violet-900 border-purple-200 dark:border-purple-700">
                  <CardHeader className="bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-t-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <TrendingUp className="w-6 h-6" />
                        <div>
                          <h3 className="text-xl font-bold">Phase 3: Walmart Metric Consistency</h3>
                          <p className="text-purple-100 text-sm mt-1">Reality check on scoring vs. general population</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{phases.phase3.score}/100</div>
                        <div className="text-purple-100 text-sm">Validated Score</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      {formatTextContent(phases.phase3.response)}
                    </div>
                  </CardContent>
                </Card>

                {/* Phase 4 */}
                <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900 dark:to-teal-900 border-emerald-200 dark:border-emerald-700">
                  <CardHeader className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-t-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="w-6 h-6" />
                        <div>
                          <h3 className="text-xl font-bold">Phase 4: Final Validation</h3>
                          <p className="text-emerald-100 text-sm mt-1">Acceptance and final report</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold">{phases.phase4.score}/100</div>
                        <div className="text-emerald-100 text-sm">Final Score</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      {formatTextContent(phases.phase4.response)}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
            
            {/* Enhanced Quick Analysis Content or fallback */}
            {(!hasPhaseData && (!executiveSummary && !dimensions.length && !comparativePlacement && !finalVerdict)) && (
              <Card className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950 border-slate-200 dark:border-slate-700 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
                  <div className="flex items-center gap-3">
                    <Brain className="w-6 h-6" />
                    <div>
                      <h3 className="text-xl font-bold">
                        {analysisMode === "quick" ? "Intelligence Assessment Report" : "Comprehensive Analysis Report"}
                      </h3>
                      <p className="text-blue-100 text-sm mt-1">
                        {analysisMode === "quick" ? "Phase 1 Cognitive Evaluation" : "Complete Multi-Phase Analysis"}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="bg-white dark:bg-slate-800 m-6 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm">
                    <div className="p-6">
                      <div className="prose prose-lg dark:prose-invert max-w-none">
                        {formatEnhancedReport(cleanedReport)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Executive Summary */}
            {executiveSummary && (
              <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-blue-800 dark:text-blue-200 flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Executive Summary
                  </h3>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-lg dark:prose-invert max-w-none">
                    {formatTextContent(executiveSummary, "text-blue-800 dark:text-blue-200")}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Detailed Cognitive Dimensions */}
            {dimensions.length > 0 && (
              <div className="space-y-6">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 border-b-2 border-gray-200 dark:border-gray-700 pb-2">
                  Detailed Cognitive Analysis
                </h3>
                {dimensions.map((dim, index) => (
                  <Card key={index} className="border-l-4 border-l-blue-500 shadow-lg">
                    <CardHeader className="pb-4 bg-gray-50 dark:bg-gray-900">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {dim.icon}
                          <div>
                            <h4 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{dim.name}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Cognitive Dimension Assessment</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{dim.score}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Score</div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        {formatTextContent(dim.analysis)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Comparative Intelligence Placement */}
            {comparativePlacement && (
              <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950 border-purple-200 dark:border-purple-800 shadow-lg">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-purple-800 dark:text-purple-200">
                    Comparative Intelligence Placement
                  </h3>
                  <p className="text-sm text-purple-600 dark:text-purple-400">
                    Evidence-based positioning relative to academic and intellectual benchmarks
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {formatTextContent(comparativePlacement, "text-purple-700 dark:text-purple-300")}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Final Verdict */}
            {finalVerdict && (
              <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-800 shadow-lg">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-green-800 dark:text-green-200">
                    Final Assessment
                  </h3>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Comprehensive evaluation of cognitive architecture and intelligence type
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-lg dark:prose-invert max-w-none">
                    {formatTextContent(finalVerdict, "text-green-700 dark:text-green-300")}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Fallback: Show full report if structured content is missing */}
            {!executiveSummary && !dimensions.length && !comparativePlacement && !finalVerdict && cleanedReport && (
              <Card>
                <CardHeader>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Complete Intelligence Analysis</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Full report content</p>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {formatTextContent(cleanedReport)}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Analysis Metadata */}
            <div className="flex justify-center pt-4 border-t border-gray-200 dark:border-gray-700">
              <Badge variant="outline" className="px-4 py-2 text-sm">
                <Brain className="w-4 h-4 mr-2" />
                Analyzed by {getProviderDisplayName(provider)}
              </Badge>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default IntelligenceReportModal;