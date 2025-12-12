import { useState, useEffect } from 'react';
import { Loader2, Search, FileText, Brain, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnalysisStep {
  id: string;
  label: string;
  icon: React.ReactNode;
  duration: number;
}

const analysisSteps: AnalysisStep[] = [
  {
    id: 'extract',
    label: 'İlan bilgileri çıkarılıyor...',
    icon: <FileText className="w-5 h-5" />,
    duration: 5000,
  },
  {
    id: 'research',
    label: 'Bölge fiyat araştırması yapılıyor...',
    icon: <Search className="w-5 h-5" />,
    duration: 8000,
  },
  {
    id: 'analyze',
    label: 'Resmi duyurular ve imar planları inceleniyor...',
    icon: <FileText className="w-5 h-5" />,
    duration: 10000,
  },
  {
    id: 'evaluate',
    label: 'AI detaylı değerlendirme yapıyor...',
    icon: <Brain className="w-5 h-5" />,
    duration: 7000,
  },
];

export function AnalysisLoading() {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const totalDuration = analysisSteps.reduce((acc, step) => acc + step.duration, 0);
    let elapsed = 0;

    const interval = setInterval(() => {
      elapsed += 100;
      
      // Calculate overall progress
      const newProgress = Math.min((elapsed / totalDuration) * 100, 95);
      setProgress(newProgress);

      // Calculate current step
      let accumulatedDuration = 0;
      for (let i = 0; i < analysisSteps.length; i++) {
        accumulatedDuration += analysisSteps[i].duration;
        if (elapsed < accumulatedDuration) {
          setCurrentStep(i);
          break;
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="relative mb-6 inline-block">
            <div className="w-24 h-24 rounded-full gradient-primary flex items-center justify-center shadow-glow">
              <Loader2 className="w-12 h-12 text-primary-foreground animate-spin" />
            </div>
            <div className="absolute -inset-2 rounded-full border-2 border-primary/20 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            AI Analiz Yapılıyor
          </h2>
          <p className="text-sm text-muted-foreground">
            Lütfen bekleyin, bu işlem 20-30 saniye sürebilir
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>İlerleme</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full gradient-primary transition-all duration-300 ease-out rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {analysisSteps.map((step, index) => {
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;

            return (
              <div
                key={step.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl transition-all duration-300',
                  isActive && 'bg-card shadow-sm border border-border',
                  isCompleted && 'opacity-60',
                  !isActive && !isCompleted && 'opacity-40'
                )}
              >
                <div
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    isActive && 'bg-primary/10 text-primary',
                    isCompleted && 'bg-success/10 text-success',
                    !isActive && !isCompleted && 'bg-secondary text-muted-foreground'
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : isActive ? (
                    <div className="animate-pulse">{step.icon}</div>
                  ) : (
                    step.icon
                  )}
                </div>
                <span
                  className={cn(
                    'text-sm font-medium',
                    isActive && 'text-foreground',
                    isCompleted && 'text-muted-foreground line-through',
                    !isActive && !isCompleted && 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
