import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DocumentAnalysis } from '@/lib/types';
import { MultiProviderResults } from './MultiProviderResults';
import { cleanAIResponse, formatForDisplay } from '@/lib/textUtils';
import { Brain, TrendingUp, Target, Zap, Eye, Lightbulb, Maximize2, Scale } from 'lucide-react';

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

interface PhilosophicalIntelligenceReportProps {
  analysis: DocumentAnalysis;
  analysisMode?: "quick" | "comprehensive";
}

function extractIntelligenceScore(text: string): number | null {
  const patterns = [
    /🧠\s*Final Intelligence Score:\s*(\d+)\/100/i,
    /Intelligence Score:\s*(\d+)\/100/i,
    /Final Score:\s*(\d+)\/100/i,
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

function extractDimensions(text: string): Array<{name: string, score: string, icon: React.ReactNode, analysis: string}> {
  const dimensions = [];
  const dimensionPatterns = [
    { name: 'Semantic Compression', pattern: /### 1\. Semantic Compression Assessment:\s*([\d.]+\/10)([\s\S]*?)(?=### 2\.|\n## |$)/i, icon: <Zap className="w-4 h-4" /> },
    { name: 'Inferential Control', pattern: /### 2\. Inferential Control Assessment:\s*([\d.]+\/10)([\s\S]*?)(?=### 3\.|\n## |$)/i, icon: <Target className="w-4 h-4" /> },
    { name: 'Cognitive Risk', pattern: /### 3\. Cognitive Risk Assessment:\s*([\d.]+\/10)([\s\S]*?)(?=### 4\.|\n## |$)/i, icon: <TrendingUp className="w-4 h-4" /> },
    { name: 'Meta-Theoretical Awareness', pattern: /### 4\. Meta-Theoretical Awareness Assessment:\s*([\d.]+\/10)([\s\S]*?)(?=### 5\.|\n## |$)/i, icon: <Eye className="w-4 h-4" /> },
    { name: 'Conceptual Innovation', pattern: /### 5\. Conceptual Innovation Assessment:\s*([\d.]+\/10)([\s\S]*?)(?=### 6\.|\n## |$)/i, icon: <Lightbulb className="w-4 h-4" /> },
    { name: 'Epistemic Resistance', pattern: /### 6\. Epistemic Resistance Assessment:\s*([\d.]+\/10)([\s\S]*?)(?=## |\n## |$)/i, icon: <Brain className="w-4 h-4" /> }
  ];
  
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
  
  return dimensions;
}

function extractSummary(text: string): string {
  const summaryMatch = text.match(/Summary:\s*([^✓\n]+)/i);
  return summaryMatch ? summaryMatch[1].trim() : '';
}

function extractHighlights(text: string): string[] {
  const highlights = [];
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.trim().startsWith('✓')) {
      highlights.push(line.trim().substring(1).trim());
    }
  }
  return highlights;
}

function extractComparativePlacement(text: string): string {
  const placementMatch = text.match(/## Comparative Intelligence Placement([\s\S]*?)(?=## Final Verdict|$)/i);
  return placementMatch ? placementMatch[1].trim() : '';
}

function extractFinalVerdict(text: string): string {
  const verdictMatch = text.match(/## Final Verdict([\s\S]*?)(?=## |$)/i);
  return verdictMatch ? verdictMatch[1].trim() : '';
}

function extractExecutiveSummary(text: string): string {
  const summaryMatch = text.match(/## Executive Summary([\s\S]*?)(?=## Detailed|$)/i);
  return summaryMatch ? summaryMatch[1].trim() : '';
}

function formatEnhancedAnalysis(text: string) {
  const lines = text.split('\n');
  const formattedContent = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) continue;
    
    // SKIP score extraction from text - scores are handled by the header using analysis.overallScore
    if (line.match(/Score:\s*(\d+)\/(\d+)/i)) {
      // Skip this line - don't display scores extracted from text
      continue;
    }
    
    // Handle section headers (ALL CAPS or starting with capitals)
    if ((line === line.toUpperCase() && line.length > 3 && !line.includes(':')) || 
        (line.match(/^[A-Z][A-Z\s]{10,}/) && !line.includes(':'))) {
      formattedContent.push(
        <div key={i} className="mt-8 mb-4">
          <h3 className="text-2xl font-bold bg-gradient-to-r from-slate-700 to-slate-900 dark:from-slate-200 dark:to-slate-100 bg-clip-text text-transparent">
            {line}
          </h3>
          <div className="h-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full w-20 mt-2"></div>
        </div>
      );
      continue;
    }
    
    // Handle questions (lines ending with ?)
    if (line.endsWith('?')) {
      formattedContent.push(
        <div key={i} className="bg-blue-50 dark:bg-blue-950 border-l-4 border-blue-500 p-4 my-4 rounded-r-lg">
          <h4 className="font-semibold text-blue-800 dark:text-blue-200 text-lg">{line}</h4>
        </div>
      );
      continue;
    }
    
    // Handle quoted text
    if (line.includes('"') || line.startsWith('"')) {
      formattedContent.push(
        <blockquote key={i} className="border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-950 p-6 my-6 rounded-r-lg shadow-sm">
          <div className="text-amber-800 dark:text-amber-200 font-medium text-lg italic leading-relaxed">
            {line}
          </div>
        </blockquote>
      );
      continue;
    }
    
    // Handle assessment criteria (lines with colons)
    if (line.includes(':') && !line.startsWith('http')) {
      const [label, ...rest] = line.split(':');
      const content = rest.join(':').trim();
      formattedContent.push(
        <div key={i} className="mb-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
          <dt className="font-semibold text-slate-800 dark:text-slate-200 mb-2 text-lg">{label}:</dt>
          <dd className="text-slate-700 dark:text-slate-300 leading-relaxed">{content}</dd>
        </div>
      );
      continue;
    }
    
    // Regular paragraphs with enhanced styling
    if (line.length > 20) {
      formattedContent.push(
        <p key={i} className="mb-5 text-slate-700 dark:text-slate-300 leading-relaxed text-base">
          {line}
        </p>
      );
    }
  }
  
  return formattedContent;
}

const PhilosophicalIntelligenceReport: React.FC<PhilosophicalIntelligenceReportProps> = ({ analysis, analysisMode = "comprehensive" }) => {
  
  // Check if the analysis contains multiple provider results
  const hasMultipleProviders = analysis.analysisResults && Array.isArray(analysis.analysisResults) && analysis.analysisResults.length > 0;
  
  // If we have multiple provider results, use the dedicated component
  if (hasMultipleProviders) {
    return <MultiProviderResults results={analysis.analysisResults || []} />;
  }
  
  // Extract data from the formatted report - CHECK ALL POSSIBLE FIELDS
  const formattedReport = analysis.formattedReport || analysis.analysis || analysis.report || analysis.summary || "";
  console.log("IMMEDIATE DEBUG - formattedReport length:", formattedReport?.length);
  console.log("IMMEDIATE DEBUG - formattedReport first 500 chars:", formattedReport?.substring(0, 500));
  const cleanedReport = cleanAIResponse(formattedReport);
  
  // Use ONLY the final score from 4-phase protocol - no text extraction needed
  const intelligenceScore = analysis.overallScore;
  const dimensions = extractDimensions(cleanedReport);
  const executiveSummary = extractExecutiveSummary(cleanedReport);
  const comparativePlacement = extractComparativePlacement(cleanedReport);
  const finalVerdict = extractFinalVerdict(cleanedReport);
  const highlights = extractHighlights(cleanedReport);
  const provider = analysis.provider || "AI";
  
  // Case assessment data (HOW WELL DOES IT MAKE ITS CASE)
  const caseAssessment = analysis.caseAssessment || null;
  const isCaseAssessmentOnly = analysis.analysisType === "case_assessment";
  const isFictionAssessmentOnly = analysis.analysisType === "fiction_assessment";
  const isAssessmentOnly = isCaseAssessmentOnly || isFictionAssessmentOnly;

  // If no structured content is available, display the raw report in an enhanced format
  const hasStructuredContent = executiveSummary || dimensions.length > 0 || comparativePlacement || finalVerdict;
  
  return (
    <div className="w-full space-y-8">
      {/* Enhanced Main Intelligence Score Card - HIDE FOR ASSESSMENT ONLY MODES */}
      {!isAssessmentOnly && (
      <Card className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-blue-950 dark:to-indigo-950 border-2 border-blue-200 dark:border-blue-700 shadow-xl">
        <CardHeader className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                <Brain className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {isCaseAssessmentOnly ? "Case Assessment" : (isFictionAssessmentOnly ? "Fiction Assessment" : (analysisMode === "quick" ? "Intelligence Assessment" : "Comprehensive Intelligence Assessment"))}
                </h2>
                <p className="text-blue-100 text-sm mt-1">
                  {isCaseAssessmentOnly ? "How Well Does It Make Its Case?" : (isFictionAssessmentOnly ? "Literary Quality Evaluation" : (analysisMode === "quick" ? "Phase 1 Rapid Evaluation" : "Multi-Phase Forensic Analysis"))}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {intelligenceScore && (
                <div className="text-right bg-white/10 p-4 rounded-lg backdrop-blur-sm">
                  <div className="text-4xl font-bold text-white">{intelligenceScore}/100</div>
                  <div className="text-blue-100 text-sm">4-Phase Protocol Final Score</div>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8">
          {/* DIRECT ANALYSIS DISPLAY - NO POPUP */}
          <div className="space-y-6">
            <div className="prose prose-lg dark:prose-invert max-w-none">
              {formattedReport ? (
                <div>
                  {/* DIRECT RAW DISPLAY - NO FORMATTING FUNCTION */}
                  <div className="space-y-4">
                    {formattedReport.split('\n').map((line: string, index: number) => {
                      if (!line.trim()) return null;
                      
                      // Questions ending with ?
                      if (line.trim().endsWith('?')) {
                        return (
                          <div key={index} className="bg-blue-50 border-l-4 border-blue-500 p-4 my-4 rounded-r-lg">
                            <h4 className="font-semibold text-blue-800 text-lg">{line.trim()}</h4>
                          </div>
                        );
                      }
                      
                      // Lines with quotes
                      if (line.includes('"')) {
                        return (
                          <blockquote key={index} className="border-l-4 border-amber-400 bg-amber-50 p-6 my-6 rounded-r-lg shadow-sm">
                            <div className="text-amber-800 font-medium text-lg italic">
                              {line.trim()}
                            </div>
                          </blockquote>
                        );
                      }
                      
                      // Regular lines
                      return (
                        <p key={index} className="mb-3 text-slate-700 leading-relaxed text-base">
                          {line.trim()}
                        </p>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No analysis content available</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Case Assessment Scores - HOW WELL DOES IT MAKE ITS CASE */}
      {caseAssessment && (
        <Card className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950 border-2 border-orange-200 dark:border-orange-700">
          <CardHeader className="bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-t-lg">
            <CardTitle className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <Scale className="w-5 h-5" />
              </div>
              How Well Does It Make Its Case?
              <Badge className="bg-white/10 text-white text-2xl px-6 py-3 font-black">
                {caseAssessment.overallCaseScore || 0}/100
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border">
                <div className="text-sm text-gray-600 dark:text-gray-400">Proof Effectiveness</div>
                <div className="text-2xl font-bold text-orange-600">{caseAssessment.proofEffectiveness || 0}/100</div>
                <div className="text-xs text-gray-500">How effectively it proves its claims</div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border">
                <div className="text-sm text-gray-600 dark:text-gray-400">Claim Credibility</div>
                <div className="text-2xl font-bold text-orange-600">{caseAssessment.claimCredibility || 0}/100</div>
                <div className="text-xs text-gray-500">Whether claims are credible and worth proving</div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border">
                <div className="text-sm text-gray-600 dark:text-gray-400">Non-Triviality</div>
                <div className="text-2xl font-bold text-orange-600">{caseAssessment.nonTriviality || 0}/100</div>
                <div className="text-xs text-gray-500">Significance and importance of conclusions</div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border">
                <div className="text-sm text-gray-600 dark:text-gray-400">Proof Quality</div>
                <div className="text-2xl font-bold text-orange-600">{caseAssessment.proofQuality || 0}/100</div>
                <div className="text-xs text-gray-500">Logical rigor and reasoning structure</div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border">
                <div className="text-sm text-gray-600 dark:text-gray-400">Functional Writing</div>
                <div className="text-2xl font-bold text-orange-600">{caseAssessment.functionalWriting || 0}/100</div>
                <div className="text-xs text-gray-500">Clarity, organization, and accessibility</div>
              </div>
            </div>
            {caseAssessment.detailedAssessment && (
              <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border">
                <h4 className="font-semibold mb-3 text-orange-700 dark:text-orange-300">Detailed Case Assessment</h4>
                <div className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300">
                  <div className="whitespace-pre-line text-sm leading-relaxed">
                    {formatForDisplay(caseAssessment.detailedAssessment)}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Fiction Assessment Scores - FICTION QUALITY EVALUATION */}
      {analysis.fictionAssessment && (
        <Card className="bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-950 dark:to-purple-950 border-2 border-pink-200 dark:border-pink-700">
          <CardHeader className="bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-t-lg">
            <CardTitle className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <Lightbulb className="w-5 h-5" />
              </div>
              Fiction Assessment
              <Badge className="bg-white/20 text-white text-lg px-3 py-1">
                {analysis.fictionAssessment.overallFictionScore || 0}/100
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border">
                <div className="text-sm text-gray-600 dark:text-gray-400">World Coherence</div>
                <div className="text-2xl font-bold text-pink-600">{analysis.fictionAssessment.worldCoherence || 0}/100</div>
                <div className="text-xs text-gray-500">Consistency and believability of the fictional world</div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border">
                <div className="text-sm text-gray-600 dark:text-gray-400">Emotional Plausibility</div>
                <div className="text-2xl font-bold text-pink-600">{analysis.fictionAssessment.emotionalPlausibility || 0}/100</div>
                <div className="text-xs text-gray-500">Authenticity of characters' emotions and reactions</div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border">
                <div className="text-sm text-gray-600 dark:text-gray-400">Thematic Depth</div>
                <div className="text-2xl font-bold text-pink-600">{analysis.fictionAssessment.thematicDepth || 0}/100</div>
                <div className="text-xs text-gray-500">Meaningful exploration of underlying themes</div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border">
                <div className="text-sm text-gray-600 dark:text-gray-400">Narrative Structure</div>
                <div className="text-2xl font-bold text-pink-600">{analysis.fictionAssessment.narrativeStructure || 0}/100</div>
                <div className="text-xs text-gray-500">Effectiveness of story construction and pacing</div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border">
                <div className="text-sm text-gray-600 dark:text-gray-400">Prose Control</div>
                <div className="text-2xl font-bold text-pink-600">{analysis.fictionAssessment.proseControl || 0}/100</div>
                <div className="text-xs text-gray-500">Mastery of language and writing craft</div>
              </div>
            </div>
            {analysis.fictionAssessment.detailedAssessment && (
              <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border">
                <h4 className="font-semibold mb-3 text-pink-700 dark:text-pink-300">Detailed Fiction Assessment</h4>
                <div className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {analysis.fictionAssessment.detailedAssessment}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Detailed Cognitive Dimensions */}
      {dimensions.length > 0 && (
        <div className="space-y-6">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {analysisMode === "quick" ? "Core Cognitive Indicators" : "Detailed Cognitive Analysis"}
          </h3>
          {dimensions.map((dim, index) => (
            <Card key={index} className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  {dim.icon}
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{dim.name}</h4>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{dim.score}</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {dim.analysis.split('\n').map((paragraph, pIndex) => {
                    if (!paragraph.trim()) return null;
                    
                    // Handle quotes specially
                    if (paragraph.includes('"')) {
                      return (
                        <blockquote key={pIndex} className="border-l-4 border-gray-300 dark:border-gray-700 pl-4 my-4 italic text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-3 rounded">
                          {paragraph}
                        </blockquote>
                      );
                    }
                    
                    // Handle section headers
                    if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
                      const cleanHeader = paragraph.replace(/\*\*/g, '');
                      return (
                        <h5 key={pIndex} className="font-semibold text-gray-900 dark:text-gray-100 mt-4 mb-2">
                          {cleanHeader}
                        </h5>
                      );
                    }
                    
                    // Regular paragraphs
                    return (
                      <p key={pIndex} className="mb-3 text-gray-700 dark:text-gray-300 leading-relaxed">
                        {paragraph}
                      </p>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Highlights */}
      {highlights.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-xl font-semibold">Key Highlights</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {highlights.map((highlight, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-gray-700 dark:text-gray-300">{highlight}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comparative Intelligence Placement */}
      {comparativePlacement && (
        <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950 border-purple-200 dark:border-purple-800">
          <CardHeader>
            <h3 className="text-xl font-semibold text-purple-800 dark:text-purple-200">Comparative Intelligence Placement</h3>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {comparativePlacement.split('\n').map((paragraph, index) => {
                if (!paragraph.trim()) return null;
                
                // Handle quotes specially
                if (paragraph.includes('"')) {
                  return (
                    <blockquote key={index} className="border-l-4 border-purple-300 dark:border-purple-700 pl-4 my-4 italic text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900 p-3 rounded">
                      {paragraph}
                    </blockquote>
                  );
                }
                
                // Handle section headers
                if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
                  const cleanHeader = paragraph.replace(/\*\*/g, '');
                  return (
                    <h5 key={index} className="font-semibold text-purple-900 dark:text-purple-100 mt-4 mb-2">
                      {cleanHeader}
                    </h5>
                  );
                }
                
                return (
                  <p key={index} className="mb-3 text-purple-700 dark:text-purple-300 leading-relaxed">
                    {paragraph}
                  </p>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Final Verdict */}
      {finalVerdict && (
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-800">
          <CardHeader>
            <h3 className="text-xl font-semibold text-green-800 dark:text-green-200">Final Assessment</h3>
          </CardHeader>
          <CardContent>
            <div className="prose prose-lg dark:prose-invert max-w-none">
              {finalVerdict.split('\n').map((paragraph, index) => {
                if (!paragraph.trim()) return null;
                
                // Handle quotes specially
                if (paragraph.includes('"')) {
                  return (
                    <blockquote key={index} className="border-l-4 border-green-300 dark:border-green-700 pl-4 my-4 italic text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900 p-3 rounded">
                      {paragraph}
                    </blockquote>
                  );
                }
                
                return (
                  <p key={index} className="text-lg text-green-700 dark:text-green-300 font-medium leading-relaxed mb-3">
                    {paragraph}
                  </p>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Provider Badge */}
      <div className="flex justify-center">
        <div className="bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 px-6 py-3 rounded-full border border-slate-300 dark:border-slate-600 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-slate-700 dark:text-slate-300 font-medium">Analyzed by {getProviderDisplayName(provider)}</span>
          </div>
        </div>
      </div>

    </div>
  );
};

export default PhilosophicalIntelligenceReport;