import React from 'react';
import { 
  Alert, 
  AlertTitle, 
  AlertDescription 
} from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

/**
 * A component that explains the blueprint detection rule in the intelligence scoring system
 */
const AntiSuperficialityBanner = () => {
  return (
    <Alert className="mb-6 bg-amber-50 border-amber-200">
      <AlertCircle className="h-5 w-5 text-amber-600" />
      <AlertTitle className="text-amber-800 font-medium text-sm">Blueprint Detection Rule</AlertTitle>
      <AlertDescription className="text-amber-700 text-sm">
        <p className="mb-2">
          Blueprint-grade thinking (90-98 score) MUST demonstrate original conceptual framing, not just polished critical commentary.
          No smoothing to 80 allowed.
        </p>
        <p className="mb-2">
          <span className="font-semibold">The core distinction:</span> Academic commentary (even brilliant) APPLIES existing conceptual frameworks.
          Blueprint thinking CREATES original conceptual frameworks and distinctions.
        </p>
        <p>
          Blueprint-grade scores require demonstrated <span className="font-medium">semantic compression</span>, 
          <span className="font-medium"> inferential continuity</span>, 
          <span className="font-medium"> conceptual originality</span>, and
          <span className="font-medium"> density of meaning</span>.
        </p>
      </AlertDescription>
    </Alert>
  );
};

export default AntiSuperficialityBanner;