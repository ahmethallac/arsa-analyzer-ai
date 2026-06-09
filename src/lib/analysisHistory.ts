import type { AnalysisFormData, AnalysisResult, LocationData } from '@/types/analysis';

export interface AnalysisHistoryItem {
  id: string;
  createdAt: string;
  location: LocationData | null;
  result: Omit<AnalysisResult, 'generatedAt'> & { generatedAt: string };
}

const HISTORY_KEY = 'arsa_analiz_history';
const MAX_HISTORY_ITEMS = 25;

const serializeResult = (result: AnalysisResult): AnalysisHistoryItem['result'] => ({
  ...result,
  generatedAt: result.generatedAt.toISOString(),
});

export const parseHistoryResult = (item: AnalysisHistoryItem): AnalysisResult => ({
  ...item.result,
  generatedAt: new Date(item.result.generatedAt),
});

export function getAnalysisHistory(): AnalysisHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAnalysisHistoryItem(formData: AnalysisFormData, result: AnalysisResult): AnalysisHistoryItem {
  const item: AnalysisHistoryItem = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    location: formData.location || null,
    result: serializeResult(result),
  };

  const nextHistory = [item, ...getAnalysisHistory()].slice(0, MAX_HISTORY_ITEMS);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
  window.dispatchEvent(new Event('analysis-history-updated'));
  return item;
}

export function removeAnalysisHistoryItem(id: string) {
  const nextHistory = getAnalysisHistory().filter((item) => item.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
  window.dispatchEvent(new Event('analysis-history-updated'));
}
