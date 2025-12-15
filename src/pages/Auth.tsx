import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapPin, Sparkles, Phone, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

const phoneSchema = z.string()
  .min(10, 'Telefon numarası en az 10 karakter olmalı')
  .max(15, 'Telefon numarası çok uzun')
  .regex(/^\+?[0-9]+$/, 'Geçerli bir telefon numarası girin');

const otpSchema = z.string()
  .length(6, 'Doğrulama kodu 6 haneli olmalı')
  .regex(/^[0-9]+$/, 'Kod sadece rakamlardan oluşmalı');

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading, signInWithGoogle, signInWithOtp, verifyOtp } = useAuth();
  const { toast } = useToast();
  
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('+90');
  const [otpCode, setOtpCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  
  const returnTo = searchParams.get('returnTo') || '/';

  useEffect(() => {
    if (!loading && user) {
      navigate(returnTo, { replace: true });
    }
  }, [user, loading, navigate, returnTo]);

  const handleSendOtp = async () => {
    const validation = phoneSchema.safeParse(phone);
    if (!validation.success) {
      toast({
        title: 'Hata',
        description: validation.error.errors[0].message,
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);
    const { error } = await signInWithOtp(phone);
    setIsSubmitting(false);
    
    if (error) {
      toast({
        title: 'Hata',
        description: 'SMS gönderilemedi. Lütfen numaranızı kontrol edin.',
        variant: 'destructive'
      });
      return;
    }
    
    toast({
      title: 'SMS Gönderildi',
      description: 'Telefonunuza gelen 6 haneli kodu girin.',
    });
    setStep('otp');
  };

  const handleVerifyOtp = async () => {
    const validation = otpSchema.safeParse(otpCode);
    if (!validation.success) {
      toast({
        title: 'Hata',
        description: validation.error.errors[0].message,
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);
    const { error } = await verifyOtp(phone, otpCode);
    setIsSubmitting(false);
    
    if (error) {
      toast({
        title: 'Hata',
        description: 'Kod geçersiz veya süresi dolmuş. Tekrar deneyin.',
        variant: 'destructive'
      });
      return;
    }
    
    // Success - auth state change will redirect
    toast({
      title: 'Giriş Başarılı',
      description: 'Hoş geldiniz!',
    });
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    const { error } = await signInWithGoogle();
    
    if (error) {
      toast({
        title: 'Google Giriş Hatası',
        description: 'Lütfen telefon ile giriş yapmayı deneyin.',
        variant: 'destructive'
      });
      setIsGoogleLoading(false);
    }
  };

  const handleBack = () => {
    setStep('phone');
    setOtpCode('');
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
          <div className="flex items-center gap-3">
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
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 pb-8 sm:px-6 flex-1 flex items-center justify-center">
        <div className="max-w-sm w-full">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-lg animate-fade-in">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="p-4 rounded-2xl gradient-primary shadow-glow">
                <Phone className="w-8 h-8 text-primary-foreground" />
              </div>
            </div>

            {/* Title */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {step === 'phone' ? 'Giriş Yap' : 'Kodu Girin'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {step === 'phone' 
                  ? 'Telefon numaranıza SMS ile kod göndereceğiz' 
                  : `${phone} numarasına gönderilen 6 haneli kodu girin`
                }
              </p>
            </div>

            {step === 'phone' ? (
              <>
                {/* Phone Input */}
                <div className="space-y-4">
                  <Input
                    type="tel"
                    placeholder="+90 5XX XXX XX XX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-14 text-base rounded-xl border-2 border-border focus:border-primary"
                    disabled={isSubmitting}
                  />
                  
                  <Button
                    onClick={handleSendOtp}
                    disabled={isSubmitting || phone.length < 10}
                    size="lg"
                    className="w-full h-14 text-base font-semibold rounded-xl gradient-primary"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Gönderiliyor...</span>
                      </div>
                    ) : (
                      'SMS Kodu Gönder'
                    )}
                  </Button>
                </div>

                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">veya</span>
                  </div>
                </div>

                {/* Google Sign In (Optional) */}
                <Button
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading}
                  variant="outline"
                  size="lg"
                  className="w-full h-14 text-base font-medium rounded-xl border-2"
                >
                  {isGoogleLoading ? (
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Bağlanıyor...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      <span>Google ile Giriş</span>
                    </div>
                  )}
                </Button>
              </>
            ) : (
              <>
                {/* Back Button */}
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Numarayı Değiştir
                </button>

                {/* OTP Input */}
                <div className="space-y-4">
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="• • • • • •"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="h-14 text-2xl text-center tracking-[0.5em] rounded-xl border-2 border-border focus:border-primary font-mono"
                    disabled={isSubmitting}
                    maxLength={6}
                  />
                  
                  <Button
                    onClick={handleVerifyOtp}
                    disabled={isSubmitting || otpCode.length !== 6}
                    size="lg"
                    className="w-full h-14 text-base font-semibold rounded-xl gradient-primary"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Doğrulanıyor...</span>
                      </div>
                    ) : (
                      'Giriş Yap'
                    )}
                  </Button>

                  <button
                    onClick={handleSendOtp}
                    disabled={isSubmitting}
                    className="w-full text-sm text-primary hover:underline"
                  >
                    Kodu Tekrar Gönder
                  </button>
                </div>
              </>
            )}

            {/* Info */}
            <div className="mt-6 p-4 rounded-xl bg-accent/50 border border-border">
              <div className="flex gap-3">
                <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">
                    İlk sorgunuz ücretsiz!
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Kayıt olduğunuzda hesabınıza otomatik olarak 1 ücretsiz kredi yüklenir.
                  </p>
                </div>
              </div>
            </div>

            {/* Terms */}
            <p className="text-center text-xs text-muted-foreground mt-6">
              Giriş yaparak{' '}
              <span className="text-primary hover:underline cursor-pointer">
                Kullanım Koşulları
              </span>
              'nı kabul etmiş olursunuz.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}