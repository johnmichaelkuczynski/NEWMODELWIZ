import React from 'react';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorFallbackProps {
  error: Error | string;
  resetErrorBoundary?: () => void;
  provider?: string;
}

export const ErrorMessage: React.FC<ErrorFallbackProps> = ({ 
  error, 
  resetErrorBoundary,
  provider = "AI provider"
}) => {
  const errorMessage = typeof error === 'string' ? error : error.message;
  
  const handleRetry = () => {
    if (resetErrorBoundary) {
      resetErrorBoundary();
    } else {
      window.location.reload();
    }
  };

  return (
    <Card className="w-full border-red-200 bg-red-50">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center text-red-700">
          <AlertCircle className="mr-2 h-5 w-5" />
          Analysis Error
        </CardTitle>
        <CardDescription className="text-red-600">
          We encountered an issue with {provider}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-red-800 whitespace-pre-wrap">
          {errorMessage}
        </div>
        <p className="mt-4 text-sm text-gray-600">
          This could be due to rate limits, connectivity issues, or API errors. Try again or switch to a different AI provider.
        </p>
      </CardContent>
      <CardFooter>
        <Button 
          variant="outline" 
          className="border-red-300 hover:bg-red-100 text-red-700"
          onClick={handleRetry}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </CardFooter>
    </Card>
  );
};

export default function ErrorFallback({ error, resetErrorBoundary, provider }: ErrorFallbackProps) {
  return (
    <div className="p-4 w-full">
      <ErrorMessage 
        error={error} 
        resetErrorBoundary={resetErrorBoundary} 
        provider={provider}
      />
    </div>
  );
}