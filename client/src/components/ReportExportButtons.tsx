import React, { useRef } from 'react';
import { Button } from "@/components/ui/button";
import { FileText, Download, Mail, FileType } from "lucide-react";
import { DocumentAnalysis } from "@/lib/types";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from "docx";
import { jsPDF } from "jspdf";
import SimpleShareViaEmailModal from "./SimpleShareViaEmailModal";
import { useState } from 'react';

interface ReportExportButtonsProps {
  analysis: DocumentAnalysis;
  originalText: string;
}

const ReportExportButtons: React.FC<ReportExportButtonsProps> = ({ analysis, originalText }) => {
  const downloadLinkRef = useRef<HTMLAnchorElement>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Create the report content as formatted text
  const createReportContent = () => {
    return `
INTELLIGENCE ANALYSIS REPORT
============================
Overall Intelligence Score: ${analysis.overallScore}/100

${analysis.overallAssessment || ''}

${analysis.analysis || ''}

Analyzed Text:
${originalText}
`;
  };

  // Export as plain text
  const exportToTxt = () => {
    const content = createReportContent();
    const blob = new Blob([content], { type: 'text/plain' });
    triggerDownload(blob, `intelligence-analysis-${new Date().toISOString().slice(0, 10)}.txt`);
  };

  // Export as Word document
  const exportToWord = async () => {
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
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
            text: analysis.overallAssessment || '',
            spacing: { after: 400 },
          }),
          new Paragraph({
            text: analysis.analysis || '',
            spacing: { after: 400 },
          }),
          new Paragraph({
            text: "Analyzed Text:",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 },
          }),
          new Paragraph({
            text: originalText,
            spacing: { after: 200 },
          }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    triggerDownload(blob, `intelligence-analysis-${new Date().toISOString().slice(0, 10)}.docx`);
  };

  // Export as PDF
  const exportToPDF = () => {
    const pdf = new jsPDF();
    
    // Set title
    pdf.setFontSize(18);
    pdf.text("INTELLIGENCE ANALYSIS REPORT", 105, 20, { align: 'center' });
    
    pdf.setFontSize(12);
    pdf.text(`Overall Intelligence Score: ${analysis.overallScore}/100`, 20, 30);
    
    // Add overall assessment with word wrapping (limited to 170 width)
    const splitAssessment = pdf.splitTextToSize(analysis.overallAssessment || '', 170);
    pdf.text(splitAssessment, 20, 40);
    
    // Add the detailed analysis if available
    if (analysis.analysis) {
      let yPosition = 40 + splitAssessment.length * 7;
      
      pdf.setFontSize(14);
      pdf.text("Detailed Analysis", 20, yPosition);
      yPosition += 10;
      
      pdf.setFontSize(10);
      const splitAnalysis = pdf.splitTextToSize(analysis.analysis, 170);
      pdf.text(splitAnalysis, 20, yPosition);
      yPosition += splitAnalysis.length * 5 + 10;
      
      // Add original text if there's space, or on a new page
      if (yPosition > 250) {
        pdf.addPage();
        yPosition = 20;
      }
      
      pdf.setFontSize(14);
      pdf.text("Analyzed Text", 20, yPosition);
      yPosition += 10;
      
      pdf.setFontSize(9);
      const splitText = pdf.splitTextToSize(originalText.substring(0, 2000) + (originalText.length > 2000 ? "..." : ""), 170);
      pdf.text(splitText, 20, yPosition);
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
    <>
      <div className="flex flex-wrap gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={exportToTxt}
          className="flex gap-2 items-center"
        >
          <FileText className="h-4 w-4" />
          <span>TXT</span>
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={exportToWord}
          className="flex gap-2 items-center"
        >
          <FileType className="h-4 w-4" />
          <span>DOCX</span>
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={exportToPDF}
          className="flex gap-2 items-center"
        >
          <Download className="h-4 w-4" />
          <span>PDF</span>
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setShowEmailModal(true)}
          className="flex gap-2 items-center"
        >
          <Mail className="h-4 w-4" />
          <span>Email</span>
        </Button>
      </div>
      
      {/* Hidden download link for exports */}
      <a ref={downloadLinkRef} style={{ display: 'none' }}></a>
      
      {/* Email Modal */}
      <SimpleShareViaEmailModal
        show={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        subject="Intelligence Analysis Report"
        content={createReportContent()}
      />
    </>
  );
};

export default ReportExportButtons;