import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MapPin, Sparkles, Smartphone, CreditCard, History, ChevronRight, Package, AlertTriangle, Gift, Loader2, LogIn, LogOut, UserCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Footer } from '@/components/Footer';
import { useDevice } from '@/hooks/useDevice';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

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
  const queryClient = useQueryClient();
  const { profile, loading, refreshProfile, deviceId } = useDevice();
  const { user, signOut } = useAuth();
  const [promoCode, setPromoCode] = useState('');
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch transactions by profile id
  const { data: transactions, refetch: refetchTransactions } = useQuery({
    queryKey: ['credit-transactions', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data, error } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data as CreditTransaction[];
    },
    enabled: !!profile
  });

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
        p_code: promoCode.trim()
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; credits?: number };

      if (result.success) {
        toast({
          title: 'Promosyon kodu uygulandı!',
          description: `${result.credits} kredi hesabınıza eklendi.`,
        });
        setPromoCode('');
        refreshProfile();
        refetchTransactions();
      } else {
        toast({
          title: 'Hata',
          description: result.error || 'Promosyon kodu uygulanamadı.',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({
        title: 'Hata',
        description: 'Bir hata oluştu. Lütfen tekrar deneyin.',
        variant: 'destructive'
      });
    } finally {
      setApplyingPromo(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const { data, error } = await supabase.rpc('delete_my_account');
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) throw new Error(result.error);
      await signOut();
      toast({ title: 'Hesap silindi', description: 'Hesabınız ve verileriniz kaldırıldı.' });
      // Clear device id so a fresh start
      localStorage.removeItem('arsa_analiz_device_id');
      navigate('/', { replace: true });
      window.location.reload();
    } catch (e: any) {
      toast({ title: 'Hata', description: e.message || 'Hesap silinemedi.', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (profile) {
      refreshProfile();
    }
  }, []);

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
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
      {/* Header */}
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

      {/* Main Content */}
      <main className="px-4 pb-8 sm:px-6 flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto space-y-5">
          {/* Device Warning */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 animate-fade-in">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                Cihaza Bağlı Profil
              </p>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">
                Kredileriniz bu cihaza bağlıdır. Uygulamayı silmeniz veya cihaz değiştirmeniz durumunda kredileriniz kaybolur ve geri getirilemez.
              </p>
            </div>
          </div>

          {/* Account / Sign In Card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm animate-fade-in">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center overflow-hidden">
                {user?.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                ) : user ? (
                  <UserCircle className="w-8 h-8 text-primary" />
                ) : (
                  <Smartphone className="w-7 h-7 text-primary" />
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
                    <h2 className="text-base font-bold text-foreground">Misafir kullanıcı</h2>
                    <p className="text-xs text-muted-foreground">Kredi almak için giriş yapın</p>
                  </>
                )}
              </div>
              {user ? (
                <Button variant="ghost" size="sm" onClick={signOut} title="Çıkış yap">
                  <LogOut className="w-4 h-4" />
                </Button>
              ) : (
                <Button size="sm" className="gradient-primary" onClick={() => navigate('/auth?redirect=/profile')}>
                  <LogIn className="w-4 h-4 mr-1" /> Giriş
                </Button>
              )}
            </div>

            {/* Credits Display */}
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

            {/* Buy Credits Button */}
            <Button
              onClick={() => navigate('/packages')}
              size="lg"
              className="w-full h-14 text-base font-semibold rounded-xl bg-card border-2 border-primary text-primary hover:bg-accent transition-all duration-200"
            >
              <Package className="w-5 h-5 mr-2" />
              Kredi Satın Al
              <ChevronRight className="w-5 h-5 ml-auto" />
            </Button>
          </div>

          {/* Promo Code Card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm animate-fade-in" style={{ animationDelay: '0.05s' }}>
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
                {applyingPromo ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Uygula'
                )}
              </Button>
            </div>
          </div>

          {/* Transaction History */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-accent">
                <History className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground">İşlem Geçmişi</h3>
            </div>

            {transactions && transactions.length > 0 ? (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-accent/30 border border-border"
                  >
                    <div className="p-2 rounded-lg bg-card">
                      {getTransactionIcon(tx.type)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {tx.description || tx.type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(tx.created_at)}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-bold ${
                        tx.amount > 0 ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-4">
                Henüz işlem geçmişi yok
              </p>
            )}
          </div>

          {/* Back to Home */}
          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            className="w-full"
          >
            Ana Sayfaya Dön
          </Button>

          {/* Delete Account - only if logged in */}
          {user && (
            <div className="pt-4 text-center">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="text-xs text-destructive hover:underline inline-flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Hesabımı sil
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Hesabını silmek istediğine emin misin?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Hesabın, kredilerin ve işlem geçmişin kalıcı olarak silinecek. Bu işlem geri alınamaz.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleting}>Vazgeç</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      disabled={deleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Evet, sil'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}