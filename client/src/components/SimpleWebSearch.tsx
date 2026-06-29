import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, ExternalLink, ArrowDown } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface WebSearchResult {
  title: string;
  link: string;
  snippet: string;
}

const SimpleWebSearch: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<WebSearchResult[]>([]);
  const [selectedContent, setSelectedContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');
  const [rewrittenText, setRewrittenText] = useState('');
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [showRewriteForm, setShowRewriteForm] = useState(false);
  
  // Perform web search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    setSearchResults([]);
    
    try {
      const response = await fetch('/api/search-google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchQuery, numResults: 10 }),
      });
      
      const data = await response.json();
      
      if (data.success && data.results) {
        setSearchResults(data.results);
      } else {
        console.error('Search failed:', data.error);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch content from a URL
  const fetchContent = async (url: string) => {
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
        setSelectedContent(data.content);
        setShowRewriteForm(true);
      } else {
        console.error('Content fetch failed:', data.error);
      }
    } catch (error) {
      console.error('Content fetch error:', error);
    }
  };
  
  // Handle rewrite with custom instructions
  const handleRewrite = async () => {
    if (!selectedContent) return;
    
    setRewriteLoading(true);
    
    try {
      const response = await fetch('/api/rewrite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: selectedContent,
          instructions: customInstructions || 'Improve this text while maintaining its meaning',
          provider: 'openai' // You can change this or make it a selectable option
        }),
      });
      
      const data = await response.json();
      
      if (data.success && data.rewrittenText) {
        setRewrittenText(data.rewrittenText);
      } else {
        console.error('Rewrite failed:', data.error);
      }
    } catch (error) {
      console.error('Rewrite error:', error);
    } finally {
      setRewriteLoading(false);
    }
  };
  
  // Download as text file
  const downloadAsText = () => {
    if (!rewrittenText) return;
    
    const element = document.createElement('a');
    const file = new Blob([rewrittenText], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `rewritten-text-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="w-full space-y-6">
      <h2 className="text-2xl font-bold text-center mb-4">Web Content Search & Rewrite</h2>
      
      {/* Search Input */}
      <div className="flex gap-2">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Enter search terms..."
          className="flex-1"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={isLoading}>
          {isLoading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Searching...
            </span>
          ) : (
            <span className="flex items-center">
              <Search className="mr-2 h-4 w-4" />
              Search
            </span>
          )}
        </Button>
      </div>
      
      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Search Results:</h3>
          <div className="grid grid-cols-1 gap-4">
            {searchResults.map((result, index) => (
              <Card key={index} className="border border-gray-200 hover:border-blue-300 transition-colors">
                <CardContent className="p-4">
                  <h4 className="font-semibold text-blue-600 mb-1">{result.title}</h4>
                  <p className="text-sm text-gray-500 mb-2">{result.link}</p>
                  <p className="text-sm mb-3">{result.snippet}</p>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => fetchContent(result.link)}
                    className="flex items-center gap-1"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Get Content
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      
      {/* Selected Content and Rewrite Form */}
      {selectedContent && showRewriteForm && (
        <div className="mt-8 space-y-4 p-4 border border-blue-200 rounded-lg bg-blue-50">
          <h3 className="text-lg font-semibold">Content to Rewrite:</h3>
          <div className="bg-white p-3 rounded border border-gray-200 max-h-60 overflow-y-auto">
            <p className="text-sm whitespace-pre-wrap">{selectedContent}</p>
          </div>
          
          <div className="pt-4">
            <label className="block text-sm font-medium mb-2">Custom Rewrite Instructions:</label>
            <Textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="Enter specific instructions for rewriting this content..."
              className="w-full h-24"
            />
          </div>
          
          <Button
            onClick={handleRewrite}
            disabled={rewriteLoading}
            className="w-full"
          >
            {rewriteLoading ? 'Rewriting...' : 'Rewrite Content'}
          </Button>
        </div>
      )}
      
      {/* Rewritten Text Result */}
      {rewrittenText && (
        <div className="mt-8 space-y-4 p-4 border border-green-200 rounded-lg bg-green-50">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Rewritten Text:</h3>
            <Button onClick={downloadAsText} variant="outline" size="sm" className="flex items-center gap-1">
              <ArrowDown className="h-3.5 w-3.5" />
              Download as TXT
            </Button>
          </div>
          <div className="bg-white p-3 rounded border border-gray-200 max-h-80 overflow-y-auto">
            <p className="whitespace-pre-wrap">{rewrittenText}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleWebSearch;