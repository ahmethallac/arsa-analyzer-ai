import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/Footer';
import { AnalysisLoading } from '@/components/AnalysisLoading';
import { AnalysisReportContent } from '@/components/AnalysisReportContent';
import { useToast } from '@/hooks/use-toast';
import { usePdfDownload } from '@/hooks/usePdfDownload';
import { useDevice } from '@/hooks/useDevice';
import { useAnalysisData } from '@/contexts/AnalysisDataContext';
import { analyzeLand, toFriendlyErrorMessage } from '@/lib/api';
import { saveAnalysisHistoryItem } from '@/lib/analysisHistory';
import type { AnalysisResult, AnalysisFormData } from '@/types/analysis';

export default function Analysis() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { deviceId, profile, loading: profileLoading, refreshProfile } = useDevice();
  const { analysisData, clearAnalysisData } = useAnalysisData();
  const [isLoading, setIsLoading] = useState(true);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [formData, setFormData] = useState<AnalysisFormData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisStarted, setAnalysisStarted] = useState(false);
  const [historySaved, setHistorySaved] = useState(false);
  const wasBackgroundedDuringAnalysis = useRef(false);

  const handlePdfCreated = useCallback(async () => {
    if (formData && result && !historySaved) {
      try {
        saveAnalysisHistoryItem(formData, result);
        setHistorySaved(true);
      } catch (err) {
        console.error('Analysis history save failed:', err);
        toast({
          title: 'Geçmişe kaydedilemedi',
          description: 'PDF oluşturuldu ancak analiz geçmişe eklenemedi.',
          variant: 'destructive',
        });
      }
    }
  }, [formData, historySaved, result, toast]);

  const { contentRef, downloadPdf } = usePdfDownload({ onPdfCreated: handlePdfCreated });

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isLoading) {
        wasBackgroundedDuringAnalysis.current = true;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLoading]);

  useEffect(() => {
    if (analysisStarted || profileLoading) return;

    if (!deviceId) {
      setError('Oturum cihaz kimliği hazırlanamadı. Lütfen tekrar giriş yapın.');
      setIsLoading(false);
      return;
    }

    if (!profile || profile.credits < 1) {
      setError('Yetersiz kredi. Devam etmek için kredi satın almanız gerekiyor.');
      setIsLoading(false);
      return;
    }

    if (!analysisData) {
      navigate('/');
      return;
    }

    setAnalysisStarted(true);
    setFormData(analysisData);
    wasBackgroundedDuringAnalysis.current = false;

    const listingImages = analysisData.images.filter(img => img.type === 'sahibinden');
    const landImages = analysisData.images.filter(img => img.type === 'arazi');
    const primaryImage = listingImages[0] || landImages[0];
    const allImagePreviews = analysisData.images.map(img => img.preview);

    const runAnalysis = async () => {
      try {
        const analysisResult = analysisData.images.length === 0 && analysisData.location
          ? await analyzeLand(undefined, analysisData.location, undefined, deviceId)
          : await analyzeLand(primaryImage?.preview, analysisData.location || undefined, allImagePreviews, deviceId);

        setResult(analysisResult);
        await refreshProfile();
      } catch (err) {
        console.error('Analysis error:', err);
        const friendlyMessage = toFriendlyErrorMessage(err instanceof Error ? err.message : undefined);
        if (wasBackgroundedDuringAnalysis.current) {
          setError('Uygulama arka plandayken analiz yarıda kesildi. Lütfen tekrar deneyin.');
          return;
        }
        setError(friendlyMessage);
        toast({
          title: 'Analiz hazırlanamadı',
          description: friendlyMessage,
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (!primaryImage && !analysisData.location) {
      setError('Görsel veya konum bilgisi bulunamadı.');
      setIsLoading(false);
      return;
    }

    runAnalysis();
  }, [analysisStarted, analysisData, deviceId, navigate, profile, profileLoading, refreshProfile, toast]);

  const handleNewAnalysis = () => {
    clearAnalysisData();
    navigate('/');
  };

  if (isLoading) {
    return <AnalysisLoading />;
  }

  if (error) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center px-4">
        <div className="text-center max-w-md animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-destructive/10 mx-auto flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Analiz Başarısız</h2>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => navigate('/')} className="gradient-primary shadow-glow">
            Tekrar Dene
          </Button>
        </div>
      </div>
    );
  }

  if (!result || !formData) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center px-4">
        <div className="text-center max-w-md animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-muted mx-auto flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Veri Bulunamadı</h2>
          <p className="text-sm text-muted-foreground mb-6">Analiz verileri yüklenemedi. Lütfen tekrar deneyin.</p>
          <Button onClick={() => navigate('/')} className="gradient-primary shadow-glow">
            Ana Sayfaya Dön
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] gradient-hero flex flex-col">
      <header className="sticky top-0 z-10 px-4 py-4 sm:px-6 glass-effect border-b border-border">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="gap-2 hover:bg-accent">
            <ArrowLeft className="w-4 h-4" />
            Geri
          </Button>
          <Button onClick={downloadPdf} size="sm" className="gap-2 gradient-primary shadow-glow">
            <Download className="w-4 h-4" />
            PDF İndir
          </Button>
        </div>
      </header>

      <main className="px-4 py-6 sm:px-6 flex-1 overflow-y-auto">
        <AnalysisReportContent
          result={result}
          formData={formData}
          showNewAnalysisButton
          onNewAnalysis={handleNewAnalysis}
          className="max-w-2xl mx-auto space-y-5"
        />
        <div ref={contentRef} className="absolute left-[-10000px] top-0 w-[720px] bg-background">
          <AnalysisReportContent result={result} formData={formData} className="w-[720px] space-y-5 bg-background p-4" />
        </div>
      </main>

      <Footer />
    </div>
  );
}
