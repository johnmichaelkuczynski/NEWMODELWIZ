import React from 'react';
import { DocumentAnalysis } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BrainCircuit, Download, Copy, FileText, FileType, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { jsPDF } from "jspdf";
import SimpleShareViaEmailModal from './SimpleShareViaEmailModal';

interface FullReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysis: DocumentAnalysis;
  originalText?: string;
}

const FullReportDialog: React.FC<FullReportDialogProps> = ({
  open,
  onOpenChange,
  analysis,
  originalText = ''
}) => {
  const { toast } = useToast();
  const [showEmailModal, setShowEmailModal] = React.useState(false);
  const downloadLinkRef = React.useRef<HTMLAnchorElement>(null);

  // Create the comprehensive report content
  const createReportContent = () => {
    // Build a comprehensive report with all details
    let report = `INTELLIGENCE ANALYSIS REPORT
===========================
Overall Intelligence Score: ${analysis.overallScore}/100

${analysis.overallAssessment || ''}

DETAILED ANALYSIS
----------------
${analysis.analysis || ''}

`;

    // Add surface-level scores
    if (analysis.surface) {
      report += `\nSURFACE-LEVEL SCORES:\n`;
      Object.entries(analysis.surface).forEach(([key, value]) => {
        const formattedKey = key.replace(/([A-Z])/g, ' $1').trim();
        report += `- ${formattedKey.charAt(0).toUpperCase() + formattedKey.slice(1)}: ${value}\n`;
      });
    }

    // Add deep-level scores
    if (analysis.deep) {
      report += `\nDEEP-LEVEL SCORES:\n`;
      Object.entries(analysis.deep).forEach(([key, value]) => {
        const formattedKey = key.replace(/([A-Z])/g, ' $1').trim();
        report += `- ${formattedKey.charAt(0).toUpperCase() + formattedKey.slice(1)}: ${value}\n`;
      });
    }

    // Add dimension analysis with full descriptions and evidence
    if (analysis.dimensions) {
      report += `\nDIMENSION ANALYSIS:\n`;
      Object.entries(analysis.dimensions).forEach(([key, dimension]) => {
        const formattedKey = key.replace(/([A-Z])/g, ' $1').trim();
        report += `\n${formattedKey.charAt(0).toUpperCase() + formattedKey.slice(1)}:\n`;
        report += `Rating: ${dimension.rating}\n`;
        report += `Description: ${dimension.description}\n`;
        if (dimension.quote) {
          report += `Evidence: "${dimension.quote}"\n`;
        }
      });
    }

    // Add original text if available
    if (originalText) {
      report += `\n\nANALYZED TEXT:\n----------------\n${originalText}\n`;
    }

    return report;
  };

  // Handle copying to clipboard
  const handleCopy = () => {
    const reportText = createReportContent();
    navigator.clipboard.writeText(reportText);
    toast({
      title: 'Copied to clipboard',
      description: 'Full report copied to clipboard successfully'
    });
  };
  
  // Export as plain text
  const exportToTxt = () => {
    const content = createReportContent();
    const blob = new Blob([content], { type: 'text/plain' });
    triggerDownload(blob, `intelligence-analysis-${new Date().toISOString().slice(0, 10)}.txt`);
  };

  // Export as Word document
  const exportToWord = async () => {
    // Prepare document children array
    const children = [
      new Paragraph({
        text: "INTELLIGENCE ANALYSIS REPORT",
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        thematicBreak: true,
      }),
      new Paragraph({
        text: "",
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "Overall Intelligence Score: ",
            bold: true,
          }),
          new TextRun({
            text: `${analysis.overallScore}/100`,
          }),
        ],
        spacing: { after: 200 },
      }),
      new Paragraph({
        text: analysis.overallAssessment || 'No assessment available',
        spacing: { after: 400 },
      }),
    ];
    
    // Add detailed analysis if available
    if (analysis.analysis) {
      children.push(
        new Paragraph({
          text: "DETAILED ANALYSIS",
          heading: HeadingLevel.HEADING_2,
          spacing: { after: 200 },
        }),
        new Paragraph({
          text: analysis.analysis,
          spacing: { after: 400 },
        })
      );
    }

    // Add surface-level scores if available
    if (analysis.surface) {
      children.push(
        new Paragraph({
          text: "SURFACE-LEVEL SCORES",
          heading: HeadingLevel.HEADING_2,
          spacing: { after: 200 },
        })
      );
      
      Object.entries(analysis.surface).forEach(([key, value]) => {
        const formattedKey = key.replace(/([A-Z])/g, ' $1').trim();
        children.push(
          new Paragraph({
            children: [
              new TextRun({ 
                text: formattedKey.charAt(0).toUpperCase() + formattedKey.slice(1) + ": ", 
                bold: true 
              }),
              new TextRun({ 
                text: typeof value === 'number' ? `${value}/100` : String(value || 'N/A')
              }),
            ],
            spacing: { after: 100 },
          })
        );
      });
    }
    
    // Add deep-level scores if available
    if (analysis.deep) {
      children.push(
        new Paragraph({
          text: "DEEP-LEVEL SCORES",
          heading: HeadingLevel.HEADING_2,
          spacing: { after: 200 },
        })
      );
      
      Object.entries(analysis.deep).forEach(([key, value]) => {
        const formattedKey = key.replace(/([A-Z])/g, ' $1').trim();
        children.push(
          new Paragraph({
            children: [
              new TextRun({ 
                text: formattedKey.charAt(0).toUpperCase() + formattedKey.slice(1) + ": ", 
                bold: true 
              }),
              new TextRun({ 
                text: typeof value === 'number' ? `${value}/100` : String(value || 'N/A')
              }),
            ],
            spacing: { after: 100 },
          })
        );
      });
    }

    // Add dimensions if available
    if (analysis.dimensions) {
      children.push(
        new Paragraph({
          text: "DIMENSION ANALYSIS",
          heading: HeadingLevel.HEADING_2,
          spacing: { after: 200 },
        })
      );
      
      Object.entries(analysis.dimensions).forEach(([key, dimension]) => {
        const formattedKey = key.replace(/([A-Z])/g, ' $1').trim();
        
        children.push(
          new Paragraph({
            text: formattedKey.charAt(0).toUpperCase() + formattedKey.slice(1),
            heading: HeadingLevel.HEADING_3,
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Rating: ", bold: true }),
              new TextRun({ text: dimension.rating || 'N/A' }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Description: ", bold: true }),
              new TextRun({ text: dimension.description || 'No description available' }),
            ],
            spacing: { after: 100 },
          })
        );
        
        if (dimension.quote) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: "Evidence: ", bold: true, italics: true }),
                new TextRun({ text: `"${dimension.quote}"`, italics: true }),
              ],
              spacing: { after: 200 },
            })
          );
        }
      });
    }
    
    // Create the document with all the children
    const doc = new Document({
      sections: [{
        properties: {},
        children: children
      }]
    });

    const buffer = await Packer.toBuffer(doc);
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    triggerDownload(blob, `intelligence-analysis-${new Date().toISOString().slice(0, 10)}.docx`);
  };

  // Export as PDF
  const exportToPDF = () => {
    const pdf = new jsPDF();
    let yPosition = 20;
    
    // Helper function to manage page space
    const ensureSpaceForContent = (neededSpace: number) => {
      if (yPosition + neededSpace > 280) {
        pdf.addPage();
        yPosition = 20;
      }
    };
    
    // Set title
    pdf.setFontSize(18);
    pdf.text("INTELLIGENCE ANALYSIS REPORT", 105, yPosition, { align: 'center' });
    yPosition += 15;
    
    // Overall score
    pdf.setFontSize(14);
    pdf.text(`Overall Intelligence Score: ${analysis.overallScore}/100`, 20, yPosition);
    yPosition += 10;
    
    // Add overall assessment with word wrapping
    const assessmentText = analysis.overallAssessment || 'No assessment available';
    const splitAssessment = pdf.splitTextToSize(assessmentText, 170);
    
    ensureSpaceForContent(splitAssessment.length * 6);
    pdf.setFontSize(11);
    pdf.text(splitAssessment, 20, yPosition);
    yPosition += splitAssessment.length * 6 + 10;
    
    // Add the detailed analysis if available
    if (analysis.analysis) {
      ensureSpaceForContent(15);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", 'bold');
      pdf.text("DETAILED ANALYSIS", 20, yPosition);
      pdf.setFont("helvetica", 'normal');
      yPosition += 10;
      
      const splitAnalysis = pdf.splitTextToSize(analysis.analysis, 170);
      ensureSpaceForContent(splitAnalysis.length * 5);
      pdf.setFontSize(10);
      pdf.text(splitAnalysis, 20, yPosition);
      yPosition += splitAnalysis.length * 5 + 15;
    }
    
    // Add surface-level scores if available
    if (analysis.surface) {
      ensureSpaceForContent(Object.keys(analysis.surface).length * 8 + 15);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", 'bold');
      pdf.text("SURFACE-LEVEL SCORES", 20, yPosition);
      pdf.setFont("helvetica", 'normal');
      yPosition += 10;
      
      pdf.setFontSize(10);
      Object.entries(analysis.surface).forEach(([key, value]) => {
        const formattedKey = key.replace(/([A-Z])/g, ' $1').trim();
        const displayKey = formattedKey.charAt(0).toUpperCase() + formattedKey.slice(1);
        const displayValue = typeof value === 'number' ? `${value}/100` : String(value || 'N/A');
        
        pdf.setFont("helvetica", 'bold');
        pdf.text(`${displayKey}:`, 20, yPosition);
        pdf.setFont("helvetica", 'normal');
        pdf.text(displayValue, 100, yPosition);
        yPosition += 8;
      });
      
      yPosition += 5;
    }
    
    // Add deep-level scores if available
    if (analysis.deep) {
      ensureSpaceForContent(Object.keys(analysis.deep).length * 8 + 15);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", 'bold');
      pdf.text("DEEP-LEVEL SCORES", 20, yPosition);
      pdf.setFont("helvetica", 'normal');
      yPosition += 10;
      
      pdf.setFontSize(10);
      Object.entries(analysis.deep).forEach(([key, value]) => {
        const formattedKey = key.replace(/([A-Z])/g, ' $1').trim();
        const displayKey = formattedKey.charAt(0).toUpperCase() + formattedKey.slice(1);
        const displayValue = typeof value === 'number' ? `${value}/100` : String(value || 'N/A');
        
        pdf.setFont("helvetica", 'bold');
        pdf.text(`${displayKey}:`, 20, yPosition);
        pdf.setFont("helvetica", 'normal');
        pdf.text(displayValue, 100, yPosition);
        yPosition += 8;
      });
      
      yPosition += 5;
    }
    
    // Add dimension analysis
    if (analysis.dimensions) {
      ensureSpaceForContent(15);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", 'bold');
      pdf.text("DETAILED DIMENSIONS WITH EVIDENCE", 20, yPosition);
      pdf.setFont("helvetica", 'normal');
      yPosition += 10;
      
      pdf.setFontSize(10);
      Object.entries(analysis.dimensions).forEach(([key, dimension]) => {
        const formattedKey = key.replace(/([A-Z])/g, ' $1').trim();
        const displayKey = formattedKey.charAt(0).toUpperCase() + formattedKey.slice(1);
        
        // Estimate space needed for this dimension
        let dimensionSpace = 25; // Basic space for headings
        if (dimension.description) {
          const descLines = pdf.splitTextToSize(dimension.description, 165).length;
          dimensionSpace += descLines * 5;
        }
        if (dimension.quote) {
          const quoteLines = pdf.splitTextToSize(dimension.quote || "", 165).length;
          dimensionSpace += quoteLines * 5;
        }
        
        ensureSpaceForContent(dimensionSpace);
        
        // Dimension name
        pdf.setFont("helvetica", 'bold');
        pdf.text(displayKey, 20, yPosition);
        yPosition += 6;
        
        // Rating
        pdf.text("Rating:", 25, yPosition);
        pdf.setFont("helvetica", 'normal');
        pdf.text(dimension.rating || 'N/A', 50, yPosition);
        yPosition += 8;
        
        // Description
        if (dimension.description) {
          pdf.setFont("helvetica", 'bold');
          pdf.text("Description:", 25, yPosition);
          yPosition += 5;
          
          pdf.setFont("helvetica", 'normal');
          const splitDesc = pdf.splitTextToSize(dimension.description, 165);
          pdf.text(splitDesc, 25, yPosition);
          yPosition += splitDesc.length * 5 + 3;
        }
        
        // Evidence quote
        if (dimension.quote) {
          pdf.setFont("helvetica", 'bold');
          pdf.text("Evidence:", 25, yPosition);
          yPosition += 5;
          
          pdf.setFont("helvetica", 'italic');
          const splitQuote = pdf.splitTextToSize(`"${dimension.quote}"`, 165);
          pdf.text(splitQuote, 25, yPosition);
          yPosition += splitQuote.length * 5 + 8;
        }
        
        pdf.setFont("helvetica", 'normal');
      });
    }
    
    // Add analyzed text if available and not too long
    if (originalText) {
      ensureSpaceForContent(15);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", 'bold');
      pdf.text("ANALYZED TEXT (EXCERPT)", 20, yPosition);
      pdf.setFont("helvetica", 'normal');
      yPosition += 10;
      
      // Only include the first 1000 characters to avoid making the PDF too large
      const textExcerpt = originalText.length > 1000 
        ? originalText.substring(0, 1000) + "..." 
        : originalText;
      
      const splitText = pdf.splitTextToSize(textExcerpt, 170);
      
      if (splitText.length > 50) {
        // If the text is too long, just include the first 50 lines
        const truncatedText = splitText.slice(0, 50);
        truncatedText.push("... [text truncated for PDF size]");
        pdf.setFontSize(9);
        pdf.text(truncatedText, 20, yPosition);
      } else {
        pdf.setFontSize(9);
        pdf.text(splitText, 20, yPosition);
      }
    }
    
    pdf.save(`intelligence-analysis-${new Date().toISOString().slice(0, 10)}.pdf`);
  };
  
  // Helper function to trigger download
  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    
    if (downloadLinkRef.current) {
      downloadLinkRef.current.href = url;
      downloadLinkRef.current.download = filename;
      downloadLinkRef.current.click();
    }
    
    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-blue-600" />
            <span>Full Intelligence Analysis Report</span>
          </DialogTitle>
          <DialogDescription>
            Comprehensive analysis with detailed dimensions, metrics, and evidence
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 pt-2">
          {/* Overall Score Section */}
          <div className="rounded-md border p-4 bg-blue-50">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-blue-900">Overall Intelligence Score</h3>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-blue-800">{analysis.overallScore}</span>
                <span className="text-sm text-blue-600">/100</span>
              </div>
            </div>
            <p className="text-blue-900 whitespace-pre-wrap break-words">{analysis.overallAssessment}</p>
          </div>
          
          {/* Export Options */}
          <div className="bg-gray-50 border rounded-md p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Export Report</h3>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={exportToTxt}
                className="flex gap-2 items-center"
              >
                <FileText className="h-4 w-4" />
                <span>Download TXT</span>
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={exportToWord}
                className="flex gap-2 items-center"
              >
                <FileType className="h-4 w-4" />
                <span>Download DOCX</span>
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={exportToPDF}
                className="flex gap-2 items-center"
              >
                <Download className="h-4 w-4" />
                <span>Download PDF</span>
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowEmailModal(true)}
                className="flex gap-2 items-center"
              >
                <Mail className="h-4 w-4" />
                <span>Email Report</span>
              </Button>
            </div>
          </div>
          
          {/* Full Analysis Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-800 border-b pb-2">Complete Analysis</h3>
            
            {/* Intelligence Report */}
            {analysis.analysis ? (
              <div className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded border">
                {analysis.analysis}
              </div>
            ) : (
              <div className="bg-amber-50 p-4 rounded-md border border-amber-200 text-amber-800">
                <p>No detailed analysis available. The analysis may still be in progress or the document was too large.</p>
              </div>
            )}
            
            {/* Surface-Level Scores Section */}
            {analysis.surface && (
              <div className="mt-6">
                <h3 className="font-semibold text-gray-800 border-b pb-2 mb-4">Surface-Level Scores</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(analysis.surface).map(([key, value]) => (
                    <div key={key} className="bg-white p-4 rounded-md border">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                      </h4>
                      <div className="flex items-center justify-between">
                        <p className="text-sm">
                          {typeof value === 'number' 
                            ? `Score: ${value}/100` 
                            : String(value)}
                        </p>
                        {typeof value === 'number' && (
                          <div className="w-24 bg-gray-200 rounded-full h-2.5">
                            <div 
                              className="bg-blue-600 h-2.5 rounded-full" 
                              style={{ width: `${value}%` }}
                            ></div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Deep-Level Scores Section */}
            {analysis.deep && (
              <div className="mt-6">
                <h3 className="font-semibold text-gray-800 border-b pb-2 mb-4">Deep-Level Scores</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(analysis.deep).map(([key, value]) => (
                    <div key={key} className="bg-white p-4 rounded-md border">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                      </h4>
                      <div className="flex items-center justify-between">
                        <p className="text-sm">
                          {typeof value === 'number' 
                            ? `Score: ${value}/100` 
                            : String(value)}
                        </p>
                        {typeof value === 'number' && (
                          <div className="w-24 bg-gray-200 rounded-full h-2.5">
                            <div 
                              className="bg-green-600 h-2.5 rounded-full" 
                              style={{ width: `${value}%` }}
                            ></div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Dimensions Analysis */}
            {analysis.dimensions && (
              <div className="mt-6 space-y-4">
                <h3 className="font-semibold text-gray-800 border-b pb-2">Detailed Dimensions with Evidence</h3>
                
                <div className="space-y-4">
                  {Object.entries(analysis.dimensions).map(([key, dimension]) => (
                    <div key={key} className="bg-white p-4 rounded-md border">
                      <h4 className="font-medium text-gray-800 mb-2">
                        {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                      </h4>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="font-medium">Rating:</span>
                        <span className={`font-semibold ${
                          dimension.rating === 'Exceptional' || dimension.rating === 'Very Strong' 
                            ? 'text-green-600' 
                            : dimension.rating === 'Strong' || dimension.rating === 'Moderate'
                            ? 'text-blue-600'
                            : 'text-red-600'
                        }`}>
                          {dimension.rating}
                        </span>
                      </div>
                      <div className="mb-3">
                        <span className="font-medium">Description:</span>
                        <p className="mt-1 text-gray-700">{dimension.description}</p>
                      </div>
                      {dimension.quote && (
                        <div className="mb-1">
                          <span className="font-medium">Evidence:</span>
                          <div className="mt-1 border-l-4 border-gray-300 pl-3 italic text-gray-600">
                            "{dimension.quote}"
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter className="flex justify-between gap-2 mt-6 pt-4 border-t">
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleCopy}
              className="flex items-center gap-2"
            >
              <Copy className="h-4 w-4" />
              <span>Copy Full Report</span>
            </Button>
          </div>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
      
      {/* Hidden download link for exports */}
      <a ref={downloadLinkRef} style={{ display: 'none' }}></a>
      
      {/* Email Modal */}
      <SimpleShareViaEmailModal
        show={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        subject="Intelligence Analysis Report"
        content={createReportContent()}
      />
    </Dialog>
  );
};

export default FullReportDialog;