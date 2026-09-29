import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { RotateCw, Bot, Info, ExternalLink } from 'lucide-react';

interface DirectAIRequestProps {
  defaultInstructions?: string;
  onResponseReceived?: (results: any) => void;
}

const DirectAIRequest: React.FC<DirectAIRequestProps> = ({
  defaultInstructions = "",
  onResponseReceived
}) => {
  const { toast } = useToast();
  const [instructions, setInstructions] = useState<string>(defaultInstructions);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [results, setResults] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState<string>("openai");
  
  // Models to query
  const [queryOpenAI, setQueryOpenAI] = useState<boolean>(true);
  const [queryClaude, setQueryClaude] = useState<boolean>(true);
  const [queryPerplexity, setQueryPerplexity] = useState<boolean>(true);

  // Parse instructions for suggested models to query
  useEffect(() => {
    // Look for mentions of specific models in the instructions
    const text = instructions.toLowerCase();
    
    // If specific models are mentioned, only select those
    const openaiMentioned = text.includes("ask openai") || text.includes("ask gpt");
    const claudeMentioned = text.includes("ask claude") || text.includes("ask anthropic");
    const perplexityMentioned = text.includes("ask perplexity");
    
    // If any specific model is mentioned, update checkboxes
    if (openaiMentioned || claudeMentioned || perplexityMentioned) {
      setQueryOpenAI(openaiMentioned);
      setQueryClaude(claudeMentioned);
      setQueryPerplexity(perplexityMentioned);
    }
  }, [instructions]);

  // Handle direct AI request
  const handleRequest = async () => {
    if (!instructions.trim()) {
      toast({
        title: "Instructions required",
        description: "Please provide instructions for the AI models",
        variant: "destructive"
      });
      return;
    }

    // Get list of models to query
    const models = [];
    if (queryOpenAI) models.push("openai");
    if (queryClaude) models.push("claude");
    if (queryPerplexity) models.push("perplexity");

    if (models.length === 0) {
      toast({
        title: "Select at least one model",
        description: "Please select at least one AI model to query",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      // Make direct model request
      const response = await fetch("/api/direct-model-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructions,
          models
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setResults(data.results);
        
        // Set active tab to first available result
        const firstModel = Object.keys(data.results)[0];
        if (firstModel) {
          setActiveTab(firstModel);
        }

        // Notify parent component if callback provided
        if (onResponseReceived) {
          onResponseReceived(data.results);
        }

        toast({
          title: "Research complete",
          description: `Received responses from ${Object.keys(data.results).length} AI models`
        });
      } else {
        throw new Error(data.message || "Failed to get AI responses");
      }
    } catch (error) {
      console.error("AI request error:", error);
      toast({
        title: "Request failed",
        description: error instanceof Error ? error.message : "Could not complete AI request",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="direct-instructions" className="text-sm font-medium">
            Direct AI Research Instructions
          </Label>
          <Textarea
            id="direct-instructions"
            placeholder="Example: ASK ZHI 2 ABOUT ceteris paribus in physics. ASK ZHI 4 for the most recent research on this topic."
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className="min-h-[100px] resize-y"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-col space-y-2">
            <Label className="text-sm font-medium">Select AI Models</Label>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="openai-checkbox"
                  checked={queryOpenAI}
                  onCheckedChange={(checked) => setQueryOpenAI(checked as boolean)}
                />
                <Label htmlFor="openai-checkbox" className="text-sm cursor-pointer">
                  ZHI 1
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="claude-checkbox"
                  checked={queryClaude}
                  onCheckedChange={(checked) => setQueryClaude(checked as boolean)}
                />
                <Label htmlFor="claude-checkbox" className="text-sm cursor-pointer">
                  ZHI 2
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="perplexity-checkbox"
                  checked={queryPerplexity}
                  onCheckedChange={(checked) => setQueryPerplexity(checked as boolean)}
                />
                <Label htmlFor="perplexity-checkbox" className="text-sm cursor-pointer">
                  ZHI 4
                </Label>
              </div>
            </div>
          </div>

          <Button
            onClick={handleRequest}
            disabled={isLoading}
            className="flex items-center space-x-2"
          >
            {isLoading ? (
              <>
                <RotateCw className="h-4 w-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Bot className="h-4 w-4" />
                <span>Ask AI Models</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {Object.keys(results).length > 0 && (
        <div className="mt-6 border rounded-lg p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-3">
              <TabsTrigger 
                value="openai" 
                disabled={!results.openai}
                className="flex items-center justify-center"
              >
                ZHI 1
              </TabsTrigger>
              <TabsTrigger 
                value="claude" 
                disabled={!results.claude}
                className="flex items-center justify-center"
              >
                ZHI 2
              </TabsTrigger>
              <TabsTrigger 
                value="perplexity" 
                disabled={!results.perplexity}
                className="flex items-center justify-center"
              >
                ZHI 4
              </TabsTrigger>
            </TabsList>

            {Object.keys(results).map(model => (
              <TabsContent key={model} value={model} className="p-2 overflow-auto">
                <Card>
                  <CardContent className="pt-4">
                    {results[model]?.error ? (
                      <div className="p-4 text-red-600 bg-red-50 rounded">
                        Error: {results[model].error}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Bot className="h-4 w-4 text-blue-600" />
                            <span className="font-medium">{results[model]?.provider || model}</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            {results[model]?.model || ''}
                          </div>
                        </div>
                        
                        <div className="whitespace-pre-wrap text-sm">
                          {results[model]?.content || "No content available"}
                        </div>
                        
                        {model === 'perplexity' && results[model]?.citations && results[model].citations.length > 0 && (
                          <div className="mt-4">
                            <details>
                              <summary className="flex items-center space-x-1 cursor-pointer text-sm text-blue-600">
                                <Info className="h-3 w-3" />
                                <span>{results[model].citations.length} Citations</span>
                              </summary>
                              <div className="mt-2 pl-4 border-l-2 border-blue-100 space-y-2">
                                {results[model].citations.map((citation: string, idx: number) => (
                                  <div key={idx} className="flex items-start space-x-2 text-xs">
                                    <ExternalLink className="h-3 w-3 mt-0.5 text-blue-600 flex-shrink-0" />
                                    <a 
                                      href={citation} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline break-all"
                                    >
                                      {citation}
                                    </a>
                                  </div>
                                ))}
                              </div>
                            </details>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      )}
    </div>
  );
};

export default DirectAIRequest;