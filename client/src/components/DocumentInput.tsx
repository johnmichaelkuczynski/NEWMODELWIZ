import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileInput } from "@/components/ui/file-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { X, Upload, Bot, FileText, Mic, Trash2, CheckSquare, Square } from "lucide-react";
import { extractTextFromFile } from "@/lib/analysis";
import { DocumentInput as DocumentInputType } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import SimpleSpeechInput from "@/components/SimpleSpeechInput";
import { MathRenderer } from "@/components/MathRenderer";

interface DocumentInputProps {
  id: "A" | "B";
  document: DocumentInputType;
  setDocument: (document: DocumentInputType) => void;
  onCheckAI: () => void;
}

const DocumentInput: React.FC<DocumentInputProps> = ({
  id,
  document,
  setDocument,
  onCheckAI,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [showMathView, setShowMathView] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Calculate word and character count
  useEffect(() => {
    if (document.content) {
      // Count words by splitting on whitespace
      const words = document.content.trim().split(/\s+/).filter(Boolean);
      setWordCount(words.length);
      
      // Count characters excluding whitespace
      setCharCount(document.content.length);
    } else {
      setWordCount(0);
      setCharCount(0);
    }
  }, [document.content]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDocument({ ...document, content: e.target.value });
  };

  const handleContextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDocument({ ...document, context: e.target.value });
  };

  const handleClearText = () => {
    setDocument({ content: "", context: "" });
  };

  const handleFileUpload = async (file: File) => {
    try {
      setIsLoading(true);
      const result = await extractTextFromFile(file);
      setDocument(result);
    } catch (error) {
      console.error("Error extracting text from file:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await handleFileUpload(files[0]);
    }
  };

  // For real-time speech updates
  const [dictationActive, setDictationActive] = useState(false);
  
  // Handle dictated text
  const handleDictatedText = (text: string) => {
    // Simply set the document content to the dictated text
    // This will update in real-time as the user speaks
    setDocument({
      ...document,
      content: text
    });
  };

  // Handle chunk selection
  const handleChunkToggle = (chunkId: string, selected: boolean) => {
    const selectedChunkIds = document.selectedChunkIds || [];
    
    if (selected) {
      // Add chunk to selection
      setDocument({
        ...document,
        selectedChunkIds: [...selectedChunkIds, chunkId]
      });
    } else {
      // Remove chunk from selection
      setDocument({
        ...document,
        selectedChunkIds: selectedChunkIds.filter(id => id !== chunkId)
      });
    }
  };

  const handleSelectAllChunks = () => {
    if (!document.chunks) return;
    
    setDocument({
      ...document,
      selectedChunkIds: document.chunks.map(chunk => chunk.id)
    });
  };

  const handleDeselectAllChunks = () => {
    setDocument({
      ...document,
      selectedChunkIds: []
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Document {id}</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearText}
            className="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 flex items-center"
            title="Clear text"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onCheckAI}
            className="px-3 py-1 bg-amber-100 text-amber-800 hover:bg-amber-200 flex items-center"
          >
            <Bot className="h-4 w-4 mr-1" /> Check for AI
          </Button>
        </div>
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-4 mb-4 ${
          isDragging ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-gray-50"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="text-center py-8">
          <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 mb-2">Drag and drop your document or screenshot here</p>
          <p className="text-gray-500 text-sm mb-4">Supports .docx, .pdf, .txt files and images (.jpg, .png, .gif, .bmp, .webp)</p>
          <div className="flex justify-center">
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md cursor-pointer hover:bg-blue-700"
            >
              Browse Files
            </Button>
            <FileInput
              ref={fileInputRef}
              id={`fileInput${id}`}
              accept=".docx,.pdf,.txt,.jpg,.jpeg,.png,.gif,.bmp,.webp"
              onFileSelected={handleFileUpload}
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
        </div>
      ) : (
        <>
          <div className="mb-2 border-b border-gray-200 pb-2 flex justify-between items-center">
            <SimpleSpeechInput 
              onTextCaptured={handleDictatedText} 
              buttonLabel="Dictate Text" 
              className="mb-1"
            />
            {document.content && (document.content.includes('\\') || document.content.includes('^') || document.content.includes('_') || document.content.includes('$')) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMathView(!showMathView)}
                className="text-xs"
              >
                {showMathView ? "Normal View" : "View Math"}
              </Button>
            )}
          </div>

          {showMathView && document.content ? (
            <div className="w-full h-40 p-4 border border-gray-300 rounded-lg bg-gray-50 overflow-y-auto overflow-x-auto">
              <div style={{ minHeight: '100%', overflow: 'visible' }}>
                <MathRenderer content={document.content} className="text-gray-800" />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Textarea
                id={`textInput${id}`}
                placeholder="Type, paste, or dictate your text here..."
                className="w-full h-40 p-4 border border-gray-300 rounded-lg focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                value={document.content}
                onChange={handleTextChange}
              />
              
              {/* Context Input Field */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <label htmlFor={`contextInput${id}`} className="block text-sm font-medium text-gray-700 mb-2">
                  📋 Provide Relevant Information (Optional)
                </label>
                <input
                  id={`contextInput${id}`}
                  type="text"
                  placeholder='e.g., "This is an abstract", "This is a fragment of a book", "This is a complete essay"'
                  className="w-full px-3 py-2 border border-yellow-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  value={document.context || ''}
                  onChange={handleContextChange}
                />
                <p className="text-xs text-gray-600 mt-1">
                  Help the analysis understand what type of text this is for better assessment
                </p>
              </div>
            </div>
          )}

          {/* Chunk Selection Interface */}
          {document.chunks && document.chunks.length > 1 && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-blue-800">
                  Large Document Detected ({document.originalWordCount} words)
                </h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllChunks}
                    className="text-xs px-2 py-1"
                    data-testid="button-select-all-chunks"
                  >
                    <CheckSquare className="h-3 w-3 mr-1" />
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeselectAllChunks}
                    className="text-xs px-2 py-1"
                    data-testid="button-deselect-all-chunks"
                  >
                    <Square className="h-3 w-3 mr-1" />
                    Deselect All
                  </Button>
                </div>
              </div>
              
              <p className="text-xs text-blue-700 mb-3">
                Select which sections to analyze (each chunk is ~1000 words):
              </p>
              
              <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                {document.chunks.map((chunk, index) => {
                  const isSelected = document.selectedChunkIds?.includes(chunk.id) || false;
                  
                  return (
                    <Card key={chunk.id} className={`p-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-100 border-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}>
                      <div 
                        className="flex items-start gap-3"
                        onClick={() => handleChunkToggle(chunk.id, !isSelected)}
                        data-testid={`chunk-selector-${chunk.id}`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onChange={(e) => handleChunkToggle(chunk.id, (e.target as HTMLInputElement).checked)}
                          className="mt-0.5"
                          data-testid={`checkbox-${chunk.id}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <h4 className="text-xs font-semibold text-gray-700">
                              Chunk {index + 1}
                            </h4>
                            <Badge variant="secondary" className="text-xs px-1.5 py-0">
                              {chunk.wordCount} words
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-600 line-clamp-2">
                            {chunk.preview}
                          </p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
              
              <div className="mt-3 text-xs text-blue-700">
                {document.selectedChunkIds?.length || 0} of {document.chunks.length} chunks selected
              </div>
            </div>
          )}
          
          {/* Word and character count */}
          <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
            <div className="flex items-center">
              <FileText className="h-3 w-3 mr-1" />
              <span>
                <Badge variant="secondary" className="text-xs font-normal px-2 py-0">
                  {wordCount} words
                </Badge>
              </span>
              
              {/* Display PDF metadata if available */}
              {document.filename?.toLowerCase().endsWith('.pdf') && document.metadata?.pageCount && (
                <Badge variant="secondary" className="text-xs font-normal px-2 py-0 ml-2">
                  {document.metadata.pageCount} pages
                </Badge>
              )}
              
              {/* Display filename if available */}
              {document.filename && (
                <Badge variant="secondary" className="text-xs font-normal px-2 py-0 ml-2">
                  {document.filename}
                </Badge>
              )}
            </div>
            <div>
              <Badge variant="outline" className="text-xs font-normal px-2 py-0">
                {charCount} characters
              </Badge>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DocumentInput;
