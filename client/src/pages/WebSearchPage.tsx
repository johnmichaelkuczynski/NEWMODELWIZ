import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { FileDown, Search, Loader2, ArrowLeft, ExternalLink, RefreshCw, FileText, Bot, BrainCircuit, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  selected?: boolean;
  content?: string;
}

interface AIResponse {
  provider: string;
  response: string;
}

const WebSearchPage: React.FC = () => {
  const { toast } = useToast();
  // Search settings
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInstructions, setSearchInstructions] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  
  // Selected content management
  const [selectedContents, setSelectedContents] = useState<{[url: string]: string}>({});
  const [isFetchingContent, setIsFetchingContent] = useState(false);
  
  // Rewrite settings
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [customInstructions, setCustomInstructions] = useState<string>('');
  const [integrationInstructions, setIntegrationInstructions] = useState<string>('');
  const [rewrittenContent, setRewrittenContent] = useState<string>('');
  const [aiResponses, setAiResponses] = useState<AIResponse[]>([]);
  const [isRewriting, setIsRewriting] = useState(false);
  
  // Keep count of selected items for display
  const selectedCount = searchResults.filter(r => r.selected).length;
  
  // Toggle selection of a search result
  const toggleResultSelection = (index: number) => {
    const newResults = [...searchResults];
    newResults[index].selected = !newResults[index].selected;
    setSearchResults(newResults);
  };
  
  // Handle web search - includes customized search instructions
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchResults([]);
    
    try {
      // First, search Google
      const googleResponse = await fetch('/api/search-google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query: searchQuery,
          numResults: 8
        }),
      });
      
      const googleData = await googleResponse.json();
      
      let results: SearchResult[] = [];
      
      if (googleData.success && googleData.results) {
        results = googleData.results.map((r: any) => ({...r, selected: false}));
      }
      
      // Then, get responses from all AI providers
      const aiProviders = ['openai', 'anthropic', 'perplexity'];
      
      const aiPromises = aiProviders.map(provider => 
        fetch('/api/rewrite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            originalText: `SEARCH QUERY: ${searchQuery}\n\nSEARCH INSTRUCTIONS: ${searchInstructions || "Provide relevant, factual information about this topic"}`,
            instructions: "Respond with comprehensive, factual information about this topic. Include relevant details, background, and context. Be objective and educational.",
            provider
          }),
        }).then(r => r.json())
      );
      
      const aiResults = await Promise.all(aiPromises);
      const newAiResponses: AIResponse[] = [];
      
      for (let i = 0; i < aiResults.length; i++) {
        if (aiResults[i].success) {
          newAiResponses.push({
            provider: aiProviders[i],
            response: aiResults[i].rewrittenText
          });
        }
      }
      
      setAiResponses(newAiResponses);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: 'Search Error',
        description: 'An error occurred while searching',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Handle fetching content from a URL
  const fetchContent = async (url: string, index: number) => {
    // If we already have the content, no need to fetch again
    if (selectedContents[url]) return;
    
    setIsFetchingContent(true);
    
    try {
      const response = await fetch('/api/fetch-url-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      
      const data = await response.json();
      
      if (data.success && data.content) {
        // Add content to the selectedContents map
        setSelectedContents(prev => ({
          ...prev,
          [url]: data.content
        }));
        
        // Also update the searchResults array
        const newResults = [...searchResults];
        newResults[index].content = data.content;
        setSearchResults(newResults);
        
        // Automatically select this result
        if (!newResults[index].selected) {
          toggleResultSelection(index);
        }
        
        toast({
          title: 'Content Retrieved',
          description: 'Successfully retrieved content from URL',
        });
      } else {
        toast({
          title: 'Content Fetch Failed',
          description: data.error || 'Failed to retrieve content from the URL',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Content fetch error:', error);
      toast({
        title: 'Content Fetch Error',
        description: 'An error occurred while fetching URL content',
        variant: 'destructive',
      });
    } finally {
      setIsFetchingContent(false);
    }
  };

  // Prepare combined content from all selected sources
  const prepareCombinedContent = () => {
    let combinedContent = '';
    
    // Add AI responses
    aiResponses.forEach(response => {
      combinedContent += `=== ${response.provider.toUpperCase()} RESPONSE ===\n\n`;
      combinedContent += `${response.response}\n\n`;
    });
    
    // Add selected web content
    const selectedResults = searchResults.filter(r => r.selected);
    selectedResults.forEach((result, i) => {
      const content = selectedContents[result.link] || '';
      if (content) {
        combinedContent += `=== WEB CONTENT ${i+1}: ${result.title} ===\n\n`;
        combinedContent += `${content.substring(0, 1000)}...\n\n`;
      }
    });
    
    return combinedContent;
  };

  // Handle rewriting with multiple sources
  const handleMultiSourceRewrite = async () => {
    const selectedResults = searchResults.filter(r => r.selected);
    if (selectedResults.length === 0 && aiResponses.length === 0) {
      toast({
        title: 'No Content Selected',
        description: 'Please select at least one search result or use AI responses',
        variant: 'destructive',
      });
      return;
    }
    
    setIsRewriting(true);
    
    const combinedContent = prepareCombinedContent();
    
    // Construct detailed instructions
    const detailedInstructions = `
REWRITE INSTRUCTIONS: ${customInstructions || 'Synthesize this information into a comprehensive, well-structured response'}

INTEGRATION INSTRUCTIONS: ${integrationInstructions || 'Combine all sources, prioritizing accuracy and comprehensiveness'}

USER SEARCH QUERY: ${searchQuery}

Your task is to create a comprehensive synthesis of the provided content according to the user's instructions.
`.trim();
    
    try {
      // Make separate requests to each provider if "all" is selected
      if (selectedProvider === 'all') {
        const providers = ['openai', 'anthropic', 'perplexity'];
        const promises = providers.map(provider => 
          fetch('/api/rewrite', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              originalText: combinedContent,
              instructions: detailedInstructions,
              provider
            }),
          }).then(r => r.json())
        );
        
        const results = await Promise.all(promises);
        let combinedResponse = '';
        
        for (let i = 0; i < results.length; i++) {
          if (results[i].success) {
            combinedResponse += `\n\n=== ${providers[i].toUpperCase()} REWRITE ===\n\n`;
            combinedResponse += results[i].rewrittenText;
          }
        }
        
        setRewrittenContent(combinedResponse);
      } else {
        // Single provider request
        const response = await fetch('/api/rewrite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            originalText: combinedContent,
            instructions: detailedInstructions,
            provider: selectedProvider
          }),
        });
        
        const data = await response.json();
        
        if (data.success && data.rewrittenText) {
          setRewrittenContent(data.rewrittenText);
        } else {
          throw new Error(data.error || 'Failed to rewrite content');
        }
      }
      
      toast({
        title: 'Rewrite Complete',
        description: 'Content has been successfully rewritten using selected sources',
      });
    } catch (error) {
      console.error('Rewrite error:', error);
      toast({
        title: 'Rewrite Error',
        description: 'An error occurred during the rewriting process',
        variant: 'destructive',
      });
    } finally {
      setIsRewriting(false);
    }
  };

  // Handle text file download
  const downloadAsText = () => {
    if (!rewrittenContent) return;
    
    const element = document.createElement('a');
    const file = new Blob([rewrittenContent], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `rewritten-content-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    
    toast({
      title: 'Download Complete',
      description: 'Your rewritten content has been downloaded as a text file',
    });
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center mb-6">
        <Link href="/">
          <Button variant="ghost" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Analysis
          </Button>
        </Link>
        <h1 className="text-2xl font-bold ml-4">Advanced Web Search & Multi-Source Rewrite</h1>
      </div>
      
      {/* Search Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Multi-AI Search Engine</CardTitle>
          <CardDescription>
            Search the web and get responses from multiple AI providers to customize your research
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search Query and Instructions */}
          <div className="space-y-4 mb-6">
            <div>
              <Label htmlFor="search-query" className="mb-2 block">Search Query</Label>
              <Input
                id="search-query"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter your search terms..."
                className="flex-1 mb-2"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            
            <div>
              <Label htmlFor="search-instructions" className="mb-2 block">Search Instructions (optional)</Label>
              <Textarea
                id="search-instructions"
                value={searchInstructions}
                onChange={(e) => setSearchInstructions(e.target.value)}
                placeholder="Specify what kind of information you're looking for (e.g., 'Find scholarly philosophical perspectives on consciousness' or 'Focus on economic data from 2020-2025')"
                className="h-20"
              />
            </div>
            
            <Button 
              onClick={handleSearch} 
              disabled={isSearching}
              className="min-w-[150px]"
            >
              {isSearching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Searching Multiple Sources...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Search Web & All AI Providers
                </>
              )}
            </Button>
          </div>
          
          {/* Search Results Tabbed Interface */}
          {(searchResults.length > 0 || aiResponses.length > 0) && (
            <Tabs defaultValue="webResults">
              <div className="flex justify-between items-center mb-4">
                <TabsList>
                  <TabsTrigger value="webResults">
                    Web Results ({searchResults.length})
                  </TabsTrigger>
                  <TabsTrigger value="aiResults">
                    AI Responses ({aiResponses.length})
                  </TabsTrigger>
                  {selectedCount > 0 && (
                    <TabsTrigger value="selected">
                      Selected ({selectedCount})
                    </TabsTrigger>
                  )}
                </TabsList>
                
                {/* Show selected count and rewrite button */}
                {(selectedCount > 0 || aiResponses.length > 0) && (
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="bg-blue-100 text-blue-800 font-medium">
                      {selectedCount} sources selected
                    </Badge>
                    <Button 
                      onClick={() => document.getElementById('rewrite-section')?.scrollIntoView({ behavior: 'smooth' })}
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Rewrite with Selected Sources
                    </Button>
                  </div>
                )}
              </div>
              
              {/* Web Results Tab */}
              <TabsContent value="webResults" className="space-y-4">
                {searchResults.length === 0 ? (
                  <p className="text-gray-500 italic">No web results found</p>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {searchResults.map((result, index) => (
                      <Card key={index} className={`border ${result.selected ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="pt-1">
                              <Checkbox 
                                checked={result.selected} 
                                onCheckedChange={() => toggleResultSelection(index)}
                                id={`result-${index}`}
                              />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium text-blue-600 mb-1">{result.title}</h4>
                              <p className="text-sm text-gray-500 mb-2 truncate">{result.link}</p>
                              <p className="text-sm mb-3">{result.snippet}</p>
                              
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => fetchContent(result.link, index)}
                                  disabled={isFetchingContent}
                                  className="flex items-center gap-1"
                                >
                                  {selectedContents[result.link] ? (
                                    <>
                                      <span className="h-2 w-2 bg-green-500 rounded-full mr-1"></span>
                                      Content Retrieved
                                    </>
                                  ) : (
                                    <>
                                      <ExternalLink className="h-3.5 w-3.5" />
                                      Get Full Content
                                    </>
                                  )}
                                </Button>
                                
                                {selectedContents[result.link] && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex items-center gap-1"
                                    onClick={() => toggleResultSelection(index)}
                                  >
                                    {result.selected ? 'Deselect' : 'Select for Rewrite'}
                                  </Button>
                                )}
                              </div>
                              
                              {/* Preview of content if retrieved */}
                              {selectedContents[result.link] && (
                                <div className="mt-3 p-2 bg-gray-50 rounded border text-xs max-h-24 overflow-y-auto">
                                  <p className="text-gray-600">
                                    {selectedContents[result.link].substring(0, 200)}...
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
              
              {/* AI Responses Tab */}
              <TabsContent value="aiResults" className="space-y-4">
                {aiResponses.length === 0 ? (
                  <p className="text-gray-500 italic">No AI responses available</p>
                ) : (
                  <div className="grid grid-cols-1 gap-6">
                    {aiResponses.map((response, index) => (
                      <Card key={index} className="border border-blue-200">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg flex items-center gap-2">
                            {response.provider === 'openai' && <Sparkles className="h-5 w-5 text-green-600" />}
                            {response.provider === 'anthropic' && <BrainCircuit className="h-5 w-5 text-purple-600" />}
                            {response.provider === 'perplexity' && <Bot className="h-5 w-5 text-blue-600" />}
                            {response.provider.charAt(0).toUpperCase() + response.provider.slice(1)} Response
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="bg-gray-50 p-3 rounded border text-sm max-h-96 overflow-y-auto">
                            <p className="whitespace-pre-wrap">{response.response}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
              
              {/* Selected Content Tab */}
              <TabsContent value="selected" className="space-y-4">
                {selectedCount === 0 ? (
                  <p className="text-gray-500 italic">No content selected yet</p>
                ) : (
                  <div className="space-y-4">
                    {searchResults.filter(r => r.selected).map((result, index) => (
                      <Card key={index} className="border-green-500">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-md flex items-center justify-between">
                            <span>{result.title}</span>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-red-600 hover:bg-red-50"
                              onClick={() => {
                                const resultIndex = searchResults.findIndex(r => r.link === result.link);
                                if (resultIndex >= 0) toggleResultSelection(resultIndex);
                              }}
                            >
                              Remove
                            </Button>
                          </CardTitle>
                          <CardDescription className="truncate">{result.link}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="bg-gray-50 p-3 rounded border text-xs max-h-32 overflow-y-auto">
                            <p>{selectedContents[result.link]?.substring(0, 200)}...</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
      
      {/* Rewrite Section */}
      <div id="rewrite-section" className="scroll-mt-8">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Multi-Source Rewrite Engine</CardTitle>
            <CardDescription>
              {selectedCount > 0 || aiResponses.length > 0 
                ? `Rewrite using ${selectedCount} selected web sources and ${aiResponses.length} AI responses` 
                : 'Select content sources from search results to begin'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Provider Selection */}
              <div>
                <Label htmlFor="provider-select">AI Provider for Rewrite</Label>
                <Select 
                  value={selectedProvider} 
                  onValueChange={setSelectedProvider}
                >
                  <SelectTrigger id="provider-select">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Models (Compare)</SelectItem>
                    <SelectItem value="openai">ZHI 1 Only</SelectItem>
                    <SelectItem value="anthropic">ZHI 2 Only</SelectItem>
                    <SelectItem value="perplexity">ZHI 4 Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Custom Rewrite Instructions */}
              <div>
                <Label htmlFor="custom-instructions">Custom Rewrite Instructions</Label>
                <Textarea
                  id="custom-instructions"
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="Specify how you want the content to be rewritten (e.g., 'Create a philosophical analysis that connects epistemological themes across these sources' or 'Synthesize into a technical report with empirical focus')"
                  className="h-24"
                />
              </div>
              
              {/* Integration Instructions */}
              <div>
                <Label htmlFor="integration-instructions">Source Integration Instructions</Label>
                <Textarea
                  id="integration-instructions"
                  value={integrationInstructions}
                  onChange={(e) => setIntegrationInstructions(e.target.value)}
                  placeholder="Specify exactly how to integrate multiple sources (e.g., 'Prioritize academic sources over AI responses' or 'Extract quantitative data from web content but use AI for theoretical frameworks')"
                  className="h-24"
                />
              </div>
              
              <Button 
                onClick={handleMultiSourceRewrite}
                disabled={isRewriting || (selectedCount === 0 && aiResponses.length === 0)}
                className="w-full py-6 text-lg"
              >
                {isRewriting ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Processing Multi-Source Rewrite...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-5 w-5 mr-2" />
                    Rewrite Selected Content
                  </>
                )}
              </Button>
              
              {/* Rewrite Results */}
              {rewrittenContent && (
                <div className="mt-8 border border-green-300 rounded-lg p-4 bg-green-50">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-green-800">Rewritten Content</h3>
                    <Button 
                      onClick={downloadAsText}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                    >
                      <FileText className="h-4 w-4" />
                      Download as Text File
                    </Button>
                  </div>
                  <div className="bg-white border rounded-md p-4 max-h-[500px] overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm">{rewrittenContent}</pre>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WebSearchPage;