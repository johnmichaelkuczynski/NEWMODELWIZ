import fs from 'fs';
import path from 'path';
import os from 'os';
import { Request } from 'express';
import multer from 'multer';

// We'll dynamically import AssemblyAI when needed to avoid startup issues

// Configure temporary storage for audio files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(os.tmpdir(), 'speech-uploads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniquePrefix + '-' + file.originalname);
  }
});

// Create the multer upload middleware
export const upload = multer({ storage });

/**
 * Transcribe audio using AssemblyAI
 * @param filePath Path to the audio file
 * @returns Transcription text
 */
export async function transcribeWithAssemblyAI(filePath: string): Promise<string> {
  const assemblyAPIKey = process.env.ASSEMBLYAI_API_KEY;
  
  if (!assemblyAPIKey) {
    throw new Error('AssemblyAI API key not configured');
  }
  
  try {
    console.log('Transcribing with AssemblyAI:', filePath);
    
    const client = new AssemblyAI({ apiKey: assemblyAPIKey });
    
    // Read the file for direct upload
    const audioFile = fs.readFileSync(filePath);
    
    // Upload the audio file 
    const transcript = await client.transcripts.transcribe({
      audio: audioFile,
      language_code: 'en_us'
    });
    
    console.log('AssemblyAI transcription complete');
    
    // Check if we got text back
    if (!transcript.text) {
      throw new Error('No transcription text returned');
    }
    
    return transcript.text;
  } catch (error) {
    console.error('AssemblyAI transcription error:', error);
    throw error;
  }
}

/**
 * Transcribe audio using Gladia
 * @param filePath Path to the audio file
 * @returns Transcription text
 */
export async function transcribeWithGladia(filePath: string): Promise<string> {
  const gladiaAPIKey = process.env.GLADIA_API_KEY;
  
  if (!gladiaAPIKey) {
    throw new Error('Gladia API key not configured');
  }
  
  try {
    console.log('Transcribing with Gladia:', filePath);
    
    // Create a form with the audio file
    const form = new FormData();
    const audioBlob = new Blob([fs.readFileSync(filePath)], { type: 'audio/wav' });
    form.append('audio', audioBlob, path.basename(filePath));
    form.append('language', 'english');
    form.append('toggle_diarization', 'false');
    
    // Make the API request
    const response = await fetch('https://api.gladia.io/v2/transcription/', {
      method: 'POST',
      headers: {
        'x-gladia-key': gladiaAPIKey,
      },
      body: form,
    });
    
    if (!response.ok) {
      throw new Error(`Gladia API error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('Gladia transcription complete');
    
    if (!result.prediction) {
      throw new Error('No transcription prediction returned');
    }
    
    return result.prediction;
  } catch (error) {
    console.error('Gladia transcription error:', error);
    throw error;
  }
}

/**
 * Transcribe audio using Azure Speech Services
 * @param filePath Path to the audio file
 * @returns Transcription text
 */
export async function transcribeWithAzure(filePath: string): Promise<string> {
  const speechKey = process.env.AZURE_SPEECH_KEY;
  const speechRegion = process.env.AZURE_SPEECH_REGION;
  
  if (!speechKey || !speechRegion) {
    throw new Error('Azure Speech API key or region not configured');
  }
  
  try {
    console.log('Transcribing with Azure Speech:', filePath);
    
    // For now, we'll use a simpler approach with Azure REST API
    // This is a placeholder for actual Azure Speech SDK integration
    // We would need to import the SDK dynamically to avoid startup errors
    
    throw new Error('Azure Speech integration not yet implemented. Please use AssemblyAI or Gladia.');
    
    // When the Azure Speech SDK is properly installed, we would:
    // 1. Create a speech config from subscription
    // 2. Create an audio config from the file
    // 3. Create a speech recognizer and process the audio
    // 4. Return the transcription
    
  } catch (error) {
    console.error('Azure transcription error:', error);
    throw error;
  }
}

/**
 * Process the audio file with the selected speech-to-text provider
 * @param request Express request containing the audio file and provider
 * @returns Text transcription
 */
export async function processSpeechToText(request: Request): Promise<string> {
  try {
    if (!request.file) {
      throw new Error('No audio file provided');
    }
    
    const filePath = request.file.path;
    const provider = request.headers['provider'] as string || 'assemblyai';
    
    console.log(`Processing speech using provider: ${provider}`);
    
    let transcription = '';
    
    // Process with the selected provider
    switch (provider) {
      case 'assemblyai':
        transcription = await transcribeWithAssemblyAI(filePath);
        break;
      case 'gladia':
        transcription = await transcribeWithGladia(filePath);
        break;
      case 'azure':
        transcription = await transcribeWithAzure(filePath);
        break;
      default:
        // Default to AssemblyAI
        transcription = await transcribeWithAssemblyAI(filePath);
    }
    
    // Clean up the temporary file
    fs.unlinkSync(filePath);
    
    return transcription;
  } catch (error) {
    console.error('Speech processing error:', error);
    throw error;
  }
}