import { createContext, useContext, useState, ReactNode } from 'react';
import type { AnalysisFormData } from '@/types/analysis';

interface AnalysisDataContextType {
  analysisData: AnalysisFormData | null;
  setAnalysisData: (data: AnalysisFormData | null) => void;
  clearAnalysisData: () => void;
}

const AnalysisDataContext = createContext<AnalysisDataContextType | undefined>(undefined);

export function AnalysisDataProvider({ children }: { children: ReactNode }) {
  const [analysisData, setAnalysisData] = useState<AnalysisFormData | null>(null);

  const clearAnalysisData = () => {
    setAnalysisData(null);
  };

  return (
    <AnalysisDataContext.Provider value={{ analysisData, setAnalysisData, clearAnalysisData }}>
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
