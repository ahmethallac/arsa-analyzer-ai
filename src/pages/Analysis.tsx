import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Loader2, MapPin, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnalysisCard } from '@/components/AnalysisCard';
import { StrengthsRisks } from '@/components/StrengthsRisks';
import type { AnalysisResult, AnalysisFormData } from '@/types/analysis';

// Mock analysis result for now (will be replaced with AI)
const mockResult: AnalysisResult = {
  shortTerm: {
    title: 'Stabil Yatırım Fırsatı',
    points: [
      'Mevcut fiyat bölge ortalamasının altında',
      'Kısa vadede %10-15 değer artışı potansiyeli',
      'Altyapı yatırımları devam ediyor',
    ],
    score: 7,
  },
  mediumTerm: {
    title: 'Büyüme Potansiyeli Yüksek',
    points: [
      'Planlanan metro hattı bölgeye değer katacak',
      'Yeni konut projeleri bölgeyi canlandırıyor',
      'Ticari alan dönüşümü bekleniyor',
    ],
    score: 8,
  },
  longTerm: {
    title: 'Stratejik Konum Avantajı',
    points: [
      'Şehir genişleme aksında yer alıyor',
      'İmar planı değişikliği olasılığı yüksek',
      'Uzun vadede 3-5 kat değer artışı mümkün',
    ],
    score: 9,
  },
  strengths: [
    'Merkezi konuma yakınlık',
    'Ulaşım ağına erişim kolaylığı',
    'Gelişmekte olan bölge dinamiği',
    'Uygun giriş fiyatı',
  ],
  risks: [
    'İmar belirsizliği',
    'Altyapı eksiklikleri',
    'Piyasa dalgalanma riski',
    'Uzun vadeli bekleme süresi',
  ],
  summary:
    'Bu arsa, orta-uzun vadeli yatırım için uygun bir seçenek olarak değerlendirilmektedir. Bölgedeki gelişmeler ve planlanan altyapı projeleri düşünüldüğünde, sabırlı yatırımcılar için iyi bir getiri potansiyeli sunmaktadır.',
  generatedAt: new Date(),
};

export default function Analysis() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [formData, setFormData] = useState<AnalysisFormData | null>(null);

  useEffect(() => {
    const storedData = sessionStorage.getItem('analysisData');
    if (!storedData) {
      navigate('/');
      return;
    }

    setFormData(JSON.parse(storedData));

    // Simulate AI analysis delay
    const timer = setTimeout(() => {
      setResult(mockResult);
      setIsLoading(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  const handleDownloadPDF = () => {
    // TODO: Implement PDF generation
    alert('PDF indirme özelliği yakında eklenecek');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center px-4">
        <div className="text-center">
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-full gradient-primary mx-auto flex items-center justify-center shadow-glow animate-pulse">
              <Loader2 className="w-10 h-10 text-primary-foreground animate-spin" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Analiz Yapılıyor</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Verileriniz AI tarafından değerlendiriliyor, lütfen bekleyin...
          </p>
        </div>
      </div>
    );
  }

  if (!result || !formData) return null;

  return (
    <div className="min-h-screen gradient-hero">
      {/* Header */}
      <header className="sticky top-0 z-10 px-4 py-4 sm:px-6 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Geri
          </Button>
          <Button
            onClick={handleDownloadPDF}
            size="sm"
            className="gap-2 gradient-primary"
          >
            <Download className="w-4 h-4" />
            PDF İndir
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-6 sm:px-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Location Summary */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-accent">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">
                  {formData.location.city}, {formData.location.district}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {formData.location.neighborhood && `${formData.location.neighborhood}, `}
                  Ada: {formData.location.block}, Parsel: {formData.location.parcel}
                </p>
              </div>
            </div>
          </div>

          {/* Analysis Cards */}
          <div className="space-y-4">
            <AnalysisCard
              title={result.shortTerm.title}
              points={result.shortTerm.points}
              score={result.shortTerm.score}
              variant="short"
            />
            <AnalysisCard
              title={result.mediumTerm.title}
              points={result.mediumTerm.points}
              score={result.mediumTerm.score}
              variant="medium"
            />
            <AnalysisCard
              title={result.longTerm.title}
              points={result.longTerm.points}
              score={result.longTerm.score}
              variant="long"
            />
          </div>

          {/* Strengths & Risks */}
          <StrengthsRisks strengths={result.strengths} risks={result.risks} />

          {/* Summary */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-accent">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Özet Değerlendirme</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {result.summary}
            </p>
            <p className="text-xs text-muted-foreground mt-4">
              Oluşturulma: {result.generatedAt.toLocaleDateString('tr-TR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>

          {/* Disclaimer */}
          <p className="text-center text-xs text-muted-foreground px-4">
            Bu analiz yalnızca bilgilendirme amaçlıdır. Yatırım kararlarınızda profesyonel danışmanlık almanız önerilir.
          </p>
        </div>
      </main>
    </div>
  );
}
