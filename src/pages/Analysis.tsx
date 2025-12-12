import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Loader2, MapPin, FileText, TrendingUp, MessageCircle, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnalysisCard } from '@/components/AnalysisCard';
import { StrengthsRisks } from '@/components/StrengthsRisks';
import { useToast } from '@/hooks/use-toast';
import { analyzeLand } from '@/lib/api';
import type { AnalysisResult, AnalysisFormData } from '@/types/analysis';

export default function Analysis() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [formData, setFormData] = useState<AnalysisFormData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedData = sessionStorage.getItem('analysisData');
    if (!storedData) {
      navigate('/');
      return;
    }

    const parsedData: AnalysisFormData = JSON.parse(storedData);
    setFormData(parsedData);

    // Find sahibinden image
    const sahibindenImage = parsedData.images.find(img => img.type === 'sahibinden');
    
    if (!sahibindenImage) {
      setError('Görsel bulunamadı');
      setIsLoading(false);
      return;
    }

    // Call AI analysis
    analyzeLand(sahibindenImage.preview, parsedData.location)
      .then((analysisResult) => {
        setResult(analysisResult);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Analysis error:', err);
        setError(err.message || 'Analiz sırasında bir hata oluştu');
        setIsLoading(false);
        toast({
          title: 'Hata',
          description: err.message || 'Analiz sırasında bir hata oluştu',
          variant: 'destructive',
        });
      });
  }, [navigate, toast]);

  const handleDownloadPDF = () => {
    // TODO: Implement PDF generation
    toast({
      title: 'Bilgi',
      description: 'PDF indirme özelliği yakında eklenecek',
    });
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
          <h2 className="text-xl font-semibold text-foreground mb-2">AI Analiz Yapılıyor</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Sahibinden görseliniz yapay zeka tarafından analiz ediliyor, bu işlem 20-30 saniye sürebilir...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-destructive/10 mx-auto flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Analiz Başarısız</h2>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => navigate('/')} className="gradient-primary">
            Tekrar Dene
          </Button>
        </div>
      </div>
    );
  }

  if (!result || !formData) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-muted mx-auto flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Veri Bulunamadı</h2>
          <p className="text-sm text-muted-foreground mb-6">Analiz verileri yüklenemedi. Lütfen tekrar deneyin.</p>
          <Button onClick={() => navigate('/')} className="gradient-primary">
            Ana Sayfaya Dön
          </Button>
        </div>
      </div>
    );
  }

  const hasLocationData = formData.location?.city && formData.location?.district;

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
          {hasLocationData && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-accent">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">
                    {formData.location.city}, {formData.location.district}
                  </h2>
                  {(formData.location.neighborhood || formData.location.block || formData.location.parcel) && (
                    <p className="text-sm text-muted-foreground">
                      {formData.location.neighborhood && `${formData.location.neighborhood}, `}
                      {formData.location.block && `Ada: ${formData.location.block}`}
                      {formData.location.parcel && `, Parsel: ${formData.location.parcel}`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* General Assessment */}
          {result.generalAssessment && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className={`p-2 rounded-lg ${
                  result.generalAssessment.verdict === 'FIRSAT' ? 'bg-green-500/10' :
                  result.generalAssessment.verdict === 'RİSKLİ' ? 'bg-red-500/10' : 'bg-yellow-500/10'
                }`}>
                  {result.generalAssessment.verdict === 'FIRSAT' ? (
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  ) : result.generalAssessment.verdict === 'RİSKLİ' ? (
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  ) : (
                    <FileText className="w-5 h-5 text-yellow-600" />
                  )}
                </div>
                <div>
                  <span className={`text-sm font-bold ${
                    result.generalAssessment.verdict === 'FIRSAT' ? 'text-green-600' :
                    result.generalAssessment.verdict === 'RİSKLİ' ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    {result.generalAssessment.verdict}
                  </span>
                </div>
              </div>
              <p className="text-sm text-foreground leading-relaxed font-medium">
                {result.generalAssessment.summary}
              </p>
            </div>
          )}

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

          {/* Personal Recommendation */}
          {result.personalRecommendation && (
            <div className="rounded-2xl border-2 border-primary bg-card p-5 shadow-lg">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <MessageCircle className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-bold text-foreground">Ben Olsaydım...</h3>
              </div>
              <div className="flex items-center gap-2 mb-3">
                {result.personalRecommendation.decision.includes('ALIRIM') || result.personalRecommendation.decision.includes('KESİNLİKLE') ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : result.personalRecommendation.decision.includes('ALMAM') || result.personalRecommendation.decision.includes('ASLA') ? (
                  <XCircle className="w-6 h-6 text-red-600" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-yellow-600" />
                )}
                <span className={`text-lg font-bold ${
                  result.personalRecommendation.decision.includes('ALIRIM') || result.personalRecommendation.decision.includes('KESİNLİKLE') ? 'text-green-600' :
                  result.personalRecommendation.decision.includes('ALMAM') || result.personalRecommendation.decision.includes('ASLA') ? 'text-red-600' : 'text-yellow-600'
                }`}>
                  {result.personalRecommendation.decision}
                </span>
              </div>
              <p className="text-sm text-foreground leading-relaxed mb-3">
                {result.personalRecommendation.statement}
              </p>
              {result.personalRecommendation.conditions && (
                <p className="text-xs text-muted-foreground italic border-t border-border pt-3">
                  💡 {result.personalRecommendation.conditions}
                </p>
              )}
            </div>
          )}

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
