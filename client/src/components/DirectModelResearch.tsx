import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, Bot, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DirectModelResearchProps {
  defaultInstructions?: string;
  onResearchComplete?: (results: any) => void;
}

const DirectModelResearch: React.FC<DirectModelResearchProps> = ({
  defaultInstructions = "Ask all AI models about the key concepts in this text. Find relevant scholarly resources.",
  onResearchComplete
}) => {
  const { toast } = useToast();
  const [instructions, setInstructions] = useState<string>(defaultInstructions);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [results, setResults] = useState<any>({});
  const [activeTab, setActiveTab] = useState<string>("all");

  // Direct research function
  const handleDirectResearch = async () => {
    if (!instructions.trim()) {
      toast({
        title: "Instructions required",
        description: "Please provide research instructions",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      // First, extract any model-specific instructions - support both ZHI names and legacy names
      const modelsToQuery: string[] = [];
      if (instructions.toLowerCase().includes("ask zhi 1") || 
          instructions.toLowerCase().includes("ask openai") || 
          instructions.toLowerCase().includes("ask gpt")) {
        modelsToQuery.push("openai");
      }
      if (instructions.toLowerCase().includes("ask zhi 2") ||
          instructions.toLowerCase().includes("ask claude") || 
          instructions.toLowerCase().includes("ask anthropic")) {
        modelsToQuery.push("anthropic");
      }
      if (instructions.toLowerCase().includes("ask zhi 3") ||
          instructions.toLowerCase().includes("ask deepseek")) {
        modelsToQuery.push("deepseek");
      }
      if (instructions.toLowerCase().includes("ask zhi 4") ||
          instructions.toLowerCase().includes("ask perplexity")) {
        modelsToQuery.push("perplexity");
      }
      if (instructions.toLowerCase().includes("ask zhi 5") ||
          instructions.toLowerCase().includes("ask grok")) {
        modelsToQuery.push("grok");
      }

      // If no specific models mentioned, query ZHI 1, 2, and 4 by default
      if (modelsToQuery.length === 0) {
        modelsToQuery.push("openai", "anthropic", "perplexity");
      }

      // Create promises for all model queries
      const modelPromises = modelsToQuery.map(model => {
        return fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            document: { content: instructions.replace(/ask zhi \d|ask openai|ask gpt|ask claude|ask anthropic|ask perplexity|ask deepseek|ask grok/gi, "").trim() },
            provider: model
          })
        }).then(response => {
          if (!response.ok) throw new Error(`${model} API error: ${response.status}`);
          return response.json();
        }).then(data => {
          return { model, data };
        }).catch(error => {
          console.error(`Error with ${model} research:`, error);
          return { 
            model, 
            data: { 
              error: error.message,
              analysis: `Error with ${model} research: ${error.message}`
            }
          };
        });
      });

      // Wait for all promises to resolve
      const modelResults = await Promise.all(modelPromises);

      // Format results
      const formattedResults = modelResults.reduce((acc: Record<string, { content: string; error?: string; provider: string }>, { model, data }) => {
        acc[model] = {
          content: data.analysis || "No analysis available",
          error: data.error,
          provider: model
        };
        return acc;
      }, {} as Record<string, { content: string; error?: string; provider: string }>);

      setResults(formattedResults);
      setActiveTab(modelsToQuery[0] || "all");

      // Pass results to parent component if callback provided
      if (onResearchComplete) {
        onResearchComplete(formattedResults);
      }

      toast({
        title: "Research complete",
        description: `Got responses from ${Object.keys(formattedResults).length} ZHI models`
      });

    } catch (error) {
      console.error("Research error:", error);
      toast({
        title: "Research failed",
        description: error instanceof Error ? error.message : "Could not complete research",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle tab switching
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  // Get all available models from results
  const availableModels = Object.keys(results);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="research-instructions">Direct Research Instructions</Label>
        <Textarea
          id="research-instructions"
          placeholder="Example: ASK ZHI 2 ABOUT ceteris paribus clauses in physics. ASK ZHI 4 to find recent research papers."
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          className="min-h-[100px]"
        />
      </div>

      <div className="flex justify-between items-center">
        <Button
          onClick={handleDirectResearch}
          disabled={isLoading}
          className="flex items-center space-x-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Researching...</span>
            </>
          ) : (
            <>
              <Bot className="h-4 w-4" />
              <span>Get AI Research</span>
            </>
          )}
        </Button>

        <Button
          variant="outline"
          onClick={() => window.open('https://google.com', '_blank')}
          className="flex items-center space-x-2"
        >
          <Search className="h-4 w-4" />
          <span>Search Web</span>
        </Button>
      </div>

      {availableModels.length > 0 && (
        <div className="mt-6">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="w-full">
              {availableModels.map(model => (
                <TabsTrigger key={model} value={model} className="flex-1 capitalize">
                  {model === 'openai' ? 'ZHI 1' : model === 'anthropic' ? 'ZHI 2' : model === 'perplexity' ? 'ZHI 4' : model === 'deepseek' ? 'ZHI 3' : model === 'grok' ? 'ZHI 5' : model}
                </TabsTrigger>
              ))}
            </TabsList>

            {availableModels.map(model => (
              <TabsContent key={model} value={model} className="mt-2">
                <Card className="border-none">
                  <CardContent className="pt-4">
                    {results[model]?.error ? (
                      <div className="p-4 bg-red-50 text-red-600 rounded">
                        Error: {results[model].error}
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">
                        {results[model]?.content || "No content available"}
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

export default DirectModelResearch;