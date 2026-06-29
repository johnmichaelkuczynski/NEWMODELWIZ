import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Send, Upload, Download, Mail, FileText, Paperclip, ArrowUpToLine, Database } from 'lucide-react';
import { MathRenderer } from './MathRenderer';
import CopyButton from '@/components/CopyButton';
import SendToButton from '@/components/SendToButton';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'text' | 'document' | 'chunk';
}

interface ChatDialogProps {
  currentDocument?: string;
  analysisResults?: any;
  onStreamingChunk?: (chunk: string, index: number, total: number) => void;
  onSendToInput?: (content: string) => void;
  onSendToHumanizer?: (text: string) => void;
  onSendToIntelligence?: (text: string) => void;
  onSendToChat?: (text: string) => void;
  onSendToValidator?: (text: string) => void;
}

type LLMProvider = "zhi1" | "zhi2" | "zhi3" | "zhi4" | "zhi5";

const AI_PROVIDERS = [
  { value: "zhi1", label: "Zhi 1" },
  { value: "zhi2", label: "Zhi 2" },
  { value: "zhi3", label: "Zhi 3" },
  { value: "zhi4", label: "Zhi 4" },
  { value: "zhi5", label: "Zhi 5" }
] as const;

export const ChatDialog: React.FC<ChatDialogProps> = ({
  currentDocument,
  analysisResults,
  onStreamingChunk,
  onSendToInput,
  onSendToHumanizer,
  onSendToIntelligence,
  onSendToChat,
  onSendToValidator
}) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState<string>("");
  const [selectedProvider, setSelectedProvider] = useState<LLMProvider>("zhi1");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [useExternalKnowledge, setUseExternalKnowledge] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendToInput = (content: string) => {
    if (onSendToInput) {
      onSendToInput(content);
      toast({
        title: "Content sent to input",
        description: "AI response has been added to the document input box"
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add streaming chunk to chat
  const addStreamingChunk = (chunk: string, index: number, total: number) => {
    const chunkMessage: ChatMessage = {
      id: `chunk-${Date.now()}-${index}`,
      role: 'assistant',
      content: `**Rewrite Chunk ${index}/${total}:**\n\n${chunk}`,
      timestamp: new Date(),
      type: 'chunk'
    };
    
    setMessages(prev => [...prev, chunkMessage]);
    if (onStreamingChunk) {
      onStreamingChunk(chunk, index, total);
    }
  };

  // Expose function globally for rewrite integration
  useEffect(() => {
    (window as any).addChatChunk = addStreamingChunk;
    return () => {
      delete (window as any).addChatChunk;
    };
  }, []);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputMessage,
      timestamp: new Date(),
      type: 'text'
    };

    setMessages(prev => [...prev, userMessage]);
    const currentQuestion = inputMessage;
    setInputMessage("");
    setIsLoading(true);

    try {
      // Build conversation history for API (only last 10 messages to avoid context overflow)
      const conversationHistory = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const response = await fetch('/api/chat-with-memory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentQuestion,
          conversationHistory: conversationHistory,
          currentDocument: currentDocument?.substring(0, 2000),
          analysisResults: analysisResults,
          provider: selectedProvider,
          useExternalKnowledge: useExternalKnowledge
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const assistantContent = data.content || data.response || "No response received";

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
        type: 'text'
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
        type: 'text'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsLoading(true);
      const response = await fetch('/api/extract-text', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      const documentMessage: ChatMessage = {
        id: `doc-${Date.now()}`,
        role: 'user',
        content: `**Uploaded Document: ${file.name}**\n\n${data.content}`,
        timestamp: new Date(),
        type: 'document'
      };

      setMessages(prev => [...prev, documentMessage]);
      
      toast({
        title: "Document uploaded",
        description: `${file.name} has been added to the chat`
      });

    } catch (error) {
      console.error("File upload error:", error);
      toast({
        title: "Upload failed",
        description: "Could not extract text from the file",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const exportChatAsPDF = () => {
    const chatContent = messages.map(msg => 
      `${msg.role.toUpperCase()} (${msg.timestamp.toLocaleString()})\n${msg.content}\n\n`
    ).join('');

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Chat Export</title>
          <script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
          <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
          <script>
            window.MathJax = {
              tex: {
                inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
                displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']]
              }
            };
          </script>
          <style>
            body { font-family: 'Times New Roman', serif; line-height: 1.6; margin: 1in; }
            .message { margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 10px; }
            .user { color: #0066cc; }
            .assistant { color: #006600; }
            .timestamp { font-size: 12px; color: #666; }
            @media print { body { margin: 0.5in; } }
          </style>
        </head>
        <body>
          <h1>Chat Export</h1>
          ${messages.map(msg => `
            <div class="message">
              <div class="${msg.role} timestamp">${msg.role.toUpperCase()} - ${msg.timestamp.toLocaleString()}</div>
              <div>${msg.content.split('\n').map(line => `<p>${line}</p>`).join('')}</div>
            </div>
          `).join('')}
          <script>
            window.onload = function() {
              setTimeout(() => { window.print(); window.close(); }, 2000);
            };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const exportChatAsWord = async () => {
    const chatContent = messages.map(msg => 
      `${msg.role.toUpperCase()} (${msg.timestamp.toLocaleString()})\n${msg.content}\n\n`
    ).join('');

    try {
      await navigator.clipboard.writeText(chatContent);
      toast({
        title: "Chat copied to clipboard",
        description: "Paste into Word to create document"
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Could not copy chat content",
        variant: "destructive"
      });
    }
  };

  const shareChatViaEmail = async () => {
    const chatContent = messages.map(msg => 
      `${msg.role.toUpperCase()} (${msg.timestamp.toLocaleString()})\n${msg.content}\n\n`
    ).join('');

    const recipientEmail = prompt("Enter recipient email:");
    if (!recipientEmail) return;

    try {
      const response = await fetch('/api/share-simple-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: recipientEmail,
          subject: "Chat Export",
          content: chatContent
        }),
      });

      if (response.ok) {
        toast({
          title: "Email sent successfully",
          description: `Chat shared with ${recipientEmail}`
        });
      } else {
        throw new Error('Failed to send email');
      }
    } catch (error) {
      toast({
        title: "Email failed to send",
        description: "Please try again later",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="w-full mt-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center space-x-2">
            <Send className="h-5 w-5" />
            <span>AI Chat Assistant</span>
          </span>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Database className={`h-4 w-4 ${useExternalKnowledge ? 'text-blue-600' : 'text-gray-400'}`} />
              <Label htmlFor="chat-external-knowledge" className="text-sm cursor-pointer">
                Zhi Database
              </Label>
              <Switch
                id="chat-external-knowledge"
                checked={useExternalKnowledge}
                onCheckedChange={setUseExternalKnowledge}
                data-testid="toggle-chat-external-knowledge"
              />
            </div>
            <Select value={selectedProvider} onValueChange={(value: LLMProvider) => setSelectedProvider(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_PROVIDERS.map((provider) => (
                  <SelectItem key={provider.value} value={provider.value}>
                    {provider.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Chat Messages */}
        <div className="border rounded-lg p-4 h-96 overflow-y-auto bg-gray-50 mb-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
              <p>Start a conversation with AI about your documents, analysis results, or anything else!</p>
              <p className="text-sm mt-2">You can also upload files directly to the chat.</p>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`mb-4 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                <div className={`inline-block max-w-[80%] ${
                  message.role === 'user' 
                    ? 'bg-blue-500 text-white p-3 rounded-lg' 
                    : message.type === 'chunk'
                    ? 'bg-green-100 text-green-800 border-l-4 border-green-500 p-3 rounded-lg'
                    : 'bg-white text-gray-800 border rounded-lg'
                }`}>
                  <div className="p-3">
                    <div className="text-xs opacity-70 mb-1">
                      {message.role === 'user' ? 'You' : selectedProvider.toUpperCase()} • {message.timestamp.toLocaleTimeString()}
                      {message.type === 'chunk' && ' • Streaming Chunk'}
                    </div>
                    <div className="whitespace-pre-wrap">
                      <MathRenderer content={message.content} />
                    </div>
                  </div>
                  {/* Copy and Send buttons for AI responses */}
                  {message.role === 'assistant' && (
                    <div className="border-t bg-gray-50 px-3 py-2 rounded-b-lg">
                      <div className="flex gap-2 flex-wrap">
                        <CopyButton text={message.content} size="sm" variant="outline" className="text-xs" />
                        <SendToButton 
                          text={message.content}
                          onSendToHumanizer={onSendToHumanizer}
                          onSendToIntelligence={onSendToIntelligence}
                          onSendToChat={onSendToChat}
                          onSendToValidator={onSendToValidator}
                          size="sm"
                          variant="outline"
                          className="text-xs"
                        />
                        {onSendToInput && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSendToInput(message.content)}
                            className="text-xs"
                          >
                            <ArrowUpToLine className="h-3 w-3 mr-1" />
                            Send to Input
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="text-left mb-4">
              <div className="inline-block bg-gray-200 text-gray-600 p-3 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
                  <span>AI is thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="space-y-3">
          <div className="flex space-x-2">
            <Textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask me anything about your documents, analysis results, or any topic..."
              className="flex-1"
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <div className="flex flex-col space-y-2">
              <Button 
                onClick={handleSendMessage} 
                disabled={isLoading || !inputMessage.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Send className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Export Options */}
          <div className="flex space-x-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={exportChatAsPDF}>
              <Download className="h-4 w-4 mr-1" />
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={exportChatAsWord}>
              <FileText className="h-4 w-4 mr-1" />
              Word
            </Button>
            <Button variant="outline" size="sm" onClick={shareChatViaEmail}>
              <Mail className="h-4 w-4 mr-1" />
              Email
            </Button>
          </div>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
          onChange={handleFileUpload}
          className="hidden"
        />
      </CardContent>
    </Card>
  );
};

export default ChatDialog;