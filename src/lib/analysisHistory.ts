import { supabase } from '@/integrations/supabase/client';
import type { AnalysisFormData, AnalysisResult, LocationData } from '@/types/analysis';

export interface AnalysisHistoryItem {
  id: string;
  createdAt: string;
  expiresAt: string;
  title: string | null;
  location: LocationData | null;
  result: Omit<AnalysisResult, 'generatedAt'> & { generatedAt: string };
}

export const HISTORY_UPDATED_EVENT = 'analysis-history-updated';

const notifyChange = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(HISTORY_UPDATED_EVENT));
  }
};

const serializeResult = (result: AnalysisResult): AnalysisHistoryItem['result'] => ({
  ...result,
  generatedAt: result.generatedAt.toISOString(),
});

export const parseHistoryResult = (item: AnalysisHistoryItem): AnalysisResult => ({
  ...item.result,
  generatedAt: new Date(item.result.generatedAt),
});

function computeTitle(formData: AnalysisFormData, result: AnalysisResult): string {
  const loc = formData.location;
  if (loc?.city && loc?.district) return `${loc.city}, ${loc.district}`;
  return result.extractedInfo?.location || 'Arazi analizi';
}

interface DbRow {
  id: string;
  created_at: string;
  expires_at: string;
  title: string | null;
  location_json: LocationData | null;
  result_json: AnalysisHistoryItem['result'];
}

const rowToItem = (row: DbRow): AnalysisHistoryItem => ({
  id: row.id,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
  title: row.title,
  location: row.location_json,
  result: row.result_json,
});

export async function getAnalysisHistory(): Promise<AnalysisHistoryItem[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await (supabase as any)
    .from('analysis_reports')
    .select('id,created_at,expires_at,title,location_json,result_json')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Analysis history fetch error:', error);
    return [];
  }
  return (data as DbRow[] | null || []).map(rowToItem);
}

export async function saveAnalysisHistoryItem(
  formData: AnalysisFormData,
  result: AnalysisResult,
): Promise<AnalysisHistoryItem | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const payload = {
    user_id: user.id,
    location_json: formData.location || null,
    result_json: serializeResult(result),
    title: computeTitle(formData, result),
  };

  const { data, error } = await (supabase as any)
    .from('analysis_reports')
    .insert(payload)
    .select('id,created_at,expires_at,title,location_json,result_json')
    .single();

  if (error) {
    console.error('Analysis history save error:', error);
    return null;
  }

  notifyChange();
  return rowToItem(data as DbRow);
}

export async function removeAnalysisHistoryItem(id: string): Promise<void> {
  const { error } = await (supabase as any).from('analysis_reports').delete().eq('id', id);
  if (error) {
    console.error('Analysis history remove error:', error);
    return;
  }
  notifyChange();
}
