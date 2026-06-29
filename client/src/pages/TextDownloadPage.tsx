import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

// Simple standalone page that allows direct text export
const TextDownloadPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const [text, setText] = useState<string>('');
  const downloadLinkRef = useRef<HTMLAnchorElement>(null);
  
  // Get text from localStorage if available
  useEffect(() => {
    const savedText = localStorage.getItem('textToDownload');
    if (savedText) {
      setText(savedText);
      localStorage.removeItem('textToDownload'); // Clean up
    }
  }, []);

  const handleDownload = () => {
    if (!text.trim()) return;
    
    // Create blob with the text content
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    // Trigger download
    if (downloadLinkRef.current) {
      downloadLinkRef.current.href = url;
      downloadLinkRef.current.download = `text-export-${new Date().toISOString().slice(0, 10)}.txt`;
      downloadLinkRef.current.click();
    }
    
    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  return (
    <div className="container mx-auto py-8">
      <a ref={downloadLinkRef} style={{ display: 'none' }}></a>
      
      <Button 
        variant="ghost" 
        onClick={() => setLocation('/')}
        className="mb-6 flex items-center gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Analysis
      </Button>
      
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Text Export</CardTitle>
          <CardDescription>
            View and download your text as a plain text (.txt) file
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Your text will appear here..."
            className="min-h-[300px] mb-4"
          />
          
          <Button 
            onClick={handleDownload}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg"
          >
            <FileText className="h-6 w-6" />
            DOWNLOAD AS TEXT FILE (.txt)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default TextDownloadPage;