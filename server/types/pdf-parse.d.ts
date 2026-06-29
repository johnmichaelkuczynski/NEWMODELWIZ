declare module 'pdf-parse' {
  interface PDFData {
    text: string;
    numpages: number;
    numrender: number;
    info: Record<string, any>;
    metadata: Record<string, any>;
    version: string;
  }

  function PDFParse(dataBuffer: Buffer, options?: Record<string, any>): Promise<PDFData>;
  
  export = PDFParse;
}