import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MapPin, Sparkles, User, CreditCard, LogOut, History, ChevronRight, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface CreditTransaction {
  id: string;
  amount: number;
  type: 'signup_bonus' | 'purchase' | 'usage';
  description: string | null;
  created_at: string;
}

export default function Profile() {
  const navigate = useNavigate();
  const { user, profile, loading, signOut, refreshProfile } = useAuth();

  // Fetch transactions
  const { data: transactions } = useQuery({
    queryKey: ['credit-transactions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data as CreditTransaction[];
    },
    enabled: !!user
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      refreshProfile();
    }
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
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
    <div className="min-h-screen gradient-hero flex flex-col">
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
      <main className="px-4 pb-8 sm:px-6 flex-1">
        <div className="max-w-xl mx-auto space-y-5">
          {/* Profile Card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm animate-fade-in">
            <div className="flex items-center gap-4 mb-6">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name || 'Profil'}
                  className="w-16 h-16 rounded-full border-2 border-primary"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center">
                  <User className="w-8 h-8 text-primary" />
                </div>
              )}
              <div className="flex-1">
                <h2 className="text-xl font-bold text-foreground">
                  {profile?.display_name || 'Kullanıcı'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {profile?.email || user?.email}
                </p>
              </div>
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

          {/* Sign Out Button */}
          <Button
            onClick={handleSignOut}
            variant="outline"
            size="lg"
            className="w-full h-12 text-base font-medium rounded-xl border-destructive/50 text-destructive hover:bg-destructive/10 transition-all duration-200"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Çıkış Yap
          </Button>

          {/* Back to Home */}
          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            className="w-full"
          >
            Ana Sayfaya Dön
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  );
}
