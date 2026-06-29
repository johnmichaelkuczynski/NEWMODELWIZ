import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertTriangle, Play } from 'lucide-react';
import { apiRequest } from '@/hooks/use-api';

interface CalibrationResult {
  sample: string;
  actualScore: number;
  expectedScore: number;
  difference: number;
  evaluation: any;
}

interface ApiStatus {
  isChecking: boolean;
  isConnected: boolean;
  message: string;
}

interface ApiCheckResponse {
  status: string;
  message: string;
  response: string;
}

interface CalibrationResponse {
  results: CalibrationResult[];
  summary: {
    averageDifference: number;
    adjustments: Record<string, number>;
  };
}

const CalibrationTester: React.FC = () => {
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [results, setResults] = useState<CalibrationResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiStatus>({
    isChecking: false,
    isConnected: false,
    message: ''
  });

  // Check the API connection status on component mount
  useEffect(() => {
    checkApiConnection();
  }, []);

  const checkApiConnection = async () => {
    setApiStatus({
      isChecking: true,
      isConnected: false,
      message: 'Checking ZHI API connection...'
    });

    try {
      const response = await apiRequest<ApiCheckResponse>({
        url: '/api/check-api',
        method: 'GET'
      });

      if (response && response.status === 'success') {
        setApiStatus({
          isChecking: false,
          isConnected: true,
          message: `${response.message}: ${response.response}`
        });
      } else {
        throw new Error('API connection failed');
      }
    } catch (err) {
      setApiStatus({
        isChecking: false,
        isConnected: false,
        message: err instanceof Error 
          ? `API connection error: ${err.message}` 
          : 'Unknown API connection error'
      });
    }
  };

  const runCalibrationTests = async () => {
    setIsRunningTests(true);
    setError(null);

    try {
      const calibrationResults = await apiRequest<CalibrationResponse>({
        url: '/api/test-calibration',
        method: 'GET'
      });

      if (calibrationResults && Array.isArray(calibrationResults.results)) {
        setResults(calibrationResults.results);
      } else {
        throw new Error('Invalid response format from calibration API');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? `Error running calibration tests: ${err.message}`
          : 'Unknown error running calibration tests'
      );
    } finally {
      setIsRunningTests(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-8">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">System Calibration</h2>
      
      {/* API Connection Status */}
      <div className="mb-4">
        <div className="flex items-center mb-2">
          <span className="font-medium mr-2">API Connection:</span>
          {apiStatus.isChecking ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent mr-2"></div>
              <span className="text-gray-600">Checking...</span>
            </div>
          ) : apiStatus.isConnected ? (
            <div className="flex items-center text-green-600">
              <CheckCircle className="h-5 w-5 mr-1" />
              <span>Connected</span>
            </div>
          ) : (
            <div className="flex items-center text-red-600">
              <XCircle className="h-5 w-5 mr-1" />
              <span>Disconnected</span>
            </div>
          )}
        </div>
        
        {apiStatus.message && (
          <p className={`text-sm ${apiStatus.isConnected ? 'text-green-600' : 'text-gray-600'}`}>
            {apiStatus.message}
          </p>
        )}
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={checkApiConnection}
          disabled={apiStatus.isChecking}
          className="mt-2"
        >
          Check API Connection
        </Button>
      </div>
      
      <div className="border-t border-gray-200 py-4">
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">About Calibration Testing</h3>
          <p className="text-gray-700 text-sm mb-2">
            Calibration testing evaluates our scoring algorithm against the final calibration pack with known expected scores:
          </p>
          <ul className="text-sm text-gray-600 list-disc pl-5 mb-3 space-y-1">
            <li><span className="font-medium">Pragmatism Paper</span> (Expected: 95) - Blueprint-level compression and reframing with deep recursive structure</li>
            <li><span className="font-medium">The Will to Project</span> (Expected: 94) - Major compression of psychological concepts into a recursive model</li>
            <li><span className="font-medium">CTM Critique</span> (Expected: 94) - Deep structural critique with major compression and original reframing</li>
            <li><span className="font-medium">Revised Dianetics Review</span> (Expected: 92) - Independent sociological framing with strong semantic compression</li>
            <li><span className="font-medium">Ninety Paradoxes</span> (Expected: 90) - Original pattern recognition with high inferential compression</li>
            <li><span className="font-medium">Market Efficiency Critique</span> (Expected: 78) - Solid compression but not blueprint-grade recursion</li>
            <li><span className="font-medium">Free Will Paragraph</span> (Expected: 55) - Basic inferential step with low compression</li>
            <li><span className="font-medium">AI-Generated Text</span> (Expected: 40) - Random surface fluency without conceptual compression</li>
          </ul>
          <p className="text-gray-700 text-sm italic">
            The test ensures precise scoring: blueprint-grade writing scores 90-98, advanced critique 80-89, surface polish 60-79, fluent but shallow 40-59, random noise below 40.
          </p>
        </div>
        
        <Button
          onClick={runCalibrationTests}
          disabled={isRunningTests || !apiStatus.isConnected}
          className="flex items-center"
          variant={apiStatus.isConnected ? "default" : "outline"}
        >
          {isRunningTests ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-2"></div>
              Running Tests...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Run Calibration Tests
            </>
          )}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {results.length > 0 && (
        <div className="mt-4">
          <h3 className="font-medium text-gray-800 mb-2">Calibration Results</h3>
          <div className="bg-gray-50 rounded-md p-4 max-h-80 overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="pb-2">Sample</th>
                  <th className="pb-2">Expected</th>
                  <th className="pb-2">Actual</th>
                  <th className="pb-2">Diff</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, index) => (
                  <tr key={index} className="border-t border-gray-200">
                    <td className="py-2 pr-4 font-medium">{result.sample}</td>
                    <td className="py-2 pr-4">{result.expectedScore}</td>
                    <td className="py-2 pr-4">{result.actualScore.toFixed(1)}</td>
                    <td className={`py-2 ${Math.abs(result.difference) > 10 ? 'text-red-600' : 'text-green-600'}`}>
                      {result.difference > 0 ? '+' : ''}{result.difference.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalibrationTester;