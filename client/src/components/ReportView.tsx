import React, { useRef } from 'react';
import { DocumentAnalysis, DocumentComparison } from '@/lib/types';
import AnalysisReport from './AnalysisReport';
import ReportDownloadButton from './ReportDownloadButton';

interface ReportViewProps {
  analysisA: DocumentAnalysis;
  analysisB?: DocumentAnalysis;
  comparison?: DocumentComparison;
  mode: 'single' | 'compare';
}

const ReportView: React.FC<ReportViewProps> = ({
  analysisA,
  analysisB,
  comparison,
  mode
}) => {
  // Create refs for charts to enable PDF capture
  const doughnutARef = useRef<HTMLDivElement>(null);
  const doughnutBRef = useRef<HTMLDivElement>(null);
  const barChartRef = useRef<HTMLDivElement>(null);
  const radarChartRef = useRef<HTMLDivElement>(null);
  
  return (
    <div className="bg-gray-50 p-6 rounded-lg">
      <div className="flex justify-end mb-4">
        <ReportDownloadButton
          analysisA={analysisA}
          analysisB={analysisB}
          comparison={comparison}
          mode={mode}
          doughnutARef={doughnutARef}
          doughnutBRef={doughnutBRef}
          barChartRef={barChartRef}
          radarChartRef={radarChartRef}
        />
      </div>
      
      <AnalysisReport
        analysisA={analysisA}
        analysisB={analysisB}
        comparison={comparison}
        mode={mode}
      />
    </div>
  );
};

export default ReportView;