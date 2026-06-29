import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Mic, MicOff, Loader2 } from 'lucide-react';

// Add type definitions for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

interface BrowserSpeechToTextProps {
  onTextCaptured: (text: string) => void;
  placeholder?: string;
  buttonLabel?: string;
  className?: string;
}

// Use the Web Speech API provided by modern browsers
const BrowserSpeechToText: React.FC<BrowserSpeechToTextProps> = ({
  onTextCaptured,
  placeholder = 'Click the microphone to start speaking...',
  buttonLabel = 'Speak',
  className = '',
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState(placeholder);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const { toast } = useToast();

  // Initialize speech recognition when component mounts
  useEffect(() => {
    // Check if the browser supports SpeechRecognition
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setStatusMessage('Speech recognition is not supported in this browser.');
      toast({
        title: 'Browser Not Supported',
        description: 'Speech recognition is not available in your browser. Try using Chrome, Edge, or Safari.',
        variant: 'destructive',
      });
      return;
    }

    // Initialize speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognitionInstance = new SpeechRecognition();
    
    // Configure recognition
    recognitionInstance.continuous = true;
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = 'en-US';
    
    // Store recognition instance
    setRecognition(recognitionInstance);
    
    // Clean up recognition when component unmounts
    return () => {
      if (recognitionInstance) {
        recognitionInstance.stop();
      }
    };
  }, [toast]);

  // Event handlers for recognition
  useEffect(() => {
    if (!recognition) return;

    let finalTranscript = '';
    
    recognition.onstart = () => {
      setIsListening(true);
      setStatusMessage('Listening... Speak now');
    };
    
    recognition.onend = () => {
      setIsListening(false);
      
      if (finalTranscript) {
        setStatusMessage('Speech captured successfully.');
        onTextCaptured(finalTranscript);
      } else {
        setStatusMessage(placeholder);
      }
      
      setIsProcessing(false);
    };
    
    recognition.onresult = (event) => {
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }
      
      // Update status with interim results
      if (interimTranscript) {
        setStatusMessage(`Listening: ${interimTranscript}`);
      }
    };
    
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      
      setIsListening(false);
      setIsProcessing(false);
      
      if (event.error === 'not-allowed') {
        setStatusMessage('Microphone access denied. Please check your browser permissions.');
        toast({
          title: 'Microphone Access Denied',
          description: 'Please allow microphone access in your browser settings to use speech recognition.',
          variant: 'destructive',
        });
      } else {
        setStatusMessage(`Error: ${event.error}. Please try again.`);
      }
    };
    
  }, [recognition, onTextCaptured, placeholder, toast]);

  // Function to toggle listening
  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Start speech recognition
  const startListening = () => {
    if (!recognition) {
      toast({
        title: 'Speech Recognition Unavailable',
        description: 'Speech recognition is not available in your browser.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      recognition.start();
      setIsProcessing(true);
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      setStatusMessage('Error starting speech recognition. Please try again.');
      setIsProcessing(false);
      toast({
        title: 'Recognition Error',
        description: 'Failed to start speech recognition. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Stop speech recognition
  const stopListening = () => {
    if (recognition) {
      try {
        recognition.stop();
        setStatusMessage('Processing speech...');
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
    }
  };

  return (
    <div className={`flex flex-col items-start space-y-2 ${className}`}>
      <div className="flex items-center space-x-2 w-full">
        <Button
          type="button"
          variant={isListening ? "destructive" : "outline"}
          size="icon"
          onClick={toggleListening}
          disabled={isProcessing && !isListening}
        >
          {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        <div className="text-sm text-gray-700 flex-1">
          {isProcessing && !isListening ? (
            <div className="flex items-center">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {statusMessage}
            </div>
          ) : (
            statusMessage
          )}
        </div>
        {buttonLabel && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleListening}
            disabled={isProcessing && !isListening}
          >
            {isListening ? 'Stop' : buttonLabel}
          </Button>
        )}
      </div>
    </div>
  );
};

export default BrowserSpeechToText;