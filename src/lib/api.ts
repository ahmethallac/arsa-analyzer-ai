import { supabase } from "@/integrations/supabase/client";
import type { AnalysisResult, LocationData } from "@/types/analysis";

interface AnalyzeResponse {
  success: boolean;
  analysis: {
    extractedInfo: {
      price: string;
      sqm: string;
      pricePerSqm: string;
      location: string;
    };
    shortTerm: {
      title: string;
      points: Array<{ point: string; evidence: string }>;
      score: number;
    };
    mediumTerm: {
      title: string;
      points: Array<{ point: string; evidence: string }>;
      score: number;
    };
    longTerm: {
      title: string;
      points: Array<{ point: string; evidence: string }>;
      score: number;
    };
    developmentPlans: Array<{
      name: string;
      date: string;
      impact: string;
    }>;
    infrastructureProjects: Array<{
      name: string;
      status: string;
      expectedCompletion: string;
      impact: string;
    }>;
    priceAnalysis: {
      currentPricePerSqm: string;
      regionAverage: string;
      trend: string;
      comparison: string;
    };
    strengths: Array<{ point: string; evidence: string }>;
    risks: Array<{ point: string; evidence: string; severity: 'low' | 'medium' | 'high' }>;
    investmentRecommendation: {
      decision: 'BUY' | 'WAIT' | 'AVOID';
      reason: string;
      confidence: number;
    };
    summary: string;
  };
  generatedAt: string;
  error?: string;
}

export async function analyzeLand(
  imageBase64: string,
  location?: LocationData
): Promise<AnalysisResult> {
  const { data, error } = await supabase.functions.invoke<AnalyzeResponse>('analyze-land', {
    body: { imageBase64, location }
  });

  if (error) {
    console.error('Edge function error:', error);
    throw new Error(error.message || 'Analiz sırasında bir hata oluştu');
  }

  if (!data?.success || !data.analysis) {
    throw new Error(data?.error || 'Analiz sonucu alınamadı');
  }

  const { analysis, generatedAt } = data;

  return {
    extractedInfo: analysis.extractedInfo,
    shortTerm: analysis.shortTerm,
    mediumTerm: analysis.mediumTerm,
    longTerm: analysis.longTerm,
    developmentPlans: analysis.developmentPlans || [],
    infrastructureProjects: analysis.infrastructureProjects || [],
    priceAnalysis: analysis.priceAnalysis,
    strengths: analysis.strengths,
    risks: analysis.risks,
    investmentRecommendation: analysis.investmentRecommendation,
    summary: analysis.summary,
    generatedAt: new Date(generatedAt),
  };
}
