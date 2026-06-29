import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Mic, MicOff, Loader2 } from 'lucide-react';

// Define the speech service providers
type SpeechProvider = 'assemblyai' | 'gladia' | 'azure';

interface SpeechToTextProps {
  onTextCaptured: (text: string) => void;
  provider?: SpeechProvider;
  placeholder?: string;
  buttonLabel?: string;
  className?: string;
}

export const SpeechToText: React.FC<SpeechToTextProps> = ({
  onTextCaptured,
  provider = 'assemblyai',
  placeholder = 'Click the microphone to start speaking...',
  buttonLabel = 'Speak',
  className = '',
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState(placeholder);
  const audioChunks = useRef<Blob[]>([]);
  const mediaRecorder = useRef<MediaRecorder | null>(null);

  // Function to toggle listening
  const toggleListening = async () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Start the speech recognition based on the selected provider
  const startListening = async () => {
    try {
      setIsListening(true);
      setStatusMessage('Listening... Speak now');
      
      // For all providers, we'll use the browser's MediaRecorder API
      startBrowserRecording();
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      setIsListening(false);
      setStatusMessage('Error starting speech recognition. Please try again.');
      toast({
        title: 'Speech Recognition Error',
        description: 'Could not start the speech recognition. Please check your microphone permissions.',
        variant: 'destructive',
      });
    }
  };

  // Stop the speech recognition
  const stopListening = () => {
    setIsListening(false);
    setStatusMessage('Processing your speech...');
    setIsProcessing(true);

    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
    }
  };

  // Start browser recording for all providers
  const startBrowserRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      audioChunks.current = [];
      mediaRecorder.current = new MediaRecorder(stream);
      
      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };
      
      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
        
        if (provider === 'assemblyai') {
          processWithAssemblyAI(audioBlob);
        } else if (provider === 'gladia') {
          processWithGladia(audioBlob);
        } else if (provider === 'azure') {
          processWithAzure(audioBlob);
        } else {
          // Default to AssemblyAI as a fallback
          processWithAssemblyAI(audioBlob);
        }
        
        // Stop all tracks in the stream
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.current.start();
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setIsListening(false);
      setIsProcessing(false);
      setStatusMessage('Could not access microphone. Please check your permissions.');
      toast({
        title: 'Microphone Error',
        description: 'Could not access your microphone. Please check your browser permissions.',
        variant: 'destructive',
      });
    }
  };

  // Process recorded audio with AssemblyAI
  const processWithAssemblyAI = async (audioBlob: Blob) => {
    try {
      setStatusMessage('Processing with AssemblyAI...');
      
      // Convert Blob to File
      const file = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });
      
      // Create form data for the API request
      const formData = new FormData();
      formData.append('audio', file);
      
      // Send to our server endpoint that will handle the API call
      const response = await fetch('/api/speech-to-text', {
        method: 'POST',
        body: formData,
        headers: {
          'provider': 'assemblyai'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.text) {
        onTextCaptured(result.text);
        setStatusMessage('Speech processing completed.');
      } else {
        setStatusMessage('No speech detected. Please try again.');
      }
    } catch (error) {
      console.error('AssemblyAI processing error:', error);
      setStatusMessage('Error processing speech. Please try again.');
      toast({
        title: 'Processing Error',
        description: 'There was an error processing your speech with AssemblyAI.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Process recorded audio with Gladia
  const processWithGladia = async (audioBlob: Blob) => {
    try {
      setStatusMessage('Processing with Gladia...');
      
      // Create form data for the API request
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
      
      // Send to our server endpoint that will handle the API call
      const response = await fetch('/api/speech-to-text', {
        method: 'POST',
        body: formData,
        headers: {
          'provider': 'gladia'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.text) {
        onTextCaptured(result.text);
        setStatusMessage('Speech processing completed.');
      } else {
        setStatusMessage('No speech detected. Please try again.');
      }
    } catch (error) {
      console.error('Gladia processing error:', error);
      setStatusMessage('Error processing speech. Please try again.');
      toast({
        title: 'Processing Error',
        description: 'There was an error processing your speech with Gladia.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Process recorded audio with Azure
  const processWithAzure = async (audioBlob: Blob) => {
    try {
      setStatusMessage('Processing with Azure Speech Services...');
      
      // Create form data for the API request
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
      
      // Send to our server endpoint that will handle the API call
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
        setStatusMessage('Speech processing completed.');
      } else {
        setStatusMessage('No speech detected. Please try again.');
      }
    } catch (error) {
      console.error('Azure processing error:', error);
      setStatusMessage('Error processing speech. Please try again.');
      toast({
        title: 'Processing Error',
        description: 'There was an error processing your speech with Azure Speech Services.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Clean up event listeners and resources
  useEffect(() => {
    return () => {
      if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
        mediaRecorder.current.stop();
      }
    };
  }, []);

  return (
    <div className={`flex flex-col items-start space-y-2 ${className}`}>
      <div className="flex items-center space-x-2 w-full">
        <Button
          type="button"
          variant={isListening ? "destructive" : "outline"}
          size="icon"
          onClick={toggleListening}
          disabled={isProcessing}
        >
          {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        <div className="text-sm text-gray-700 flex-1">
          {isProcessing ? (
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
            disabled={isProcessing}
          >
            {isListening ? 'Stop' : buttonLabel}
          </Button>
        )}
      </div>
    </div>
  );
};

export default SpeechToText;