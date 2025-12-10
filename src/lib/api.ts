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
      points: string[];
      score: number;
    };
    mediumTerm: {
      title: string;
      points: string[];
      score: number;
    };
    longTerm: {
      title: string;
      points: string[];
      score: number;
    };
    strengths: string[];
    risks: string[];
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
    shortTerm: analysis.shortTerm,
    mediumTerm: analysis.mediumTerm,
    longTerm: analysis.longTerm,
    strengths: analysis.strengths,
    risks: analysis.risks,
    summary: analysis.summary,
    generatedAt: new Date(generatedAt),
  };
}
