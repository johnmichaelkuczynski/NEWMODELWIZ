import fs from 'fs';
import path from 'path';
import os from 'os';
import { Request } from 'express';
import multer from 'multer';

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
    
    // Import AssemblyAI dynamically
    const { AssemblyAI } = await import('assemblyai');
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
 * Transcribe audio using Gladia API
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
    
    // Create form data for API request
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(filePath);
    
    // Convert buffer to blob for form data
    const blob = new Blob([fileBuffer], { type: 'audio/wav' });
    formData.append('audio', blob, path.basename(filePath));
    formData.append('language', 'english');
    formData.append('toggle_diarization', 'false');
    
    // Make API request to Gladia
    const response = await fetch('https://api.gladia.io/v2/transcription/', {
      method: 'POST',
      headers: {
        'x-gladia-key': gladiaAPIKey,
      },
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`Gladia API error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json() as any;
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