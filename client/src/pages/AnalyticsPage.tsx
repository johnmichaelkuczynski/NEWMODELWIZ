import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, TrendingUp, FileText, Clock, Target, Lightbulb, BarChart3, Mail } from 'lucide-react';

interface CognitiveProfile {
  userEmail: string;
  writingPatterns: {
    avgSentenceLength: number;
    vocabularyComplexity: 'low' | 'medium' | 'high';
    preferredTopics: string[];
    conceptualDepth: number;
  };
  intellectualInterests: {
    primaryDomains: string[];
    explorationPatterns: string[];
    learningVelocity: number;
  };
  cognitiveStyle: {
    analyticalVsIntuitive: number; // 1-10 scale
    detailVsBigPicture: number;
    systematicVsCreative: number;
  };
  collaborationStyle: {
    aiInteractionPatterns: string[];
    feedbackReceptiveness: number;
    iterationFrequency: number;
  };
  psychologicalProfile: {
    curiosityIndex: number;
    persistenceLevel: number;
    innovationTendency: number;
    riskTolerance: number;
  };
  behavioralMetrics: {
    averageSessionLength: number;
    totalDocumentsProcessed: number;
    rewriteFrequency: number;
    preferredComplexity: 'increasing' | 'stable' | 'simplifying';
  };
}

interface UserActivity {
  timestamp: string;
  activityType: string;
  complexity: number;
  duration: number;
}

export const AnalyticsPage = () => {
  const [userEmail, setUserEmail] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [cognitiveProfile, setCognitiveProfile] = useState<CognitiveProfile | null>(null);
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEmailAuth = async () => {
    if (!userEmail.trim()) return;
    
    setIsLoading(true);
    try {
      // Create/get user and fetch their cognitive profile
      const userResponse = await fetch('/api/user/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail })
      });

      if (userResponse.ok) {
        setIsAuthenticated(true);
        
        // Fetch cognitive profile
        const profileResponse = await fetch(`/api/user/cognitive-profile?email=${userEmail}`);
        if (profileResponse.ok) {
          const profile = await profileResponse.json();
          setCognitiveProfile(profile);
        }

        // Fetch activity history
        const activitiesResponse = await fetch(`/api/user/activities?email=${userEmail}`);
        if (activitiesResponse.ok) {
          const activitiesData = await activitiesResponse.json();
          setActivities(activitiesData);
        }
      }
    } catch (error) {
      console.error('Authentication error:', error);
    }
    setIsLoading(false);
  };

  const renderCognitiveInsights = () => {
    if (!cognitiveProfile) return null;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Cognitive Style Analysis */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Cognitive Style
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Analytical vs Intuitive</span>
                  <span>{cognitiveProfile.cognitiveStyle.analyticalVsIntuitive}/10</span>
                </div>
                <Progress value={cognitiveProfile.cognitiveStyle.analyticalVsIntuitive * 10} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Detail vs Big Picture</span>
                  <span>{cognitiveProfile.cognitiveStyle.detailVsBigPicture}/10</span>
                </div>
                <Progress value={cognitiveProfile.cognitiveStyle.detailVsBigPicture * 10} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Systematic vs Creative</span>
                  <span>{cognitiveProfile.cognitiveStyle.systematicVsCreative}/10</span>
                </div>
                <Progress value={cognitiveProfile.cognitiveStyle.systematicVsCreative * 10} />
              </div>
            </CardContent>
          </Card>

          {/* Psychological Profile */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Psychological Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Curiosity Index</span>
                  <span>{cognitiveProfile.psychologicalProfile.curiosityIndex}/10</span>
                </div>
                <Progress value={cognitiveProfile.psychologicalProfile.curiosityIndex * 10} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Persistence Level</span>
                  <span>{cognitiveProfile.psychologicalProfile.persistenceLevel}/10</span>
                </div>
                <Progress value={cognitiveProfile.psychologicalProfile.persistenceLevel * 10} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Innovation Tendency</span>
                  <span>{cognitiveProfile.psychologicalProfile.innovationTendency}/10</span>
                </div>
                <Progress value={cognitiveProfile.psychologicalProfile.innovationTendency * 10} />
              </div>
            </CardContent>
          </Card>

          {/* Writing Patterns */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Writing Patterns
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <span className="text-sm font-medium">Vocabulary Complexity</span>
                <Badge variant={cognitiveProfile.writingPatterns.vocabularyComplexity === 'high' ? 'default' : 'secondary'}>
                  {cognitiveProfile.writingPatterns.vocabularyComplexity}
                </Badge>
              </div>
              <div>
                <span className="text-sm font-medium">Avg Sentence Length</span>
                <p className="text-sm text-gray-600">{cognitiveProfile.writingPatterns.avgSentenceLength} words</p>
              </div>
              <div>
                <span className="text-sm font-medium">Conceptual Depth</span>
                <Progress value={cognitiveProfile.writingPatterns.conceptualDepth * 10} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Intellectual Interests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Intellectual Interests & Patterns
            </CardTitle>
            <CardDescription>
              Analysis of your cognitive focus areas and learning patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">Primary Domains</h4>
                <div className="flex flex-wrap gap-2">
                  {cognitiveProfile.intellectualInterests.primaryDomains.map((domain, idx) => (
                    <Badge key={idx} variant="outline">{domain}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-2">Exploration Patterns</h4>
                <div className="flex flex-wrap gap-2">
                  {cognitiveProfile.intellectualInterests.explorationPatterns.map((pattern, idx) => (
                    <Badge key={idx} variant="secondary">{pattern}</Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Learning Velocity</span>
                <span>{cognitiveProfile.intellectualInterests.learningVelocity}/10</span>
              </div>
              <Progress value={cognitiveProfile.intellectualInterests.learningVelocity * 10} />
            </div>
          </CardContent>
        </Card>

        {/* Behavioral Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Behavioral Metrics & Productivity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{cognitiveProfile.behavioralMetrics.totalDocumentsProcessed}</div>
                <p className="text-sm text-gray-600">Documents Processed</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{cognitiveProfile.behavioralMetrics.averageSessionLength}m</div>
                <p className="text-sm text-gray-600">Avg Session Length</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{cognitiveProfile.behavioralMetrics.rewriteFrequency}x</div>
                <p className="text-sm text-gray-600">Rewrite Frequency</p>
              </div>
              <div className="text-center">
                <Badge variant={cognitiveProfile.behavioralMetrics.preferredComplexity === 'increasing' ? 'default' : 'secondary'}>
                  {cognitiveProfile.behavioralMetrics.preferredComplexity}
                </Badge>
                <p className="text-sm text-gray-600 mt-1">Complexity Trend</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Collaboration Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              AI Collaboration Style
            </CardTitle>
            <CardDescription>
              How you interact with AI systems and process feedback
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Interaction Patterns</h4>
                <div className="flex flex-wrap gap-2">
                  {cognitiveProfile.collaborationStyle.aiInteractionPatterns.map((pattern, idx) => (
                    <Badge key={idx} variant="outline">{pattern}</Badge>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Feedback Receptiveness</span>
                    <span>{cognitiveProfile.collaborationStyle.feedbackReceptiveness}/10</span>
                  </div>
                  <Progress value={cognitiveProfile.collaborationStyle.feedbackReceptiveness * 10} />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Iteration Frequency</span>
                    <span>{cognitiveProfile.collaborationStyle.iterationFrequency}/10</span>
                  </div>
                  <Progress value={cognitiveProfile.collaborationStyle.iterationFrequency * 10} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Brain className="h-6 w-6" />
              Cognitive Analytics
            </CardTitle>
            <CardDescription>
              Enter your email to access your personal cognitive profile and analytics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="your.email@example.com"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEmailAuth()}
              />
            </div>
            <Button 
              onClick={handleEmailAuth} 
              disabled={!userEmail.trim() || isLoading}
              className="w-full"
            >
              {isLoading ? 'Loading...' : 'Access Analytics'}
            </Button>
            <p className="text-xs text-gray-500 text-center">
              No login required. Your data is linked to your email for easy access to past activity and cognitive insights.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Cognitive Analytics</h1>
              <p className="text-gray-600 mt-1">
                Deep insights into your thinking patterns, writing evolution, and cognitive style
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Mail className="h-4 w-4" />
              {userEmail}
            </div>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile">Cognitive Profile</TabsTrigger>
            <TabsTrigger value="evolution">Evolution Timeline</TabsTrigger>
            <TabsTrigger value="predictions">AI Predictions</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            {cognitiveProfile ? renderCognitiveInsights() : (
              <Card>
                <CardContent className="p-6 text-center">
                  <Brain className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-medium mb-2">Building Your Profile</h3>
                  <p className="text-gray-600">
                    Upload and analyze documents to start building your cognitive profile. 
                    The more you use the system, the deeper the insights become.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="evolution">
            <Card>
              <CardHeader>
                <CardTitle>Cognitive Evolution Timeline</CardTitle>
                <CardDescription>
                  Track how your thinking patterns and writing style have evolved over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activities.map((activity, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-3 border rounded-lg">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <span className="font-medium">{activity.activityType}</span>
                          <span className="text-sm text-gray-500">{activity.timestamp}</span>
                        </div>
                        <div className="text-sm text-gray-600">
                          Complexity: {activity.complexity}/10 • Duration: {activity.duration}m
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="predictions">
            <Card>
              <CardHeader>
                <CardTitle>AI-Powered Predictions</CardTitle>
                <CardDescription>
                  Insights about your future learning trajectory and cognitive development
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <Lightbulb className="h-12 w-12 mx-auto mb-4" />
                  <p>Predictive analytics will appear here as your profile develops</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};