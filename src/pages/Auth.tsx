import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { MapPin, Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useDevice } from '@/hooks/useDevice';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

type AuthStep = 'email' | 'sent';
const NATIVE_AUTH_REDIRECT_KEY = 'arsa_analiz_auth_redirect';
const PENDING_ANALYSIS_KEY = 'arsa_analiz_pending_analysis';


export default function Auth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const hasPendingAnalysis = Boolean(localStorage.getItem(PENDING_ANALYSIS_KEY));
  const redirect = params.get('redirect') || localStorage.getItem(NATIVE_AUTH_REDIRECT_KEY) || (hasPendingAnalysis ? '/analysis' : '/profile');
  const allowedRedirects = new Set(['/', '/analysis', '/profile', '/packages']);
  const safeRedirect = allowedRedirects.has(redirect) ? redirect : '/profile';
  const { toast } = useToast();
  const { deviceId, refreshProfile } = useDevice();
  const { user, loading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [step, setStep] = useState<AuthStep>('email');
  const [loading, setLoading] = useState(false);
  const [preparingProfile, setPreparingProfile] = useState(false);

  useEffect(() => {
    if (user && deviceId) {
      (async () => {
        setPreparingProfile(true);
        const { data, error } = await supabase.rpc('link_device_to_user', { p_device_id: deviceId });
        const result = data as { success?: boolean; error?: string } | null;

        if (error || !result?.success) {
          setPreparingProfile(false);
          toast({
            title: 'Profil hazırlanamadı',
            description: result?.error || error?.message || 'Lütfen tekrar deneyin.',
            variant: 'destructive',
          });
          return;
        }

        await refreshProfile();
        setPreparingProfile(false);
        localStorage.removeItem(NATIVE_AUTH_REDIRECT_KEY);
        navigate(safeRedirect, { replace: true });
      })();
    }
  }, [user, deviceId, navigate, safeRedirect, refreshProfile, toast]);

  const handleGoogle = async () => {
    setLoading(true);
    localStorage.setItem(NATIVE_AUTH_REDIRECT_KEY, safeRedirect);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth?redirect=${encodeURIComponent(safeRedirect)}`,
      },
    });

    if (error) {
      toast({ title: 'Hata', description: 'Google ile giriş başarısız.', variant: 'destructive' });
      setLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();
    if (!normalizedEmail || !trimmedPassword) return;

    setLoading(true);
    localStorage.setItem(NATIVE_AUTH_REDIRECT_KEY, safeRedirect);

    // Try sign-in first; if user doesn't exist, sign them up (auto-confirmed).
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: trimmedPassword,
    });

    if (!signInError) {
      setLoading(false);
      return;
    }

    // If credentials wrong on existing account, surface a proper error.
    const errorMsg = (signInError.message || '').toLowerCase();
    const looksLikeMissingUser = errorMsg.includes('invalid login credentials') || errorMsg.includes('user not found');

    if (!looksLikeMissingUser) {
      setLoading(false);
      toast({
        title: 'Giriş yapılamadı',
        description: signInError.message,
        variant: 'destructive',
      });
      return;
    }

    // New user → sign up
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: trimmedPassword,
      options: {
        emailRedirectTo: `${window.location.origin}/auth?redirect=${encodeURIComponent(safeRedirect)}`,
      },
    });

    if (signUpError) {
      // If user existed but password was wrong, treat as auth failure.
      if ((signUpError.message || '').toLowerCase().includes('registered')) {
        setLoading(false);
        toast({
          title: 'Şifre hatalı',
          description: 'Bu e-posta ile daha önce kayıt yapılmış. Doğru şifreyi girin.',
          variant: 'destructive',
        });
        return;
      }
      setLoading(false);
      toast({ title: 'Kayıt yapılamadı', description: signUpError.message, variant: 'destructive' });
      return;
    }

    // Auto-confirm is enabled → session should be present immediately.
    if (!signUpData.session) {
      // Fallback: sign in explicitly.
      await supabase.auth.signInWithPassword({ email: normalizedEmail, password: trimmedPassword });
    }
    setLoading(false);
  };


  const isCompletingAuth = authLoading || preparingProfile || Boolean(user && !deviceId);

  return (
    <div className="min-h-[100dvh] gradient-hero flex flex-col">
      <header className="px-4 py-6 sm:px-6">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl gradient-primary shadow-glow">
              <MapPin className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Arsa Analiz</h1>
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 flex items-start justify-center">
        <div className="w-full max-w-md">
          {isCompletingAuth ? (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm text-center">
              <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">Giris tamamlaniyor</p>
              <p className="mt-2 text-sm text-muted-foreground">Profiliniz hazirlaniyor, lutfen bekleyin.</p>
            </div>
          ) : (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-foreground mb-2">Hesapla Devam Et</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Google hesabınızla veya e-posta bağlantısıyla devam edin.
            </p>

            <Button
              onClick={handleGoogle}
              disabled={loading}
              variant="outline"
              className="w-full h-12 mb-4"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google üzerinden giriş yap
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">veya</span>
              </div>
            </div>

            {step === 'email' ? (
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">E-posta adresi</label>
                <Input
                  type="email"
                  placeholder="ornek@email.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-12"
                  disabled={loading}
                />
                <Button
                  onClick={handleSendLink}
                  disabled={loading || !email.trim()}
                  className="w-full h-12 gradient-primary"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      E-posta bağlantısı gönder
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
                  <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-primary" />
                  <p className="text-sm font-medium text-foreground">E-posta gönderildi</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    <strong className="text-foreground">{email}</strong> adresindeki bağlantıya tıklayın.
                    Bağlantı sizi otomatik olarak uygulamaya geri alacak.
                  </p>
                </div>
                <Button
                  onClick={() => setStep('email')}
                  variant="ghost"
                  className="w-full"
                  disabled={loading}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  E-posta değiştir
                </Button>
              </div>
            )}
          </div>
          )}

          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            className="w-full mt-4"
          >
            Ana sayfaya dön
          </Button>
        </div>
      </main>
    </div>
  );
}
