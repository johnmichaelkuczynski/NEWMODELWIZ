import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SimpleSpeechInputProps {
  onTextCaptured: (text: string) => void;
  className?: string;
  buttonLabel?: string;
}

const SimpleSpeechInput: React.FC<SimpleSpeechInputProps> = ({
  onTextCaptured,
  className = '',
  buttonLabel = 'Dictate',
}) => {
  const [isListening, setIsListening] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Click to start speaking');
  const [isProcessing, setIsProcessing] = useState(false);
  const [initialText, setInitialText] = useState('');
  const { toast } = useToast();

  // Toggle speech recognition
  const toggleSpeechRecognition = () => {
    if (isListening) {
      stopSpeechRecognition();
    } else {
      startSpeechRecognition();
    }
  };

  // Start speech recognition
  const startSpeechRecognition = () => {
    // Check browser support
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast({
        title: 'Browser Not Supported',
        description: 'Your browser does not support speech recognition. Try using Chrome, Edge, or Safari.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Use the Web Speech API
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      // Configure recognition
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      // Log the start of speech recognition
      console.log('Starting browser speech recognition...');

      // Create variable to store transcript
      let finalTranscript = '';

      // Event handlers
      recognition.onstart = () => {
        setIsListening(true);
        setStatusMessage('Listening... Speak now');
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let currentFinalTranscript = finalTranscript;
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          
          if (event.results[i].isFinal) {
            currentFinalTranscript += transcript + ' ';
            finalTranscript = currentFinalTranscript; // Update the final transcript
          } else {
            interimTranscript += transcript;
          }
        }
        
        // Show the interim transcript
        if (interimTranscript) {
          setStatusMessage(`Listening: ${interimTranscript}`);
        }
        
        // Send both final and interim text to be displayed in real-time
        onTextCaptured(currentFinalTranscript + interimTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setIsProcessing(false);
        
        if (event.error === 'not-allowed') {
          setStatusMessage('Microphone access denied');
          toast({
            title: 'Microphone Access Denied',
            description: 'Please allow microphone access in your browser settings.',
            variant: 'destructive',
          });
        } else {
          setStatusMessage(`Error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        setIsProcessing(false);
        
        // We've already been sending text in real-time,
        // so we don't need to send it again here
        setStatusMessage('Speech recognition stopped');
      };

      // Start recognition
      recognition.start();
      
      // Save recognition instance to window for easy cleanup
      (window as any).currentRecognition = recognition;
      
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      setStatusMessage('Failed to start speech recognition');
      toast({
        title: 'Recognition Error',
        description: 'Could not start speech recognition. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Stop speech recognition
  const stopSpeechRecognition = () => {
    try {
      if ((window as any).currentRecognition) {
        (window as any).currentRecognition.stop();
        setIsProcessing(true);
        setStatusMessage('Processing speech...');
      }
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
      setIsListening(false);
      setIsProcessing(false);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        type="button"
        variant={isListening ? "destructive" : "outline"}
        size="icon"
        onClick={toggleSpeechRecognition}
        disabled={isProcessing && !isListening}
        title={isListening ? "Stop dictating" : "Start dictating"}
      >
        {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </Button>
      
      <span className="text-sm text-gray-600">
        {isProcessing && !isListening ? (
          <span className="flex items-center">
            <Loader2 className="h-3 w-3 mr-2 animate-spin" />
            {statusMessage}
          </span>
        ) : (
          statusMessage
        )}
      </span>
      
      {buttonLabel && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleSpeechRecognition}
          disabled={isProcessing && !isListening}
          className="ml-auto"
        >
          {isListening ? 'Stop' : buttonLabel}
        </Button>
      )}
    </div>
  );
};

export default SimpleSpeechInput;