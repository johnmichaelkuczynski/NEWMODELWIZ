import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TranslationOptions, TranslationProgress } from "../lib/types";
import { extractTextFromFile } from "../lib/analysis";
import { AlertCircle, FileText, Languages, Upload, Copy, Download, Check, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

// Language options for translation
const languageOptions = [
  { value: "auto", label: "Auto-detect" },
  { value: "english", label: "English" },
  { value: "spanish", label: "Spanish" },
  { value: "french", label: "French" },
  { value: "german", label: "German" },
  { value: "italian", label: "Italian" },
  { value: "portuguese", label: "Portuguese" },
  { value: "russian", label: "Russian" },
  { value: "japanese", label: "Japanese" },
  { value: "chinese", label: "Chinese" },
  { value: "korean", label: "Korean" },
  { value: "arabic", label: "Arabic" },
];

export function TranslationInput() {
  const { toast } = useToast();
  const [sourceLanguage, setSourceLanguage] = useState("auto");
  const [targetLanguage, setTargetLanguage] = useState("");
  const [inputContent, setInputContent] = useState("");
  const [inputMethod, setInputMethod] = useState<"upload" | "paste">("paste"); // Default to paste for easier use
  const [fileName, setFileName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<TranslationProgress | null>(null);
  const [translatedContent, setTranslatedContent] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [translateWordCount, setTranslateWordCount] = useState(0);
  const [translateCharCount, setTranslateCharCount] = useState(0);
  const [hasCopied, setHasCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const downloadLinkRef = useRef<HTMLAnchorElement>(null);
  
  // Calculate word and character count for input text
  useEffect(() => {
    if (inputContent) {
      // Count words by splitting on whitespace
      const words = inputContent.trim().split(/\s+/).filter(Boolean);
      setWordCount(words.length);
      
      // Count characters
      setCharCount(inputContent.length);
    } else {
      setWordCount(0);
      setCharCount(0);
    }
  }, [inputContent]);
  
  // Calculate word and character count for translated text
  useEffect(() => {
    if (translatedContent) {
      // Count words by splitting on whitespace
      const words = translatedContent.trim().split(/\s+/).filter(Boolean);
      setTranslateWordCount(words.length);
      
      // Count characters
      setTranslateCharCount(translatedContent.length);
    } else {
      setTranslateWordCount(0);
      setTranslateCharCount(0);
    }
  }, [translatedContent]);

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError("");
    setFileName(file.name);

    try {
      const result = await extractTextFromFile(file);
      setInputContent(result.content);
    } catch (err) {
      setError("Failed to extract text from the uploaded file.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Add copy functionality
  const handleCopyText = () => {
    if (!translatedContent) return;
    
    navigator.clipboard.writeText(translatedContent);
    setHasCopied(true);
    toast({
      title: "Copied to clipboard",
      description: "The translated text has been copied to your clipboard."
    });
    
    setTimeout(() => {
      setHasCopied(false);
    }, 2000);
  };
  
  // Add download functionality
  const handleDownload = () => {
    if (!translatedContent) return;
    
    const blob = new Blob([translatedContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    if (downloadLinkRef.current) {
      downloadLinkRef.current.href = url;
      downloadLinkRef.current.download = `translated-text-${new Date().toISOString().slice(0, 10)}.txt`;
      downloadLinkRef.current.click();
    }
    
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };
  
  // Handle starting the translation process
  const handleTranslate = async () => {
    if (!inputContent) {
      setError("Please provide content to translate.");
      return;
    }

    // Auto is allowed for source language
    if (sourceLanguage !== "auto" && !sourceLanguage) {
      setError("Please select a source language.");
      return;
    }

    if (!targetLanguage) {
      setError("Please select a target language.");
      return;
    }

    if (sourceLanguage !== "auto" && sourceLanguage === targetLanguage) {
      setError("Source and target languages cannot be the same.");
      return;
    }

    setIsLoading(true);
    setError("");
    setProgress({
      currentChunk: 0,
      totalChunks: 1,
      status: "processing"
    });
    setTranslatedContent("");

    // Options for translation
    const options: TranslationOptions = {
      sourceLanguage,
      targetLanguage,
      model: "gpt-4o", // Default ZHI 1 model
    };

    try {
      // Using server-sent events to monitor progress
      const eventSource = new EventSource(`/api/translate?_=${Date.now()}`);
      
      // Start translation by posting the content
      fetch("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: inputContent,
          options,
          filename: fileName,
        }),
      }).catch(err => {
        console.error("Translation request error:", err);
        setError("Failed to start translation. Please try again.");
        eventSource.close();
        setIsLoading(false);
      });

      // Handle progress updates
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setProgress(data);

        // If translation is completed or failed, clean up
        if (data.status === "completed") {
          setTranslatedContent(data.translatedContent || "");
          eventSource.close();
          setIsLoading(false);
        } else if (data.status === "failed") {
          setError(data.error || "Translation failed. Please try again.");
          eventSource.close();
          setIsLoading(false);
        }
      };

      // Handle EventSource errors
      eventSource.onerror = () => {
        setError("Lost connection to the server. Please try again.");
        eventSource.close();
        setIsLoading(false);
      };
    } catch (err) {
      console.error("Error setting up translation:", err);
      setError("Failed to set up translation. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Languages className="h-6 w-6" />
            Large Document Translation
          </CardTitle>
          <CardDescription>
            Translate documents up to 500,000 words using advanced AI models.
            The system handles large content by breaking it into manageable chunks.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs 
            defaultValue="paste" 
            value={inputMethod}
            onValueChange={(value) => setInputMethod(value as "upload" | "paste")}
            className="mb-6"
          >
            <TabsList className="mb-4">
              <TabsTrigger value="upload" className="flex items-center gap-1">
                <Upload className="h-4 w-4" />
                Upload File
              </TabsTrigger>
              <TabsTrigger value="paste" className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                Paste Text
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload">
              <div className="mb-4">
                <Label htmlFor="file-upload">Upload a document (PDF, DOCX, TXT)</Label>
                <div className="mt-2">
                  <Input
                    id="file-upload"
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".txt,.pdf,.doc,.docx"
                    disabled={isLoading}
                  />
                </div>
                {fileName && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Selected file: {fileName}
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="paste">
              <div className="mb-4">
                <Label htmlFor="paste-content">Paste text to translate</Label>
                <Textarea
                  id="paste-content"
                  placeholder="Enter text to translate..."
                  className="min-h-[200px] mt-2"
                  value={inputContent}
                  onChange={(e) => setInputContent(e.target.value)}
                  disabled={isLoading}
                />
                {inputContent && (
                  <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                    <div className="flex items-center">
                      <FileText className="h-3 w-3 mr-1" />
                      <span>
                        <Badge variant="secondary" className="text-xs font-normal px-2 py-0">
                          {wordCount} words
                        </Badge>
                      </span>
                    </div>
                    <div>
                      <Badge variant="outline" className="text-xs font-normal px-2 py-0">
                        {charCount} characters
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <Label htmlFor="source-language">Source Language</Label>
              <Select 
                value={sourceLanguage} 
                onValueChange={setSourceLanguage} 
                disabled={isLoading}
              >
                <SelectTrigger id="source-language" className="mt-2">
                  <SelectValue placeholder="Select source language" />
                </SelectTrigger>
                <SelectContent>
                  {languageOptions.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="target-language">Target Language</Label>
              <Select 
                value={targetLanguage} 
                onValueChange={setTargetLanguage} 
                disabled={isLoading}
              >
                <SelectTrigger id="target-language" className="mt-2">
                  <SelectValue placeholder="Select target language" />
                </SelectTrigger>
                <SelectContent>
                  {languageOptions.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {progress && (
            <div className="mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">
                  {progress.status === 'processing' ? 'Translating...' : 
                   progress.status === 'completed' ? 'Translation complete!' : 
                   'Failed'}
                </span>
                <span className="text-sm text-muted-foreground">
                  {progress.currentChunk} of {progress.totalChunks} chunks
                </span>
              </div>
              <Progress 
                value={progress.totalChunks ? (progress.currentChunk / progress.totalChunks) * 100 : 0} 
                className="h-2"
              />
            </div>
          )}

          {translatedContent && (
            <div className="mt-6">
              <div className="flex justify-between items-center mb-2">
                <Label htmlFor="translated-content">Translation Result</Label>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleCopyText}
                    className="flex gap-1 items-center"
                  >
                    {hasCopied ? (
                      <>
                        <Check className="h-3 w-3" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copy
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleDownload}
                    className="flex gap-1 items-center"
                  >
                    <Download className="h-3 w-3" />
                    Download
                  </Button>
                </div>
              </div>
              
              <Textarea
                id="translated-content"
                className="min-h-[200px]"
                value={translatedContent}
                readOnly
              />
              
              {/* Word count for translated text */}
              <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                <div className="flex items-center">
                  <FileText className="h-3 w-3 mr-1" />
                  <span>
                    <Badge variant="secondary" className="text-xs font-normal px-2 py-0">
                      {translateWordCount} words
                    </Badge>
                  </span>
                </div>
                <div>
                  <Badge variant="outline" className="text-xs font-normal px-2 py-0">
                    {translateCharCount} characters
                  </Badge>
                </div>
              </div>
            </div>
          )}
          
          {/* Hidden download link for the translated file */}
          <a 
            ref={downloadLinkRef} 
            style={{ display: 'none' }}
          />
        </CardContent>

        <CardFooter className="flex gap-2 justify-end">
          {/* Reset button */}
          {(inputContent || translatedContent) && !isLoading && (
            <Button 
              variant="outline" 
              onClick={() => {
                setInputContent("");
                setTranslatedContent("");
                setFileName("");
                setProgress(null);
                setError("");
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
              className="flex items-center gap-1"
            >
              <RefreshCw className="h-4 w-4" />
              Reset
            </Button>
          )}
          
          <Button 
            onClick={handleTranslate} 
            disabled={isLoading || !inputContent || !targetLanguage}
            className={isLoading ? "opacity-80" : ""}
          >
            {isLoading ? "Translating..." : "Translate"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}