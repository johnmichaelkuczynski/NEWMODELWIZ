import { DocumentAnalysis, DocumentComparison } from '@/lib/types';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, AlignmentType, BorderStyle } from 'docx';
import html2canvas from 'html2canvas';

// Function to create a rounded rectangle with text for PDF
function roundedRect(
  doc: jsPDF, 
  x: number, 
  y: number, 
  width: number, 
  height: number, 
  radius: number, 
  text: string, 
  fontSize: number,
  fillColor: [number, number, number] = [41, 128, 185],
  textColor: [number, number, number] = [255, 255, 255]
) {
  // Draw rounded rectangle
  doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
  doc.roundedRect(x, y, width, height, radius, radius, 'F');
  
  // Add text
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFontSize(fontSize);
  const textWidth = doc.getTextWidth(text);
  const textX = x + (width - textWidth) / 2;
  const textY = y + height / 2 + fontSize / 3;
  doc.text(text, textX, textY);
}

// Function to add a doughnut chart visualization to PDF
async function addDoughnutToPDF(
  doc: jsPDF, 
  chartElement: HTMLCanvasElement, 
  x: number, 
  y: number, 
  width: number, 
  height: number
): Promise<void> {
  try {
    const canvas = await html2canvas(chartElement);
    const imgData = canvas.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', x, y, width, height);
  } catch (error) {
    console.error('Error adding chart to PDF:', error);
  }
}

// Generate a PDF report for analysis
export async function generatePDFReport(
  analysisA: DocumentAnalysis,
  analysisB?: DocumentAnalysis,
  comparison?: DocumentComparison,
  chartRefs?: {
    doughnutA?: React.RefObject<HTMLDivElement>;
    doughnutB?: React.RefObject<HTMLDivElement>;
    barChart?: React.RefObject<HTMLDivElement>;
    radarChart?: React.RefObject<HTMLDivElement>;
  }
): Promise<jsPDF> {
  // Create a new PDF document
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let currentY = margin;
  
  // Add header
  doc.setFillColor(240, 240, 240);
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setFontSize(22);
  doc.setTextColor(50, 50, 50);
  doc.text('Intelligence Analysis Report', pageWidth / 2, 15, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(
    analysisB ? 'Document Comparison' : 'Document Analysis', 
    pageWidth / 2, 
    25, 
    { align: 'center' }
  );
  currentY = 40;
  
  // Add generated date and AI provider
  doc.setFontSize(10);
  doc.setTextColor(130, 130, 130);
  const dateText = `Generated on ${new Date().toLocaleDateString()}`;
  const providerText = `AI Provider: ${analysisA.provider || 'Advanced AI'}`;
  doc.text(dateText, margin, currentY);
  doc.text(providerText, pageWidth - margin, currentY, { align: 'right' });
  currentY += 10;
  
  // Add overall score section
  doc.setFontSize(16);
  doc.setTextColor(50, 50, 50);
  doc.text('Overall Intelligence Assessment', margin, currentY);
  currentY += 10;

  // Add score visualizations
  const scoreBoxWidth = 100;
  const scoreBoxHeight = 50;
  const scoreRadius = 5;
  
  // Document A score
  roundedRect(
    doc,
    margin,
    currentY,
    scoreBoxWidth,
    scoreBoxHeight,
    scoreRadius,
    `${analysisA.overallScore}/100`,
    20,
    [41, 128, 185]  // Blue
  );
  
  doc.setFontSize(12);
  doc.setTextColor(50, 50, 50);
  doc.text(
    analysisB ? 'Document A Score' : 'Intelligence Score',
    margin + scoreBoxWidth / 2,
    currentY - 5,
    { align: 'center' }
  );
  
  // Document B score (if comparison)
  if (analysisB) {
    roundedRect(
      doc,
      pageWidth - margin - scoreBoxWidth,
      currentY,
      scoreBoxWidth,
      scoreBoxHeight,
      scoreRadius,
      `${analysisB.overallScore}/100`,
      20,
      [231, 76, 60]  // Red
    );
    
    doc.setFontSize(12);
    doc.setTextColor(50, 50, 50);
    doc.text(
      'Document B Score',
      pageWidth - margin - scoreBoxWidth / 2,
      currentY - 5,
      { align: 'center' }
    );
  }
  
  currentY += scoreBoxHeight + 15;
  
  // Add charts if refs are provided
  if (chartRefs) {
    try {
      if (chartRefs.barChart?.current) {
        doc.setFontSize(16);
        doc.setTextColor(50, 50, 50);
        doc.text('Surface Analysis', margin, currentY);
        currentY += 10;
        
        await addDoughnutToPDF(
          doc, 
          chartRefs.barChart.current.querySelector('canvas') as HTMLCanvasElement,
          margin,
          currentY,
          pageWidth - (margin * 2),
          70
        );
        
        currentY += 80;
      }
      
      if (chartRefs.radarChart?.current) {
        doc.setFontSize(16);
        doc.setTextColor(50, 50, 50);
        doc.text('Deep Semantic Analysis', margin, currentY);
        currentY += 10;
        
        await addDoughnutToPDF(
          doc, 
          chartRefs.radarChart.current.querySelector('canvas') as HTMLCanvasElement,
          margin,
          currentY,
          pageWidth - (margin * 2),
          70
        );
        
        currentY += 80;
      }
    } catch (error) {
      console.error('Error adding charts to PDF:', error);
    }
  }
  
  // Check if we need a new page
  if (currentY > pageHeight - 60) {
    doc.addPage();
    currentY = margin;
  }
  
  // Add dimension analysis
  doc.setFontSize(16);
  doc.setTextColor(50, 50, 50);
  doc.text('Dimension Analysis', margin, currentY);
  currentY += 10;
  
  // Get dimensions from the analysis data - use actual dimension names as keys
  const dimensionsData = analysisA.dimensions || {};
  const dimensionKeys = Object.keys(dimensionsData);
  
  // Use the actual dimensions returned from the parser
  const dimensions = dimensionKeys.length > 0 
    ? dimensionKeys.map(key => ({ 
        name: key, // Use the actual dimension name as display name
        key: key   // Use the same key for lookup
      }))
    : [
        { name: 'No dimensions available', key: 'none' }
      ];
  
  const colWidths = analysisB
    ? [(pageWidth - margin * 2) * 0.4, (pageWidth - margin * 2) * 0.3, (pageWidth - margin * 2) * 0.3]
    : [(pageWidth - margin * 2) * 0.6, (pageWidth - margin * 2) * 0.4];
  
  // Table header
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, currentY, pageWidth - margin * 2, 8, 'F');
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'bold');
  doc.text('Dimension', margin + 3, currentY + 5);
  
  if (analysisB) {
    doc.text('Document A', margin + colWidths[0] + 3, currentY + 5);
    doc.text('Document B', margin + colWidths[0] + colWidths[1] + 3, currentY + 5);
  } else {
    doc.text('Rating', margin + colWidths[0] + 3, currentY + 5);
  }
  
  currentY += 8;
  
  // Table rows
  doc.setFont('helvetica', 'normal');
  
  for (const dim of dimensions) {
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    
    doc.setTextColor(50, 50, 50);
    doc.text(dim.name, margin + 3, currentY + 5);
    
    const ratingA = analysisA.dimensions?.[dim.key]?.rating || analysisA.dimensions?.[dim.key]?.score || '-';
    doc.text(String(ratingA), margin + colWidths[0] + 3, currentY + 5);
    
    if (analysisB) {
      const ratingB = analysisB.dimensions?.[dim.key]?.rating || analysisB.dimensions?.[dim.key]?.score || '-';
      doc.text(String(ratingB), margin + colWidths[0] + colWidths[1] + 3, currentY + 5);
    }
    
    currentY += 8;
    
    // Check if we need a new page
    if (currentY > pageHeight - 60) {
      doc.addPage();
      currentY = margin;
    }
  }
  
  // Add detailed analysis
  if (currentY > pageHeight - 80) {
    doc.addPage();
    currentY = margin;
  }
  
  doc.setFontSize(16);
  doc.setTextColor(50, 50, 50);
  doc.text('Detailed Analysis', margin, currentY);
  currentY += 10;
  
  // Add analysis text
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  
  const analysis = analysisA.analysis || '';
  const splitText = doc.splitTextToSize(analysis, pageWidth - margin * 2);
  
  if (currentY + splitText.length * 4.5 > pageHeight - margin) {
    // If text doesn't fit on current page, add a new page
    doc.addPage();
    currentY = margin;
  }
  
  doc.text(splitText, margin, currentY);
  
  // Add footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Generated using Intelligence Analysis Tool | ${new Date().toLocaleDateString()} | Provider: ${analysisA.provider || 'Advanced AI'}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );
  
  return doc;
}

// Generate a Word document report for analysis
export async function generateWordReport(
  analysisA: DocumentAnalysis,
  analysisB?: DocumentAnalysis,
  comparison?: DocumentComparison
): Promise<Document> {
  // Define color shades for ratings
  const ratingColors: Record<string, string> = {
    'Exceptional': '2ECC71',      // Green
    'Very Strong': '27AE60',      // Green
    'Strong': '2980B9',           // Blue
    'Moderate': '3498DB',         // Blue
    'Basic': 'F39C12',            // Yellow
    'Weak': 'E67E22',             // Orange
    'Very Weak': 'E74C3C',        // Red
    'Critically Deficient': 'C0392B' // Dark Red
  };

  // Create sections array
  const sections = [];
  
  // Header section
  sections.push({
    properties: {},
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: "Intelligence Analysis Report", size: 36 })
        ],
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER
      }),
      new Paragraph({
        children: [
          new TextRun({ text: analysisB ? "Document Comparison" : "Document Analysis", size: 28 })
        ],
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `Generated on ${new Date().toLocaleDateString()} using `, size: 20 }),
          new TextRun({ text: analysisA.provider || 'Advanced AI', size: 20, bold: true }),
        ],
        alignment: AlignmentType.CENTER
      }),
      new Paragraph({ text: "" })
    ]
  });
  
  // Overall score section
  sections.push({
    properties: {},
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: "Overall Intelligence Assessment", size: 24 })
        ],
        heading: HeadingLevel.HEADING_1
      }),
      new Paragraph({
        children: [
          new TextRun({ 
            text: analysisB ? "Document A Score: " : "Intelligence Score: ", 
            bold: true 
          }),
          new TextRun({ 
            text: `${analysisA.overallScore}/100`, 
            bold: true, 
            color: "2980B9" 
          })
        ]
      }),
      ...(analysisB ? [
        new Paragraph({
          children: [
            new TextRun({ 
              text: "Document B Score: ", 
              bold: true 
            }),
            new TextRun({ 
              text: `${analysisB.overallScore}/100`, 
              bold: true, 
              color: "E74C3C" 
            })
          ]
        })
      ] : []),
      new Paragraph({ 
        children: [
          new TextRun({ text: "" })
        ]
      }),
      ...(comparison ? [
        new Paragraph({ 
          children: [
            new TextRun({ text: "Comparison Summary", size: 20 })
          ],
          heading: HeadingLevel.HEADING_2 
        }),
        new Paragraph({ 
          children: [
            new TextRun({ text: comparison.finalJudgment })
          ]
        }),
        new Paragraph({ 
          children: [
            new TextRun({ text: "" })
          ]
        })
      ] : [])
    ]
  });
  
  // Surface analysis section
  sections.push({
    properties: {},
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: "Surface Analysis", size: 24 })
        ],
        heading: HeadingLevel.HEADING_1
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Grammar: ", bold: true }),
          new TextRun({ text: `${analysisA.surface?.grammar || 0}/100` })
        ]
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Structure: ", bold: true }),
          new TextRun({ text: `${analysisA.surface?.structure || 0}/100` })
        ]
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Jargon Usage: ", bold: true }),
          new TextRun({ text: `${analysisA.surface?.jargonUsage || 0}/100` })
        ]
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Surface Fluency: ", bold: true }),
          new TextRun({ text: `${analysisA.surface?.surfaceFluency || 0}/100` })
        ]
      }),
      new Paragraph({ 
        children: [
          new TextRun({ text: "" })
        ]
      })
    ]
  });
  
  // Deep analysis section
  sections.push({
    properties: {},
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: "Deep Semantic Analysis", size: 24 })
        ],
        heading: HeadingLevel.HEADING_1
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Conceptual Depth: ", bold: true }),
          new TextRun({ text: `${analysisA.deep?.conceptualDepth || 0}/100` })
        ]
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Inferential Continuity: ", bold: true }),
          new TextRun({ text: `${analysisA.deep?.inferentialContinuity || 0}/100` })
        ]
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Semantic Compression: ", bold: true }),
          new TextRun({ text: `${analysisA.deep?.semanticCompression || 0}/100` })
        ]
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Logical Laddering: ", bold: true }),
          new TextRun({ text: `${analysisA.deep?.logicalLaddering || 0}/100` })
        ]
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Conceptual Depth: ", bold: true }),
          new TextRun({ text: `${analysisA.deep?.conceptualDepth || 0}/100` })
        ]
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Originality: ", bold: true }),
          new TextRun({ text: `${analysisA.deep?.originality || 0}/100` })
        ]
      }),
      new Paragraph({ 
        children: [
          new TextRun({ text: "" })
        ]
      })
    ]
  });
  
  // Dimension analysis section with table
  const dimensions = [
    { name: 'Definition Coherence', key: 'definitionCoherence' },
    { name: 'Claim Formation', key: 'claimFormation' },
    { name: 'Inferential Continuity', key: 'inferentialContinuity' },
    { name: 'Semantic Load', key: 'semanticLoad' },
    { name: 'Jargon Detection', key: 'jargonDetection' },
    { name: 'Surface Complexity', key: 'surfaceComplexity' },
    { name: 'Deep Complexity', key: 'deepComplexity' }
  ];
  
  // Create dimension table rows
  const tableRows = [
    // Header row
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          children: [
            new Paragraph({ 
              children: [new TextRun({ text: "Dimension", bold: true })]
            })
          ],
          shading: { fill: "F2F2F2" }
        }),
        new TableCell({
          children: [
            new Paragraph({ 
              children: [
                new TextRun({ 
                  text: analysisB ? "Document A Rating" : "Rating", 
                  bold: true 
                })
              ]
            })
          ],
          shading: { fill: "F2F2F2" }
        }),
        ...(analysisB ? [
          new TableCell({
            children: [
              new Paragraph({ 
                children: [
                  new TextRun({ text: "Document B Rating", bold: true })
                ]
              })
            ],
            shading: { fill: "F2F2F2" }
          })
        ] : [])
      ]
    }),
    
    // Dimension rows
    ...dimensions.map(dim => {
      const ratingA = analysisA.dimensions?.[dim.key as keyof typeof analysisA.dimensions]?.rating || '-';
      const ratingColorA = ratingColors[ratingA] || '000000';
      
      let cells = [
        new TableCell({
          children: [new Paragraph({ text: dim.name })]
        }),
        new TableCell({
          children: [new Paragraph({ 
            children: [new TextRun({ text: ratingA, color: ratingColorA })]
          })]
        })
      ];
      
      if (analysisB) {
        const ratingB = analysisB.dimensions?.[dim.key as keyof typeof analysisB.dimensions]?.rating || '-';
        const ratingColorB = ratingColors[ratingB] || '000000';
        
        cells.push(
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: ratingB, color: ratingColorB })]
            })]
          })
        );
      }
      
      return new TableRow({ children: cells });
    })
  ];
  
  const dimensionSection = {
    properties: {},
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: "Dimension Analysis", size: 24 })
        ],
        heading: HeadingLevel.HEADING_1
      }),
      new Table({
        rows: tableRows,
        width: {
          size: 100,
          type: 'pct',
        },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "D3D3D3" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "D3D3D3" },
          left: { style: BorderStyle.SINGLE, size: 1, color: "D3D3D3" },
          right: { style: BorderStyle.SINGLE, size: 1, color: "D3D3D3" },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "D3D3D3" },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "D3D3D3" },
        }
      }),
      new Paragraph({ 
        children: [
          new TextRun({ text: "" })
        ]
      })
    ]
  };
  
  sections.push(dimensionSection);
  
  // Detailed analysis section
  sections.push({
    properties: {},
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: "Detailed Analysis", size: 24 })
        ],
        heading: HeadingLevel.HEADING_1
      }),
      new Paragraph({ 
        children: [
          new TextRun({ text: analysisA.analysis || "" })
        ]
      }),
      new Paragraph({ 
        children: [
          new TextRun({ text: "" })
        ]
      }),
      new Paragraph({
        children: [
          new TextRun({ 
            text: `Generated using Intelligence Analysis Tool | ${new Date().toLocaleDateString()} | Provider: ${analysisA.provider || 'Advanced AI'}`,
            size: 16,
            color: "A0A0A0"
          })
        ],
        alignment: AlignmentType.CENTER
      })
    ]
  });
  
  // Create document with sections
  return new Document({
    sections: sections.map(section => ({
      properties: section.properties,
      children: section.children
    }))
  });
}

// Helper function to download a file
export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  
  setTimeout(() => URL.revokeObjectURL(url), 100);
}