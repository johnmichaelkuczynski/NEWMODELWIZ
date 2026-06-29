import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileEdit, ShieldAlert, Share2, Maximize2 } from "lucide-react";
import ReportDownloadButton from "./ReportDownloadButton";
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cleanAIResponse } from "@/lib/textUtils";
import IntelligenceReportModal from './IntelligenceReportModal';

interface MultiProviderResultsProps {
  results: any[];
  documentId?: number;
}

// ZHI branding mapping - never expose actual LLM names
const getZhiDisplayName = (provider: string): string => {
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

export function MultiProviderResults({ results, documentId }: MultiProviderResultsProps) {
  const [activeProvider, setActiveProvider] = useState<string>("zhi1");
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  if (!results || results.length === 0) {
    return (
      <Card className="w-full mt-4">
        <CardHeader>
          <CardTitle>Analysis Results</CardTitle>
          <CardDescription>No results available</CardDescription>
        </CardHeader>
        <CardContent>
          <p>No analysis results are available. Please try again or select a different model.</p>
        </CardContent>
      </Card>
    );
  }
  
  // Extract provider ids for tab triggers - map to ZHI names
  const providerIds = results.map(r => {
    const providerName = r.provider?.toLowerCase() || '';
    if (providerName.includes('openai') || providerName.includes('zhi1')) return 'zhi1';
    if (providerName.includes('anthropic') || providerName.includes('claude') || providerName.includes('zhi2')) return 'zhi2';
    if (providerName.includes('deepseek') || providerName.includes('zhi3')) return 'zhi3';
    if (providerName.includes('perplexity') || providerName.includes('zhi4')) return 'zhi4';
    if (providerName.includes('grok') || providerName.includes('zhi5')) return 'zhi5';
    return 'unknown';
  });
  
  // Find the active result based on the selected provider
  const getActiveResult = () => {
    const activeIndex = providerIds.indexOf(activeProvider as any);
    return activeIndex >= 0 ? results[activeIndex] : results[0];
  };
  
  // Format the report text for display
  const formatReport = (text: string) => {
    if (!text) return <p>No analysis available</p>;
    
    // Clean markup first
    const cleanedText = cleanAIResponse(text);
    
    // Split by line breaks to display paragraphs properly
    return cleanedText.split('\n').map((line, index) => {
      // Skip empty lines
      if (!line.trim()) return null;
      
      // Check if it contains the intelligence score
      if (line.toLowerCase().includes('intelligence score')) {
        return (
          <div key={index} className="my-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-300 dark:border-blue-800">
            <h2 className="text-xl font-bold text-blue-700 dark:text-blue-300">{line}</h2>
          </div>
        );
      }
      
      // Check if it's a section title (ends with a colon)
      if (line.trim().endsWith(':') && !line.includes(',')) {
        return <h4 key={index} className="font-semibold mt-3 mb-1">{line}</h4>;
      }
      
      // Regular paragraph or empty line
      return line.trim() ? <p key={index} className="my-2">{line}</p> : <br key={index} />;
    });
  };
  
  return (
    <div className="w-full mt-4 space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Intelligence Assessment</CardTitle>
              <CardDescription>Analysis from multiple ZHI models</CardDescription>
            </div>
            <div className="flex space-x-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900"
              >
                <Maximize2 className="h-4 w-4" />
                View Full Report
              </Button>
              <Button size="sm" variant="outline" className="flex items-center gap-2">
                <FileEdit className="h-4 w-4" />
                Rewrite
              </Button>
              <Button size="sm" variant="outline" className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                Check AI
              </Button>
              <Button size="sm" variant="outline" className="flex items-center gap-2">
                <Share2 className="h-4 w-4" />
                Share via Email
              </Button>
              <ReportDownloadButton analysisA={{provider: "Multiple", formattedReport: "Multiple provider analysis"}} mode="single" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="zhi1" value={activeProvider} onValueChange={setActiveProvider}>
            <TabsList className="mb-4">
              {results.map((result, index) => (
                <TabsTrigger 
                  key={index} 
                  value={providerIds[index] || 'unknown'}
                  className="relative flex items-center"
                >
                  {getZhiDisplayName(result.provider || 'unknown')}
                  {result.formattedReport?.toLowerCase().includes('intelligence score') && (
                    <Badge variant="outline" className="ml-2 bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300">
                      Scored
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {results.map((result, index) => (
              <TabsContent key={index} value={providerIds[index] || 'unknown'} className="space-y-4">
                <div className="p-4 rounded-md border bg-muted/40">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{getZhiDisplayName(result.provider || 'unknown')}</h3>
                  </div>
                  <Separator className="my-2" />
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {formatReport(result.formattedReport)}
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Intelligence Report Modal */}
      <IntelligenceReportModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        analysis={getActiveResult()}
      />
    </div>
  );
}