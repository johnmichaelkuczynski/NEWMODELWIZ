import fetch from 'node-fetch';
import { Buffer } from 'buffer';

interface MathpixResponse {
  text: string;
  latex_styled?: string;
  confidence?: number;
  error?: string;
  auto_rotate_confidence?: number;
  auto_rotate_degrees?: number;
}

interface OCRResult {
  extractedText: string;
  latexFormatted?: string;
  confidence: number;
  hasError: boolean;
  errorMessage?: string;
  containsMath: boolean;
  metadata?: {
    autoRotated?: boolean;
    rotationDegrees?: number;
  };
}

/**
 * Extract text and mathematical notation from an image using Mathpix OCR
 * @param imageBuffer Buffer containing the image data
 * @param filename Original filename (for reference)
 * @returns OCR extraction result
 */
export async function extractWithMathpix(imageBuffer: Buffer, filename: string): Promise<OCRResult> {
  try {
    const appId = process.env.MATHPIX_APP_ID;
    const appKey = process.env.MATHPIX_APP_KEY;

    if (!appId || !appKey) {
      throw new Error("Mathpix credentials not configured. Please set MATHPIX_APP_ID and MATHPIX_APP_KEY environment variables.");
    }

    console.log(`Processing image with Mathpix OCR: ${filename}`);
    console.log(`Image size: ${imageBuffer.length} bytes`);

    // Convert buffer to base64
    const base64Image = imageBuffer.toString('base64');
    const mimeType = getMimeTypeFromFilename(filename);

    // Prepare the request to Mathpix API with simplified, reliable settings
    const requestBody = {
      src: `data:${mimeType};base64,${base64Image}`,
      formats: ["text", "latex_styled"],
      data_options: {
        include_asciimath: true,
        include_latex: true
      }
    };

    console.log("Sending request to Mathpix API...");

    const response = await fetch('https://api.mathpix.com/v3/text', {
      method: 'POST',
      headers: {
        'app_id': appId,
        'app_key': appKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json() as MathpixResponse;

    if (!response.ok) {
      throw new Error(data.error || `Mathpix API error: ${response.status}`);
    }

    console.log("Mathpix OCR completed successfully");
    console.log("Raw Mathpix response:", JSON.stringify(data, null, 2));

    // Check if the response contains mathematical notation
    const containsMath = !!(data.latex_styled && data.latex_styled.length > 0 && 
                           (data.latex_styled.includes('\\') || 
                            data.latex_styled.includes('$') || 
                            data.latex_styled.includes('^') || 
                            data.latex_styled.includes('_') ||
                            data.latex_styled.includes('frac') ||
                            data.latex_styled.includes('sum') ||
                            data.latex_styled.includes('int') ||
                            data.latex_styled.includes('alpha') ||
                            data.latex_styled.includes('beta') ||
                            data.latex_styled.includes('gamma') ||
                            data.latex_styled.includes('mathrm')));

    // Prepare the result
    const result: OCRResult = {
      extractedText: data.text || '',
      latexFormatted: data.latex_styled,
      confidence: data.confidence || 0.9,
      hasError: false,
      containsMath,
      metadata: {
        autoRotated: data.auto_rotate_degrees !== undefined && data.auto_rotate_degrees !== 0,
        rotationDegrees: data.auto_rotate_degrees
      }
    };

    console.log(`OCR extracted ${result.extractedText.length} characters`);
    console.log(`Contains math: ${containsMath}`);
    console.log(`Confidence: ${result.confidence}`);

    return result;

  } catch (error: any) {
    console.error("Error in Mathpix OCR:", error);
    
    return {
      extractedText: '',
      confidence: 0,
      hasError: true,
      errorMessage: error.message || 'Unknown OCR error',
      containsMath: false
    };
  }
}

/**
 * Determine MIME type from filename
 */
function getMimeTypeFromFilename(filename: string): string {
  const extension = filename.toLowerCase().split('.').pop();
  
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'bmp':
      return 'image/bmp';
    case 'webp':
      return 'image/webp';
    default:
      return 'image/jpeg'; // Default fallback
  }
}

/**
 * Check if Mathpix service is available
 */
export async function checkMathpixStatus(): Promise<{ available: boolean; message: string }> {
  try {
    const appId = process.env.MATHPIX_APP_ID;
    const appKey = process.env.MATHPIX_APP_KEY;

    if (!appId || !appKey) {
      return {
        available: false,
        message: "Mathpix credentials not configured"
      };
    }

    return {
      available: true,
      message: "Mathpix OCR service is available"
    };
  } catch (error) {
    return {
      available: false,
      message: `Mathpix service error: ${(error as Error).message}`
    };
  }
}

export default {
  extractWithMathpix,
  checkMathpixStatus
};