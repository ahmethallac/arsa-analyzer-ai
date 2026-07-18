import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronRight,
  CreditCard,
  Download,
  Eye,
  Gift,
  History,
  Loader2,
  LogOut,
  MapPin,
  Package,
  Sparkles,
  Trash2,
  UserCircle,
  X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Footer } from '@/components/Footer';
import { AnalysisReportContent } from '@/components/AnalysisReportContent';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Footer } from '@/components/Footer';
import { AnalysisReportContent } from '@/components/AnalysisReportContent';
import { usePdfDownload } from '@/hooks/usePdfDownload';
import { useDevice } from '@/hooks/useDevice';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  AnalysisHistoryItem,
  getAnalysisHistory,
  parseHistoryResult,
  removeAnalysisHistoryItem,
} from '@/lib/analysisHistory';

interface CreditTransaction {
  id: string;
  amount: number;
  type: 'signup_bonus' | 'purchase' | 'usage';
  description: string | null;
  created_at: string;
}

export default function Profile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, loading, refreshProfile, deviceId } = useDevice();
  const { user, signOut, loading: authLoading } = useAuth();
  const [promoCode, setPromoCode] = useState('');
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisHistoryItem[]>(() => getAnalysisHistory());
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<AnalysisHistoryItem | null>(null);
  const { contentRef, downloadPdf } = usePdfDownload();

  const { data: transactions, refetch: refetchTransactions } = useQuery({
    queryKey: ['credit-transactions', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data, error } = await supabase
        .from('credit_transactions')
        .select('id,amount,type,description,created_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as CreditTransaction[];
    },
    enabled: !!profile,
  });

  useEffect(() => {
    const refreshHistory = () => setAnalysisHistory(getAnalysisHistory());
    window.addEventListener('analysis-history-updated', refreshHistory);
    window.addEventListener('storage', refreshHistory);
    return () => {
      window.removeEventListener('analysis-history-updated', refreshHistory);
      window.removeEventListener('storage', refreshHistory);
    };
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth?redirect=/profile', { replace: true });
    }
  }, [authLoading, user, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth?redirect=/profile', { replace: true });
  };

  const handleApplyPromoCode = async () => {
    if (!user) {
      navigate('/auth?redirect=/profile');
      return;
    }
    if (!promoCode.trim() || !deviceId) return;

    setApplyingPromo(true);
    try {
      const { data, error } = await supabase.rpc('apply_promo_code', {
        p_device_id: deviceId,
        p_code: promoCode.trim(),
      });

      if (error) throw error;
      const result = data as { success: boolean; error?: string; credits?: number };

      if (result?.success) {
        const creditedAmount = Number(result.credits || 0);
        toast({
          title: 'Promosyon kodu uygulandı',
          description: creditedAmount > 0 ? `${creditedAmount} kredi hesabınıza eklendi.` : 'Kredi bakiyeniz güncellendi.',
        });
        setPromoCode('');
        await refreshProfile();
        refetchTransactions();
      } else {
        toast({
          title: 'Promosyon kodu uygulanamadı',
          description: result.error || 'Kodu kontrol edip tekrar deneyin.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'İşlem tamamlanamadı',
        description: 'Bağlantınızı kontrol edip tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setApplyingPromo(false);
    }
  };

  const handleDownloadHistoryPdf = (item: AnalysisHistoryItem) => {
    setSelectedHistoryItem(item);
    window.setTimeout(() => downloadPdf(), 80);
  };

  const handleRemoveHistoryItem = (id: string) => {
    removeAnalysisHistoryItem(id);
    setAnalysisHistory(getAnalysisHistory());
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'signup_bonus':
        return <Sparkles className="w-4 h-4 text-primary" />;
      case 'purchase':
        return <CreditCard className="w-4 h-4 text-primary" />;
      case 'usage':
        return <History className="w-4 h-4 text-muted-foreground" />;
      default:
        return <History className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const getHistoryTitle = (item: AnalysisHistoryItem) => {
    if (item.location?.city && item.location?.district) {
      return `${item.location.city}, ${item.location.district}`;
    }
    return item.result.extractedInfo?.location || 'Arazi analizi';
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center">
        <div className="animate-pulse-soft">
          <MapPin className="w-12 h-12 text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] gradient-hero flex flex-col">
      <header className="px-4 py-6 sm:px-6">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl gradient-primary shadow-glow">
                <MapPin className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground tracking-tight">Arsa Analiz</h1>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Akıllı Değerlendirme
                </p>
              </div>
            </Link>
          </div>
        </div>
      </header>

      <main className="px-4 pb-8 sm:px-6 flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto space-y-5">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 animate-fade-in">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                Hesap Güvenliği
              </p>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">
                Kredileriniz hesabınızla eşleştirilir. Uygulamayı silmeden önce hesabınızda oturum açık olduğundan emin olun.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm animate-fade-in">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center overflow-hidden">
                {user?.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="Profil" className="w-full h-full object-cover" />
                ) : (
                  <UserCircle className="w-8 h-8 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                {user ? (
                  <>
                    <h2 className="text-base font-bold text-foreground truncate">
                      {user.user_metadata?.full_name || user.email}
                    </h2>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </>
                ) : (
                  <>
                    <h2 className="text-base font-bold text-foreground">Hesap bulunamadı</h2>
                    <p className="text-xs text-muted-foreground">Ana sayfaya yönlendiriliyorsunuz</p>
                  </>
                )}
              </div>
              {user && (
                <Button variant="ghost" size="sm" onClick={handleSignOut} title="Çıkış yap">
                  <LogOut className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="p-5 rounded-xl gradient-primary shadow-glow mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-primary-foreground/80">Kalan Kredi</p>
                  <p className="text-4xl font-bold text-primary-foreground">
                    {profile?.credits ?? 0}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-primary-foreground/20">
                  <CreditCard className="w-8 h-8 text-primary-foreground" />
                </div>
              </div>
            </div>

            <Button
              onClick={() => navigate('/packages')}
              size="lg"
              className="w-full h-14 text-base font-semibold rounded-xl bg-card border-2 border-primary text-primary hover:bg-accent transition-all duration-200"
            >
              <Package className="w-5 h-5 mr-2" />
              Abonelik & Paketler
              <ChevronRight className="w-5 h-5 ml-auto" />
            </Button>

          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Gift className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Promosyon Kodu</h3>
                <p className="text-xs text-muted-foreground">Varsa promosyon kodunuzu girin</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Kodu girin"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                className="flex-1 h-12 text-base font-mono uppercase"
                disabled={applyingPromo}
              />
              <Button
                onClick={handleApplyPromoCode}
                disabled={!promoCode.trim() || applyingPromo}
                className="h-12 px-6 gradient-primary"
              >
                {applyingPromo ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Uygula'}
              </Button>
            </div>
          </div>

          <div id="history" className="scroll-mt-4 rounded-2xl border border-border bg-card p-6 shadow-sm animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-accent">
                <FileHistoryIcon />
              </div>
              <h3 className="text-lg font-bold text-foreground">Analiz Geçmişi</h3>
            </div>

            {analysisHistory.length > 0 ? (
              <div className="space-y-3">
                {analysisHistory.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-accent/30 border border-border">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{getHistoryTitle(item)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
                    </div>
                    <Button variant="outline" size="icon" onClick={() => handleDownloadHistoryPdf(item)} title="PDF indir">
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveHistoryItem(item.id)} title="Sil">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-4">
                Henüz kaydedilmiş analiz yok. PDF oluşturduğunuz raporlar burada görünür.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-accent">
                <History className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground">İşlem Geçmişi</h3>
            </div>

            {transactions && transactions.length > 0 ? (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl bg-accent/30 border border-border">
                    <div className="p-2 rounded-lg bg-card">{getTransactionIcon(tx.type)}</div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{tx.description || tx.type}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(tx.created_at)}</p>
                    </div>
                    <span className={`text-sm font-bold ${tx.amount > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-4">Henüz işlem geçmişi yok</p>
            )}
          </div>

          <Button onClick={() => navigate('/')} variant="ghost" className="w-full">
            Ana Sayfaya Dön
          </Button>
        </div>

        {selectedHistoryItem && (
          <div ref={contentRef} className="absolute left-[-10000px] top-0 w-[720px] bg-background">
            <AnalysisReportContent
              result={parseHistoryResult(selectedHistoryItem)}
              location={selectedHistoryItem.location}
              className="w-[720px] space-y-5 bg-background p-4"
            />
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

function FileHistoryIcon() {
  return <History className="w-5 h-5 text-primary" />;
}
