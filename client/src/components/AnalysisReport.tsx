import React from 'react';
import { DocumentAnalysis, DocumentComparison } from '@/lib/types';
import { cleanAIResponse } from '@/lib/textUtils';
import { Doughnut, Bar, Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler
} from 'chart.js';

// Register the chart.js components
ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler
);

interface AnalysisReportProps {
  analysisA: DocumentAnalysis;
  analysisB?: DocumentAnalysis;
  comparison?: DocumentComparison;
  mode: 'single' | 'compare';
}

const AnalysisReport: React.FC<AnalysisReportProps> = ({
  analysisA,
  analysisB,
  comparison,
  mode
}) => {
  // Prepare data for doughnut chart (overall score)
  const doughnutDataA = {
    labels: ['Score', 'Remaining'],
    datasets: [
      {
        data: [analysisA.overallScore, 100 - analysisA.overallScore],
        backgroundColor: [
          'rgba(54, 162, 235, 0.8)',
          'rgba(200, 200, 200, 0.2)',
        ],
        borderColor: [
          'rgba(54, 162, 235, 1)',
          'rgba(200, 200, 200, 0.3)',
        ],
        borderWidth: 1,
      },
    ],
  };

  // Prepare data for bar chart (surface metrics)
  const barDataSurface = {
    labels: ['Grammar', 'Structure', 'Jargon Usage', 'Surface Fluency'],
    datasets: [
      {
        label: 'Document A',
        data: [
          analysisA.surface?.grammar || 0,
          analysisA.surface?.structure || 0,
          analysisA.surface?.jargonUsage || 0,
          analysisA.surface?.surfaceFluency || 0
        ],
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
      ...(mode === 'compare' && analysisB ? [{
        label: 'Document B',
        data: [
          analysisB.surface?.grammar || 0,
          analysisB.surface?.structure || 0,
          analysisB.surface?.jargonUsage || 0,
          analysisB.surface?.surfaceFluency || 0
        ],
        backgroundColor: 'rgba(255, 99, 132, 0.6)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1,
      }] : []),
    ],
  };

  // Prepare data for radar chart (deep metrics)
  const radarDataDeep = {
    labels: [
      'Conceptual Depth',
      'Inferential Continuity',
      'Claim Necessity',
      'Semantic Compression',
      'Logical Laddering',
      'Depth Fluency',
      'Originality'
    ],
    datasets: [
      {
        label: 'Document A',
        data: [
          analysisA.deep?.conceptualDepth || 0,
          analysisA.deep?.inferentialContinuity || 0,
          analysisA.deep?.claimNecessity || 0,
          analysisA.deep?.semanticCompression || 0,
          analysisA.deep?.logicalLaddering || 0,
          analysisA.deep?.depthFluency || 0,
          analysisA.deep?.originality || 0
        ],
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(54, 162, 235, 1)',
        pointRadius: 3,
      },
      ...(mode === 'compare' && analysisB ? [{
        label: 'Document B',
        data: [
          analysisB.deep?.conceptualDepth || 0,
          analysisB.deep?.inferentialContinuity || 0,
          analysisB.deep?.claimNecessity || 0,
          analysisB.deep?.semanticCompression || 0,
          analysisB.deep?.logicalLaddering || 0,
          analysisB.deep?.depthFluency || 0,
          analysisB.deep?.originality || 0
        ],
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(255, 99, 132, 1)',
        pointRadius: 3,
      }] : []),
    ],
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      r: {
        angleLines: {
          display: true
        },
        suggestedMin: 0,
        suggestedMax: 100
      }
    }
  };

  // Function to format dimension ratings for comparison table
  const formatRating = (rating: string | undefined) => {
    if (!rating) return '-';
    
    const ratingColors: Record<string, string> = {
      'Exceptional': 'text-green-700 font-bold',
      'Very Strong': 'text-green-600',
      'Strong': 'text-green-500',
      'Moderate': 'text-yellow-600',
      'Basic': 'text-yellow-500',
      'Weak': 'text-red-500',
      'Very Weak': 'text-red-600',
      'Critically Deficient': 'text-red-700'
    };
    
    return (
      <span className={ratingColors[rating] || 'text-gray-700'}>
        {rating}
      </span>
    );
  };

  return (
    <div className="analysis-report">
      {/* Header */}
      <div className="report-header text-center py-6 bg-gray-50 border-b">
        <h1 className="text-3xl font-bold text-gray-800">
          Intelligence Analysis Report
        </h1>
        <p className="text-gray-600 mt-2">
          {mode === 'single' ? 'Document Analysis' : 'Document Comparison'}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Generated on {new Date().toLocaleDateString()} using {analysisA.provider || 'AI Analysis'}
        </p>
      </div>

      {/* Overall Score Section */}
      <div className="mt-8 px-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Overall Intelligence Assessment</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-xl font-medium text-gray-700 mb-3">
              {mode === 'compare' ? 'Document A Score' : 'Overall Score'}
            </h3>
            <div className="h-64 relative">
              <Doughnut 
                data={doughnutDataA} 
                options={{
                  ...chartOptions,
                  cutout: '70%',
                  plugins: {
                    ...chartOptions.plugins,
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          return context.label === 'Score' ? 
                            `Score: ${analysisA.overallScore}/100` : '';
                        }
                      }
                    }
                  }
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <span className="text-4xl font-bold text-blue-600">
                    {analysisA.overallScore}
                  </span>
                  <span className="text-gray-500 text-sm block">/100</span>
                </div>
              </div>
            </div>
          </div>

          {mode === 'compare' && analysisB && (
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-xl font-medium text-gray-700 mb-3">Document B Score</h3>
              <div className="h-64 relative">
                <Doughnut 
                  data={{
                    labels: ['Score', 'Remaining'],
                    datasets: [
                      {
                        data: [analysisB.overallScore, 100 - analysisB.overallScore],
                        backgroundColor: [
                          'rgba(255, 99, 132, 0.8)',
                          'rgba(200, 200, 200, 0.2)',
                        ],
                        borderColor: [
                          'rgba(255, 99, 132, 1)',
                          'rgba(200, 200, 200, 0.3)',
                        ],
                        borderWidth: 1,
                      },
                    ],
                  }}
                  options={{
                    ...chartOptions,
                    cutout: '70%',
                    plugins: {
                      ...chartOptions.plugins,
                      tooltip: {
                        callbacks: {
                          label: function(context) {
                            return context.label === 'Score' ? 
                              `Score: ${analysisB.overallScore}/100` : '';
                          }
                        }
                      }
                    }
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <span className="text-4xl font-bold text-pink-600">
                      {analysisB.overallScore}
                    </span>
                    <span className="text-gray-500 text-sm block">/100</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {mode === 'compare' && comparison && (
            <div className="bg-white p-4 rounded-lg shadow md:col-span-2">
              <h3 className="text-xl font-medium text-gray-700 mb-3">Comparison Summary</h3>
              <p className="text-gray-700">{comparison.finalJudgment}</p>
            </div>
          )}
        </div>
      </div>

      {/* Surface Metrics Section */}
      <div className="mt-10 px-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Surface Analysis</h2>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="h-80">
            <Bar 
              data={barDataSurface} 
              options={{
                ...chartOptions,
                scales: {
                  y: {
                    beginAtZero: true,
                    max: 100
                  }
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Deep Metrics Section */}
      <div className="mt-10 px-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Deep Semantic Analysis</h2>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="h-80">
            <Radar 
              data={radarDataDeep} 
              options={{
                ...chartOptions,
                scales: {
                  r: {
                    angleLines: {
                      display: true
                    },
                    suggestedMin: 0,
                    suggestedMax: 100
                  }
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Dimension Analysis Section */}
      <div className="mt-10 px-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Dimension Analysis</h2>
        <div className="bg-white p-4 rounded-lg shadow overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-3 px-4 text-left text-sm font-medium text-gray-700">Dimension</th>
                <th className="py-3 px-4 text-left text-sm font-medium text-gray-700">
                  {mode === 'compare' ? 'Document A Rating' : 'Rating'}
                </th>
                {mode === 'compare' && (
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-700">Document B Rating</th>
                )}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="py-3 px-4 text-sm font-medium text-gray-900">Definition Coherence</td>
                <td className="py-3 px-4 text-sm text-gray-700">
                  {formatRating(analysisA.dimensions?.definitionCoherence?.rating)}
                </td>
                {mode === 'compare' && analysisB && (
                  <td className="py-3 px-4 text-sm text-gray-700">
                    {formatRating(analysisB.dimensions?.definitionCoherence?.rating)}
                  </td>
                )}
              </tr>
              <tr className="border-t">
                <td className="py-3 px-4 text-sm font-medium text-gray-900">Claim Formation</td>
                <td className="py-3 px-4 text-sm text-gray-700">
                  {formatRating(analysisA.dimensions?.claimFormation?.rating)}
                </td>
                {mode === 'compare' && analysisB && (
                  <td className="py-3 px-4 text-sm text-gray-700">
                    {formatRating(analysisB.dimensions?.claimFormation?.rating)}
                  </td>
                )}
              </tr>
              <tr className="border-t">
                <td className="py-3 px-4 text-sm font-medium text-gray-900">Inferential Continuity</td>
                <td className="py-3 px-4 text-sm text-gray-700">
                  {formatRating(analysisA.dimensions?.inferentialContinuity?.rating)}
                </td>
                {mode === 'compare' && analysisB && (
                  <td className="py-3 px-4 text-sm text-gray-700">
                    {formatRating(analysisB.dimensions?.inferentialContinuity?.rating)}
                  </td>
                )}
              </tr>
              <tr className="border-t">
                <td className="py-3 px-4 text-sm font-medium text-gray-900">Semantic Load</td>
                <td className="py-3 px-4 text-sm text-gray-700">
                  {formatRating(analysisA.dimensions?.semanticLoad?.rating)}
                </td>
                {mode === 'compare' && analysisB && (
                  <td className="py-3 px-4 text-sm text-gray-700">
                    {formatRating(analysisB.dimensions?.semanticLoad?.rating)}
                  </td>
                )}
              </tr>
              <tr className="border-t">
                <td className="py-3 px-4 text-sm font-medium text-gray-900">Jargon Detection</td>
                <td className="py-3 px-4 text-sm text-gray-700">
                  {formatRating(analysisA.dimensions?.jargonDetection?.rating)}
                </td>
                {mode === 'compare' && analysisB && (
                  <td className="py-3 px-4 text-sm text-gray-700">
                    {formatRating(analysisB.dimensions?.jargonDetection?.rating)}
                  </td>
                )}
              </tr>
              <tr className="border-t">
                <td className="py-3 px-4 text-sm font-medium text-gray-900">Surface Complexity</td>
                <td className="py-3 px-4 text-sm text-gray-700">
                  {formatRating(analysisA.dimensions?.surfaceComplexity?.rating)}
                </td>
                {mode === 'compare' && analysisB && (
                  <td className="py-3 px-4 text-sm text-gray-700">
                    {formatRating(analysisB.dimensions?.surfaceComplexity?.rating)}
                  </td>
                )}
              </tr>
              <tr className="border-t">
                <td className="py-3 px-4 text-sm font-medium text-gray-900">Deep Complexity</td>
                <td className="py-3 px-4 text-sm text-gray-700">
                  {formatRating(analysisA.dimensions?.deepComplexity?.rating)}
                </td>
                {mode === 'compare' && analysisB && (
                  <td className="py-3 px-4 text-sm text-gray-700">
                    {formatRating(analysisB.dimensions?.deepComplexity?.rating)}
                  </td>
                )}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Analysis Section */}
      <div className="mt-10 px-6 mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Detailed Analysis</h2>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="prose max-w-none">
            {/* Use the formatted report if available, otherwise fall back to the analysis field */}
            {analysisA.formattedReport ? (
              <div className="whitespace-pre-line font-serif">{cleanAIResponse(analysisA.formattedReport)}</div>
            ) : (
              <p className="whitespace-pre-line">{cleanAIResponse(analysisA.analysis || '')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-10 py-4 px-6 border-t text-center text-gray-500 text-sm">
        Generated using Intelligence Analysis Tool | {new Date().toLocaleDateString()} | AI Provider: {analysisA.provider || 'Advanced AI'}
      </div>
    </div>
  );
};

export default AnalysisReport;