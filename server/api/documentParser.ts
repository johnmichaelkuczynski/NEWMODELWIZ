import { DocumentInput } from "@/lib/types";
import { chunkText } from "@/lib/textUtils";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import pdfParse from 'pdf-parse';
import { extractWithMathpix } from './mathpixOCR';

/**
 * Helper function to apply chunking to extracted text if needed
 */
function applyChunkingIfNeeded(documentInput: DocumentInput): DocumentInput {
  const words = documentInput.content.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  
  // Only chunk if document has more than 1000 words
  if (wordCount > 1000) {
    const chunks = chunkText(documentInput.content, 1000);
    return {
      ...documentInput,
      chunks,
      originalWordCount: wordCount
    };
  }
  
  return documentInput;
}

/**
 * Extract text from a file based on its type
 */
export async function extractTextFromFile(
  file: Express.Multer.File
): Promise<DocumentInput> {
  try {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    let result: DocumentInput;
    
    switch (fileExtension) {
      case '.txt':
        result = await extractTextFromTxt(file);
        break;
      case '.docx':
        result = await extractTextFromDocx(file);
        break;
      case '.pdf':
        result = await extractTextFromPdf(file);
        break;
      case '.jpg':
      case '.jpeg':
      case '.png':
      case '.gif':
      case '.bmp':
      case '.webp':
        result = await extractTextFromImage(file);
        break;
      default:
        throw new Error(`Unsupported file type: ${fileExtension}. Supported types: .txt, .docx, .pdf, .jpg, .jpeg, .png, .gif, .bmp, .webp`);
    }
    
    // Apply chunking if the document is large
    return applyChunkingIfNeeded(result);
  } catch (error) {
    console.error("Error extracting text from file:", error);
    throw error;
  }
}

/**
 * Extract text from a TXT file
 */
async function extractTextFromTxt(file: Express.Multer.File): Promise<DocumentInput> {
  return {
    content: file.buffer.toString('utf-8'),
    filename: file.originalname,
    mimeType: file.mimetype
  };
}

/**
 * Extract text from a DOCX file using mammoth.js
 */
async function extractTextFromDocx(file: Express.Multer.File): Promise<DocumentInput> {
  try {
    // Save buffer to temporary file
    const tempFilePath = path.join(os.tmpdir(), `${Date.now()}-${file.originalname}`);
    fs.writeFileSync(tempFilePath, file.buffer);
    
    // Use dynamic import for mammoth (not a direct dependency)
    const mammoth = await import('mammoth');
    
    const result = await mammoth.extractRawText({
      path: tempFilePath
    });
    
    // Clean up temp file
    fs.unlinkSync(tempFilePath);
    
    return {
      content: result.value,
      filename: file.originalname,
      mimeType: file.mimetype
    };
  } catch (error) {
    console.error("Error extracting text from DOCX:", error);
    // Fallback to basic text extraction
    return {
      content: "Error extracting text from DOCX file. Please try another format or paste the text directly.",
      filename: file.originalname,
      mimeType: file.mimetype
    };
  }
}

/**
 * Extract text from a PDF file using pdf-parse
 */
async function extractTextFromPdf(file: Express.Multer.File): Promise<DocumentInput> {
  try {
    // Use pdf-parse to extract text directly from buffer
    const pdfData = await pdfParse(file.buffer);
    
    // Check if we got valid text content
    if (!pdfData.text || pdfData.text.trim().length === 0) {
      throw new Error("No text content could be extracted from PDF");
    }
    
    // Return the extracted text
    return {
      content: pdfData.text,
      filename: file.originalname,
      mimeType: file.mimetype,
      // Include additional metadata from the PDF
      metadata: {
        pageCount: pdfData.numpages,
        info: pdfData.info,
        version: pdfData.version
      }
    };
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    return {
      content: "Error extracting text from PDF file. The file may be password-protected, corrupted, or contain only images. Please try another format or paste the text directly.",
      filename: file.originalname,
      mimeType: file.mimetype
    };
  }
}

/**
 * Extract text from an image file using Mathpix OCR
 */
async function extractTextFromImage(file: Express.Multer.File): Promise<DocumentInput> {
  try {
    console.log(`Processing image file: ${file.originalname}`);
    
    const ocrResult = await extractWithMathpix(file.buffer, file.originalname);
    
    if (ocrResult.hasError) {
      return {
        content: `OCR Error: ${ocrResult.errorMessage}. Please try a different image or paste the text directly.`,
        filename: file.originalname,
        mimeType: file.mimetype,
        metadata: {
          ocrError: true,
          errorMessage: ocrResult.errorMessage
        }
      };
    }
    
    // Create a rich text description if we have LaTeX
    let content = ocrResult.extractedText;
    if (ocrResult.containsMath && ocrResult.latexFormatted) {
      content += `\n\n--- Mathematical Content (LaTeX) ---\n${ocrResult.latexFormatted}`;
    }
    
    return {
      content,
      filename: file.originalname,
      mimeType: file.mimetype,
      metadata: {
        ocrConfidence: ocrResult.confidence,
        containsMath: ocrResult.containsMath,
        latexFormatted: ocrResult.latexFormatted,
        autoRotated: ocrResult.metadata?.autoRotated,
        rotationDegrees: ocrResult.metadata?.rotationDegrees
      }
    };
  } catch (error) {
    console.error("Error extracting text from image:", error);
    return {
      content: `Error processing image: ${(error as Error).message}. Please try a different image or paste the text directly.`,
      filename: file.originalname,
      mimeType: file.mimetype,
      metadata: {
        ocrError: true,
        errorMessage: (error as Error).message
      }
    };
  }
}
