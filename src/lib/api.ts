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

interface ConsumeCreditResponse {
  success: boolean;
  error?: string;
}

async function readFunctionError(error: unknown): Promise<string> {
  const context = (error as { context?: unknown }).context;

  if (context instanceof Response) {
    let backendMessage = '';
    try {
      const errorPayload = await context.clone().json();
      if (errorPayload?.error) {
        backendMessage = errorPayload.error;
      }
    } catch {
      // Response may not be JSON.
    }

    if (!backendMessage) {
      const errorText = await context.clone().text().catch(() => '');
      if (errorText) {
        backendMessage = errorText;
      }
    }

    if (backendMessage) {
      return backendMessage;
    }
  }

  return error instanceof Error ? error.message : '';
}

export async function analyzeLand(
  imageBase64?: string,
  location?: LocationData,
  additionalImages?: string[],
  deviceId?: string
): Promise<AnalysisResult> {
  const { data, error } = await supabase.functions.invoke<AnalyzeResponse>('analyze-land', {
    body: { imageBase64, location, additionalImages, deviceId }
  });

  if (error) {
    console.error('Edge function error:', error);
    const backendMessage = await readFunctionError(error);
    if (backendMessage) {
      throw new Error(backendMessage);
    }

    throw new Error(error.message || 'Analiz sırasında bir hata oluştu');
  }

  if (!data?.success || !data.analysis) {
    throw new Error(data?.error || 'Analiz sonucu alınamadı');
  }

  const { analysis, generatedAt } = data;

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

export async function consumeAnalysisCredit(deviceId?: string): Promise<void> {
  if (!deviceId) {
    throw new Error('Oturum cihaz kimliği hazırlanamadı');
  }

  const { data, error } = await supabase.functions.invoke<ConsumeCreditResponse>('consume-analysis-credit', {
    body: { deviceId },
  });

  if (error) {
    console.error('Credit consume function error:', error);
    const backendMessage = await readFunctionError(error);
    throw new Error(backendMessage || 'Kredi düşümü tamamlanamadı');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Kredi düşümü tamamlanamadı');
  }
}
