import { createContext, useContext, useState, ReactNode } from 'react';
import type { AnalysisFormData } from '@/types/analysis';

interface AnalysisDataContextType {
  analysisData: AnalysisFormData | null;
  setAnalysisData: (data: AnalysisFormData | null) => void;
  clearAnalysisData: () => void;
}

const AnalysisDataContext = createContext<AnalysisDataContextType | undefined>(undefined);
const STORAGE_KEY = 'arsa_analiz_pending_analysis';

const loadStoredAnalysisData = (): AnalysisFormData | null => {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) as AnalysisFormData : null;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

export function AnalysisDataProvider({ children }: { children: ReactNode }) {
  const [analysisDataState, setAnalysisDataState] = useState<AnalysisFormData | null>(loadStoredAnalysisData);

  const setAnalysisData = (data: AnalysisFormData | null) => {
    setAnalysisDataState(data);

    if (data) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  };

  const clearAnalysisData = () => {
    setAnalysisData(null);
  };

  return (
    <AnalysisDataContext.Provider value={{ analysisData: analysisDataState, setAnalysisData, clearAnalysisData }}>
      {children}
    </AnalysisDataContext.Provider>
  );
}

export function useAnalysisData() {
  const context = useContext(AnalysisDataContext);
  if (context === undefined) {
    throw new Error('useAnalysisData must be used within an AnalysisDataProvider');
  }
  return context;
}
