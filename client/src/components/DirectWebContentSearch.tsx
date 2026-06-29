import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Globe, Search, RotateCw, FileEdit, ExternalLink } from "lucide-react";

interface DirectWebContentSearchProps {
  onRewriteWithContent: (selectedResults: any[], urlContents: any) => void;
  isRewriting: boolean;
}

const DirectWebContentSearch: React.FC<DirectWebContentSearchProps> = ({
  onRewriteWithContent,
  isRewriting
}) => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedResults, setSelectedResults] = useState<any[]>([]);
  const [urlContents, setUrlContents] = useState<{[key: string]: string}>({});

  const handleSearch = async () => {
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, numResults: 5 })
      });
      
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      
      const data = await response.json();
      
      if (data.success && data.results) {
        setSearchResults(data.results);
        toast({
          title: "Search completed",
          description: `Found ${data.results.length} relevant results`
        });
      } else {
        throw new Error(data.message || "Failed to search");
      }
    } catch (error) {
      console.error("Error searching:", error);
      toast({
        title: "Search failed",
        description: "Failed to search for relevant information",
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  const toggleResultSelection = (result: any) => {
    if (selectedResults.some(r => r.link === result.link)) {
      setSelectedResults(selectedResults.filter(r => r.link !== result.link));
    } else {
      setSelectedResults([...selectedResults, result]);
      fetchContent(result.link);
    }
  };

  const fetchContent = async (url: string) => {
    try {
      const response = await fetch("/api/fetch-url-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      
      const data = await response.json();
      
      if (data.success && data.content) {
        setUrlContents(prev => ({
          ...prev,
          [url]: data.content
        }));
      }
    } catch (error) {
      console.error(`Error fetching content from ${url}:`, error);
    }
  };

  return (
    <div className="space-y-4 border border-green-200 rounded-md p-4 bg-green-50/30">
      <div className="flex items-center gap-2 mb-1">
        <Globe className="h-5 w-5 text-green-600" />
        <h3 className="font-medium text-green-800">Web Content Search</h3>
      </div>
      <p className="text-sm text-green-700 mb-2">
        Search for relevant web content to enhance your document with factual information.
      </p>
      
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            placeholder="Enter search terms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button
          onClick={handleSearch}
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
      
      {searchResults.length > 0 && (
        <div className="space-y-2 max-h-[300px] overflow-y-auto border border-green-100 rounded-md p-2 bg-white">
          {searchResults.map((result, idx) => (
            <div 
              key={idx} 
              className={`p-2 rounded-md cursor-pointer border ${
                selectedResults.some(r => r.link === result.link) 
                  ? 'bg-green-100 border-green-300' 
                  : 'border-gray-100 hover:bg-gray-50'
              }`}
              onClick={() => toggleResultSelection(result)}
            >
              <div className="flex justify-between">
                <h4 className="text-sm font-medium text-blue-600">{result.title}</h4>
                {selectedResults.some(r => r.link === result.link) && (
                  <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                    Selected
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-1 mb-1">
                <a 
                  href={result.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 hover:underline"
                >
                  {result.link.substring(0, 40)}{result.link.length > 40 ? '...' : ''}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <p className="text-xs text-gray-700">{result.snippet}</p>
            </div>
          ))}
        </div>
      )}
      
      {selectedResults.length > 0 && (
        <div className="mt-3 pt-2 border-t border-green-200">
          <Button
            onClick={() => onRewriteWithContent(selectedResults, urlContents)}
            disabled={isRewriting}
            className="w-full"
          >
            {isRewriting ? (
              <>
                <RotateCw className="h-4 w-4 mr-2 animate-spin" />
                Rewriting with Web Content...
              </>
            ) : (
              <>
                <FileEdit className="h-4 w-4 mr-2" />
                Rewrite with Web Content ({selectedResults.length})
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default DirectWebContentSearch;