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
      parcelInfo?: string;
      currentZoning?: string;
    };
    generalAssessment: {
      verdict: string;
      summary: string;
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
    strengths: Array<{ point: string; evidence: string }>;
    risks: Array<{ point: string; evidence: string; severity: string }>;
    personalRecommendation: {
      decision: string;
      statement: string;
      conditions?: string;
    };
    summary: string;
  };
  generatedAt: string;
  error?: string;
}

export async function analyzeLand(
  imageBase64?: string,
  location?: LocationData,
  additionalImages?: string[]
): Promise<AnalysisResult> {
  const { data, error } = await supabase.functions.invoke<AnalyzeResponse>('analyze-land', {
    body: { imageBase64, location, additionalImages }
  });

  if (error) {
    console.error('Edge function error:', error);
    throw new Error(error.message || 'Analiz sırasında bir hata oluştu');
  }

  if (!data?.success || !data.analysis) {
    throw new Error(data?.error || 'Analiz sonucu alınamadı');
  }

  const { analysis, generatedAt } = data;

  // Map severity values to expected types
  const mapSeverity = (severity: string): 'low' | 'medium' | 'high' => {
    const s = severity?.toLowerCase();
    if (s === 'düşük' || s === 'low') return 'low';
    if (s === 'yüksek' || s === 'high') return 'high';
    return 'medium';
  };

  return {
    extractedInfo: analysis.extractedInfo,
    generalAssessment: analysis.generalAssessment || { verdict: '', summary: '' },
    shortTerm: analysis.shortTerm,
    mediumTerm: analysis.mediumTerm,
    longTerm: analysis.longTerm,
    strengths: analysis.strengths || [],
    risks: (analysis.risks || []).map(r => ({
      ...r,
      severity: mapSeverity(r.severity)
    })),
    personalRecommendation: analysis.personalRecommendation || { decision: '', statement: '' },
    summary: analysis.summary,
    generatedAt: new Date(generatedAt),
  };
}
