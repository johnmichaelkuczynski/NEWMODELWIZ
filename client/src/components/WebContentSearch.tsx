import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Globe, Search, Check, RotateCw, ExternalLink } from "lucide-react";

interface WebContentSearchProps {
  initialQuery?: string;
  onContentSelected: (content: any[]) => void;
}

const WebContentSearch: React.FC<WebContentSearchProps> = ({ 
  initialQuery = "", 
  onContentSelected 
}) => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState<string>(initialQuery);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedResults, setSelectedResults] = useState<any[]>([]);
  const [urlContents, setUrlContents] = useState<{[key: string]: string}>({});

  // Function to perform the web search
  const performSearch = async () => {
    if (!searchQuery) {
      toast({
        title: "Search query required",
        description: "Please enter a search term",
        variant: "destructive"
      });
      return;
    }
    
    setIsSearching(true);
    try {
      const response = await fetch("/api/search-google", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query: searchQuery,
          numResults: 5
        })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.results) {
        setSearchResults(data.results);
        toast({
          title: "Search completed",
          description: `Found ${data.results.length} relevant results`,
        });
      } else {
        throw new Error(data.message || "Failed to search");
      }
    } catch (error) {
      console.error("Error searching web:", error);
      toast({
        title: "Search failed",
        description: "Failed to search for relevant information. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Toggle selection of a search result
  const toggleResult = (result: any) => {
    if (selectedResults.some(r => r.link === result.link)) {
      // Remove from selection
      setSelectedResults(selectedResults.filter(r => r.link !== result.link));
    } else {
      // Add to selection and fetch content
      setSelectedResults([...selectedResults, result]);
      fetchContent(result.link);
    }
  };

  // Fetch content from a URL
  const fetchContent = async (url: string) => {
    try {
      const response = await fetch("/api/fetch-url-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success && data.content) {
        setUrlContents(prev => ({
          ...prev,
          [url]: data.content
        }));
      }
    } catch (error) {
      console.error(`Error fetching content from ${url}:`, error);
      toast({
        title: "Content fetch failed",
        description: `Could not load content from ${url}`,
        variant: "destructive"
      });
    }
  };

  // When selection changes, notify parent component
  useEffect(() => {
    const selectedContent = selectedResults.map(result => ({
      title: result.title,
      link: result.link,
      snippet: result.snippet,
      content: urlContents[result.link] || ""
    }));
    
    onContentSelected(selectedContent);
  }, [selectedResults, urlContents]);

  return (
    <div className="web-content-search">
      <div className="mb-4 bg-blue-50 border border-blue-200 rounded-md p-3">
        <h3 className="text-sm font-medium text-blue-900 flex items-center gap-1.5">
          <Globe className="h-4 w-4" />
          Web Content Search
        </h3>
        <p className="text-xs text-blue-700 mt-1">
          Search for relevant web content to enhance your rewrite with factual information and context.
        </p>
      </div>
      
      <div className="flex gap-2 mb-4">
        <div className="flex-1">
          <Label htmlFor="web-search-query">Search Query</Label>
          <Input
            id="web-search-query"
            placeholder="Enter search terms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <Button
            onClick={performSearch}
            disabled={isSearching || !searchQuery}
          >
            {isSearching ? (
              <>
                <RotateCw className="h-4 w-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Search
              </>
            )}
          </Button>
        </div>
      </div>
      
      {/* Search results */}
      {searchResults.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 rounded-md border border-gray-100">
          <Globe className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">
            {isSearching ? 'Searching...' : 'Enter a search query and click "Search" to find relevant information'}
          </p>
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium">Search Results</h3>
            <span className="text-sm text-gray-500">Click to select content</span>
          </div>
          
          <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-1">
            {searchResults.map((result, idx) => (
              <Card 
                key={idx} 
                className={`${
                  selectedResults.some(r => r.link === result.link) 
                    ? 'border-green-400 bg-green-50' 
                    : ''
                } cursor-pointer transition-colors`}
                onClick={() => toggleResult(result)}
              >
                <CardHeader className="p-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <CardTitle className="text-base text-blue-600">
                        {result.title}
                      </CardTitle>
                      <CardDescription className="text-xs truncate">
                        <a 
                          href={result.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 hover:underline"
                        >
                          {result.link.substring(0, 50)}{result.link.length > 50 ? '...' : ''}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </CardDescription>
                    </div>
                    {selectedResults.some(r => r.link === result.link) && (
                      <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <p className="text-sm text-gray-700">{result.snippet}</p>
                  
                  {selectedResults.some(r => r.link === result.link) && urlContents[result.link] && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-xs font-medium text-gray-600 mb-1">Content Preview:</p>
                      <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded-sm max-h-20 overflow-y-auto">
                        {urlContents[result.link].substring(0, 300)}...
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          
          {selectedResults.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">
                  {selectedResults.length} result{selectedResults.length !== 1 ? 's' : ''} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedResults([])}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WebContentSearch;