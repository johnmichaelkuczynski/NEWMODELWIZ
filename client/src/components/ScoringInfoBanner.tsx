import React, { useState } from 'react';
import { Info, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AntiSuperficialityBanner from './AntiSuperficialityBanner';

const ScoringInfoBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <>
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6 relative">
        <Button 
          variant="ghost" 
          size="sm" 
          className="absolute top-2 right-2 text-gray-500 h-6 w-6 p-0"
          onClick={() => setIsVisible(false)}
        >
          <X className="h-4 w-4" />
        </Button>
        
        <div className="flex items-start">
          <Info className="h-5 w-5 text-blue-500 mt-1 mr-3 flex-shrink-0" />
          
          <div className="text-sm text-blue-800">
            <h3 className="font-semibold mb-1">About the Intelligence Scoring System</h3>
            <p className="mb-2">
              Our cognitive fingerprinting system evaluates writing samples on a scale from 0-100 based exclusively on:
            </p>
            
            <ul className="list-disc pl-5 mb-2 space-y-1">
              <li><span className="font-medium">Semantic Compression</span>: Dense meaning packed into minimal language</li>
              <li><span className="font-medium">Inferential Continuity</span>: Logical necessity between claims</li>
              <li><span className="font-medium">Conceptual Originality</span>: Creation of new cognitive frameworks</li>
              <li><span className="font-medium">Density of Meaning</span>: Rich web of relations between concepts</li>
            </ul>
            
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded p-3">
              <div className="flex items-start">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-amber-800">Mandatory Scoring Law</p>
                  <p className="text-xs text-amber-700">
                    Blueprint fingerprint detected → 90–98 <br/>
                    Advanced critique without blueprinting → 80–89 <br/>
                    Surface polish without compression → 60–79 <br/>
                    Fluent but shallow → 40–59 <br/>
                    Random noise → 0–39
                  </p>
                </div>
              </div>
            </div>
            
            <p className="text-xs text-blue-600 italic mt-3">
              Calibrated scoring: Surface features (grammar, polish, completeness) are NOT factored into scores. 
              True blueprint thinking must score 90+ while generic AI content scores 40.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default ScoringInfoBanner;