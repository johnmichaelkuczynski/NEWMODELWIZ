import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AzureSpeechInputProps {
  onTextCaptured: (text: string) => void;
  className?: string;
  buttonLabel?: string;
}

// Component that uses Azure Speech Services for high-quality speech recognition
const AzureSpeechInput: React.FC<AzureSpeechInputProps> = ({
  onTextCaptured,
  className = '',
  buttonLabel = 'Dictate',
}) => {
  const [isListening, setIsListening] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Click to start speaking');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Toggle speech recognition
  const toggleSpeechRecognition = () => {
    if (isListening) {
      stopSpeechRecognition();
    } else {
      startSpeechRecognition();
    }
  };

  // Start speech recognition using Azure
  const startSpeechRecognition = async () => {
    try {
      setIsListening(true);
      setStatusMessage('Starting Azure Speech recognition...');
      
      // Create FormData to send to our backend
      const formData = new FormData();
      
      // Set up the AudioContext to capture user audio
      const audioContext = new AudioContext();
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(mediaStream);
      const audioChunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
          
          // For real-time transcription, we would process chunks here
          // But we'll wait until stopping to do full processing
          setStatusMessage('Listening... (Azure Speech)');
        }
      };
      
      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        setStatusMessage('Processing speech with Azure...');
        
        try {
          // Combine audio chunks into a single blob
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          
          // Add to form data
          formData.append('audio', audioBlob, 'recording.wav');
          
          // Send to our backend endpoint
          const response = await fetch('/api/speech-to-text', {
            method: 'POST',
            body: formData,
            headers: {
              'provider': 'azure'
            }
          });
          
          if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
          }
          
          const result = await response.json();
          
          if (result.text) {
            onTextCaptured(result.text);
            setStatusMessage('Speech transcription complete');
          } else {
            setStatusMessage('No speech detected. Please try again.');
          }
        } catch (error) {
          console.error('Error processing speech with Azure:', error);
          setStatusMessage('Error transcribing speech. Trying browser backup...');
          
          // Fall back to browser speech recognition
          useBrowserFallback();
        } finally {
          setIsProcessing(false);
          setIsListening(false);
        }
        
        // Stop all tracks to release microphone
        mediaStream.getTracks().forEach(track => track.stop());
      };
      
      // Store recorder in window for global access (for cleanup)
      (window as any).azureRecorder = mediaRecorder;
      
      // Start recording
      mediaRecorder.start(1000); // Get data every second for real-time updates
      
    } catch (error) {
      console.error('Error starting Azure speech recognition:', error);
      setStatusMessage('Error accessing microphone. Trying browser fallback...');
      
      // Fall back to browser speech recognition
      useBrowserFallback();
    }
  };

  // Stop speech recognition
  const stopSpeechRecognition = () => {
    try {
      if ((window as any).azureRecorder) {
        (window as any).azureRecorder.stop();
        setIsListening(false);
        setIsProcessing(true);
        setStatusMessage('Processing speech...');
      }
    } catch (error) {
      console.error('Error stopping Azure speech recognition:', error);
      setIsListening(false);
      setIsProcessing(false);
      setStatusMessage('Error stopping recognition');
    }
  };

  // Fallback to browser speech recognition if Azure fails
  const useBrowserFallback = () => {
    // Check browser support
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast({
        title: 'Speech Recognition Unavailable',
        description: 'Neither Azure nor browser speech recognition is available.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Use the Web Speech API
      toast({
        title: 'Using Browser Speech Recognition',
        description: 'Falling back to browser speech recognition.',
        variant: 'default',
      });
      
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      // Configure recognition
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      // Create variable to store transcript
      let finalTranscript = '';

      // Event handlers
      recognition.onstart = () => {
        setIsListening(true);
        setStatusMessage('Listening with browser recognition...');
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let currentFinalTranscript = finalTranscript;
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          
          if (event.results[i].isFinal) {
            currentFinalTranscript += transcript + ' ';
            finalTranscript = currentFinalTranscript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        // Show interim transcript and send updates
        if (interimTranscript) {
          setStatusMessage(`Listening: ${interimTranscript}`);
        }
        
        // Send both final and interim text for real-time display
        onTextCaptured(currentFinalTranscript + interimTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error('Browser speech recognition error:', event.error);
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
        setStatusMessage('Speech recognition stopped');
      };

      // Start recognition
      recognition.start();
      
      // Save recognition instance to window for cleanup
      (window as any).browserRecognition = recognition;
      
    } catch (error) {
      console.error('Error with browser speech fallback:', error);
      setIsListening(false);
      setIsProcessing(false);
      setStatusMessage('Speech recognition failed');
    }
  };

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      // Stop recorders/recognition if active
      if ((window as any).azureRecorder) {
        try {
          if ((window as any).azureRecorder.state !== 'inactive') {
            (window as any).azureRecorder.stop();
          }
        } catch (e) {
          console.error('Error cleaning up Azure recorder:', e);
        }
      }
      
      if ((window as any).browserRecognition) {
        try {
          (window as any).browserRecognition.stop();
        } catch (e) {
          console.error('Error cleaning up browser recognition:', e);
        }
      }
    };
  }, []);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        type="button"
        variant={isListening ? "destructive" : "outline"}
        size="icon"
        onClick={toggleSpeechRecognition}
        disabled={isProcessing}
        title={isListening ? "Stop dictating" : "Start dictating with Azure"}
      >
        {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </Button>
      
      <span className="text-sm text-gray-600">
        {isProcessing ? (
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
          disabled={isProcessing}
          className="ml-auto"
        >
          {isListening ? 'Stop' : buttonLabel}
        </Button>
      )}
    </div>
  );
};

export default AzureSpeechInput;