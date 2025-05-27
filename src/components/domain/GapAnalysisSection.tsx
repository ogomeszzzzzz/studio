'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle }
  from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import type { Product } from '@/types';
import { performGapAnalysis } from '@/app/actions';
import { Bot, Lightbulb, Loader2, AlertTriangle } from 'lucide-react';
import type { AnalyzeStockoutRisksOutput } from '@/ai/flows/collection-gap-analyzer';

interface GapAnalysisSectionProps {
  productsForAnalysis: Product[];
}

export function GapAnalysisSection({ productsForAnalysis }: GapAnalysisSectionProps) {
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeStockoutRisksOutput | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleAnalyzeGaps = async () => {
    if (productsForAnalysis.length === 0) {
      toast({
        title: "No Data for Analysis",
        description: "Please upload and process data, or adjust filters to include products for analysis.",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingAnalysis(true);
    setAnalysisResult(null);
    setAnalysisError(null);

    try {
      const result = await performGapAnalysis(productsForAnalysis);
      if ('error' in result) {
        setAnalysisError(result.error);
        toast({
          title: "Analysis Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        setAnalysisResult(result);
        toast({
          title: "Analysis Complete",
          description: "Gap analysis insights generated.",
        });
      }
    } catch (error) {
      console.error("Error in handleAnalyzeGaps:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      setAnalysisError(errorMessage);
      toast({
        title: "Analysis Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-xl">
          <Bot className="mr-2 h-6 w-6 text-primary" />
          AI Gap Analysis
        </CardTitle>
        <CardDescription>
          Utilize AI to identify potential stockout risks and collection gaps based on the current product data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleAnalyzeGaps} 
          disabled={isLoadingAnalysis || productsForAnalysis.length === 0}
          className="w-full sm:w-auto"
        >
          {isLoadingAnalysis ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Lightbulb className="mr-2 h-4 w-4" />
              Analyze Collection Gaps
            </>
          )}
        </Button>

        {analysisError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{analysisError}</AlertDescription>
          </Alert>
        )}

        {analysisResult && !analysisError && (
          <Alert>
            <Lightbulb className="h-4 w-4" />
            <AlertTitle>AI Analysis Insights</AlertTitle>
            <AlertDescription>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {analysisResult.analysisResults}
              </pre>
            </AlertDescription>
          </Alert>
        )}
         {productsForAnalysis.length === 0 && !isLoadingAnalysis && (
           <p className="text-sm text-muted-foreground">No products currently selected for analysis. Adjust filters or upload data.</p>
         )}
      </CardContent>
    </Card>
  );
}
