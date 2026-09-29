import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Brain, TrendingUp, Network, Zap, Eye, Settings } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface CognitiveMarkers {
  semanticCompression: {
    score: number;
    density: number;
    conceptualLoad: number;
    compressionRatio: number;
  };
  inferentialContinuity: {
    score: number;
    chainLength: number;
    gapFrequency: number;
    coherenceIndex: number;
  };
  semanticTopology: {
    score: number;
    gradient: number;
    curvature: number;
    nodeDensity: number;
    connectivity: number;
  };
  cognitiveAsymmetry: {
    score: number;
    weightDistribution: number;
    effortGradient: number;
    complexitySpikes: number;
  };
  epistemicResistance: {
    score: number;
    nonObviousness: number;
    cognitiveEffort: number;
    noveltyIndex: number;
  };
  metacognitiveAwareness: {
    score: number;
    selfReflection: number;
    limitRecognition: number;
    assumptionExploration: number;
  };
}

interface CognitiveEvaluation {
  markers: CognitiveMarkers;
  overallScore: number;
  variance: number;
  tier: string;
  analysis: string;
  metadata: {
    contentLength: number;
    tier: string;
    overridesApplied: number;
    timestamp: string;
  };
}

const TIER_OPTIONS = [
  { value: 'rapid', label: 'Rapid Assessment', description: 'Quick analysis focusing on core markers' },
  { value: 'standard', label: 'Standard Analysis', description: 'Balanced evaluation across key dimensions' },
  { value: 'comprehensive', label: 'Deep Cognitive Profile', description: 'Complete analysis of all cognitive markers' }
];

const MARKER_ICONS = {
  semanticCompression: Brain,
  inferentialContinuity: TrendingUp,
  semanticTopology: Network,
  cognitiveAsymmetry: Zap,
  epistemicResistance: Eye,
  metacognitiveAwareness: Settings
};

const MARKER_DESCRIPTIONS = {
  semanticCompression: 'Information density and conceptual efficiency',
  inferentialContinuity: 'Logical flow and argumentative coherence',
  semanticTopology: 'Conceptual landscape complexity and connectivity',
  cognitiveAsymmetry: 'Uneven conceptual difficulty distribution',
  epistemicResistance: 'Non-obvious insights and cognitive friction',
  metacognitiveAwareness: 'Self-reflection and assumption exploration'
};

export default function CognitiveEvaluationPanel() {
  const [text, setText] = useState('');
  const [tier, setTier] = useState('standard');
  const [evaluation, setEvaluation] = useState<CognitiveEvaluation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEvaluate = async () => {
    if (!text.trim()) {
      setError('Please enter text to evaluate');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/cognitive-evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: text,
          tier: tier,
          overrides: {}
        })
      });

      const data = await response.json();

      if (data.success) {
        setEvaluation(data.evaluation);
      } else {
        setError(data.error || 'Evaluation failed');
      }
    } catch (err: any) {
      setError(err.message || 'Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getVarianceDescription = (variance: number) => {
    if (variance < 10) return 'Uniform cognitive profile';
    if (variance < 20) return 'Moderate cognitive variation';
    if (variance < 30) return 'High cognitive diversity';
    return 'Extreme cognitive asymmetry';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Cognitive Intelligence Evaluation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Text to Analyze</label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter text for cognitive analysis..."
              className="min-h-[120px]"
            />
          </div>

          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Analysis Tier</label>
              <Select value={tier} onValueChange={setTier}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleEvaluate} 
              disabled={loading || !text.trim()}
              className="min-w-[120px]"
            >
              {loading ? 'Analyzing...' : 'Evaluate'}
            </Button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {evaluation && (
        <div className="space-y-6">
          {/* Overall Results */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Overall Intelligence Assessment</span>
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {evaluation.overallScore}/100
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Intelligence Score</div>
                  <div className={`text-2xl font-bold ${getScoreColor(evaluation.overallScore)}`}>
                    {evaluation.overallScore}/100
                  </div>
                  <Progress value={evaluation.overallScore} className="h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm font-medium">Cognitive Variance</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {evaluation.variance.toFixed(1)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {getVarianceDescription(evaluation.variance)}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm font-medium">Analysis Tier</div>
                  <Badge variant="secondary" className="text-sm">
                    {evaluation.tier}
                  </Badge>
                  <div className="text-xs text-muted-foreground">
                    {evaluation.metadata.contentLength} characters analyzed
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-sm font-medium">Analysis Summary</div>
                <div className="text-sm text-muted-foreground bg-gray-50 p-3 rounded-md">
                  {evaluation.analysis}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cognitive Markers Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Cognitive Markers Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {Object.entries(evaluation.markers).map(([markerKey, markerData]) => {
                  const IconComponent = MARKER_ICONS[markerKey as keyof typeof MARKER_ICONS];
                  const description = MARKER_DESCRIPTIONS[markerKey as keyof typeof MARKER_DESCRIPTIONS];
                  
                  return (
                    <div key={markerKey} className="space-y-3 p-4 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <IconComponent className="h-4 w-4 text-blue-600" />
                        <div className="font-medium capitalize">
                          {markerKey.replace(/([A-Z])/g, ' $1').trim()}
                        </div>
                        <Badge variant="outline" className={getScoreColor(markerData.score)}>
                          {markerData.score}
                        </Badge>
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        {description}
                      </div>
                      
                      <Progress value={markerData.score} className="h-2" />
                      
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {Object.entries(markerData).filter(([key]) => key !== 'score').map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-muted-foreground capitalize">
                              {key.replace(/([A-Z])/g, ' $1').trim()}:
                            </span>
                            <span className="font-mono">
                              {typeof value === 'number' ? value.toFixed(3) : String(value || 'N/A')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}