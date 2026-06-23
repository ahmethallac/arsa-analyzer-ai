import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { NativePurchases, PURCHASE_TYPE, type Product } from '@capgo/native-purchases';
import { ArrowLeft, Check, Crown, MapPin, Package, ShieldCheck, Sparkles, Star, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/Footer';
import { useDevice } from '@/hooks/useDevice';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { verifyAppStorePurchase, verifyGooglePlayPurchase } from '@/lib/payments';
import { supabase } from '@/integrations/supabase/client';

interface CreditPackage {
  id: 'package_10' | 'package_20' | 'package_50';
  queries: number;
  fallbackPrice: number;
  originalPrice: number;
  discount: number;
  icon: ReactNode;
  popular?: boolean;
  color: string;
}

const packages: CreditPackage[] = [
  {
    id: 'package_10',
    queries: 10,
    fallbackPrice: 150,
    originalPrice: 250,
    discount: 40,
    icon: <Zap className="w-6 h-6" />,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'package_20',
    queries: 20,
    fallbackPrice: 250,
    originalPrice: 417,
    discount: 40,
    icon: <Star className="w-6 h-6" />,
    popular: true,
    color: 'from-primary to-emerald-500',
  },
  {
    id: 'package_50',
    queries: 50,
    fallbackPrice: 500,
    originalPrice: 833,
    discount: 40,
    icon: <Crown className="w-6 h-6" />,
    color: 'from-amber-500 to-orange-500',
  },
];

export default function Packages() {
  const navigate = useNavigate();
  const { deviceId, profile, refreshProfile } = useDevice();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const nativePlatform = Capacitor.getPlatform();
  const storeName = nativePlatform === 'ios' ? 'App Store' : 'Google Play';
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [storeProducts, setStoreProducts] = useState<Product[]>([]);
  const [billingReady, setBillingReady] = useState(!Capacitor.isNativePlatform());

  const productsById = useMemo(() => {
    return new Map(storeProducts.map((product) => [product.identifier, product]));
  }, [storeProducts]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth?redirect=/packages', { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let mounted = true;

    const loadProducts = async () => {
      try {
        const support = await NativePurchases.isBillingSupported();
        if (!support.isBillingSupported) {
          throw new Error('billing_not_supported');
        }

        const { products } = await NativePurchases.getProducts({
          productIdentifiers: packages.map((pkg) => pkg.id),
          productType: PURCHASE_TYPE.INAPP,
        });

        if (mounted) {
          setStoreProducts(products);
          setBillingReady(true);
        }
      } catch (error) {
        console.error(`${storeName} products could not be loaded:`, error);
        if (mounted) {
          setBillingReady(false);
        }
      }
    };

    loadProducts();

    return () => {
      mounted = false;
    };
  }, [storeName]);

  const getVerifiedPurchaseSession = async () => {
    const { data, error } = await supabase.auth.getSession();
    const activeSession = data.session;

    if (error || !activeSession?.access_token || !activeSession.user) {
      toast({
        title: 'Giris gerekli',
        description: 'Kredi satin almak icin once hesabiniza giris yapmalisiniz.',
        variant: 'destructive',
      });
      navigate('/auth?redirect=/packages');
      return null;
    }

    return activeSession;
  };

  const handlePurchase = async (pkg: CreditPackage) => {
    if (selectedPackageId) return;

    if (authLoading) {
      toast({
        title: 'Oturum kontrol ediliyor',
        description: 'Lutfen birkac saniye sonra tekrar deneyin.',
      });
      return;
    }

    const activeSession = await getVerifiedPurchaseSession();
    if (!activeSession) {
      return;
    }

    if (!deviceId) {
      toast({
        title: 'Oturum hazirlanamadi',
        description: 'Lutfen uygulamayi kapatip tekrar acin.',
        variant: 'destructive',
      });
      return;
    }

    if (!Capacitor.isNativePlatform()) {
      toast({
        title: 'Mobil uygulamada kullanilabilir',
        description: 'Satin alma islemi mobil uygulamadaki resmi magazanin odeme ekraniyla yapilir.',
      });
      return;
    }

    if (!billingReady) {
      toast({
        title: 'Odeme urunleri hazir degil',
        description: `Once bu build yuklenmeli ve ${storeName} urunleri aktif edilmelidir.`,
        variant: 'destructive',
      });
      return;
    }

    setSelectedPackageId(pkg.id);
    try {
      const transaction = await NativePurchases.purchaseProduct({
        productIdentifier: pkg.id,
        productType: PURCHASE_TYPE.INAPP,
        autoAcknowledgePurchases: false,
        isConsumable: false,
        appAccountToken: activeSession.user.id,
      });

      let result;
      if (nativePlatform === 'ios') {
        if (!transaction.transactionId || !transaction.receipt) {
          throw new Error('Satin alma dogrulama bilgisi alinamadi.');
        }

        result = await verifyAppStorePurchase({
          productId: pkg.id,
          transactionId: transaction.transactionId,
          receipt: transaction.receipt,
          deviceId,
        });

        await NativePurchases.acknowledgePurchase({ purchaseToken: transaction.transactionId });
      } else {
        if (!transaction.purchaseToken) {
          throw new Error('Satin alma dogrulama bilgisi alinamadi.');
        }

        if (transaction.purchaseState && transaction.purchaseState !== '1') {
          throw new Error('Satin alma henuz tamamlanmadi.');
        }

        result = await verifyGooglePlayPurchase({
          productId: pkg.id,
          purchaseToken: transaction.purchaseToken,
          deviceId,
        });
      }

      await refreshProfile();
      toast({
        title: 'Kredi eklendi',
        description: `${result.credits || pkg.queries} kredi hesabiniza tanimlandi.`,
      });
    } catch (error) {
      console.error('Purchase failed:', error);
      toast({
        title: 'Satin alma tamamlanamadi',
        description: error instanceof Error ? error.message : 'Lutfen biraz sonra tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setSelectedPackageId(null);
    }
  };

  if (authLoading || !user) {
    return <div className="min-h-[100dvh] gradient-hero" />;
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
                  Akilli Degerlendirme
                </p>
              </div>
            </Link>
            <Button variant="outline" size="sm" onClick={() => navigate('/profile')} className="rounded-xl">
              Profilim
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 pb-8 sm:px-6 flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto space-y-6">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-2">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Geri
          </Button>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/10 border border-primary/20">
            <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Odemeler {storeName} uzerinden alinir. Satin alma magaza tarafindan dogrulanmadan kredi eklenmez.
            </p>
          </div>

          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent border border-border mb-4">
              <Package className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Kredi Paketleri</span>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Ihtiyaciniza Uygun Paketi Secin</h2>
            <p className="text-muted-foreground">
              Kredi satin alma islemleri guvenli {storeName} odeme ekraniyla tamamlanir.
            </p>
          </div>

          {profile && (
            <div className="p-4 rounded-xl bg-accent/50 border border-border text-center">
              <p className="text-sm text-muted-foreground">Mevcut Krediniz</p>
              <p className="text-2xl font-bold text-primary">{profile.credits}</p>
            </div>
          )}

          <div className="space-y-4">
            {packages.map((pkg, index) => {
              const product = productsById.get(pkg.id);
              return (
                <div
                  key={pkg.id}
                  className={`relative rounded-2xl border-2 bg-card p-6 shadow-sm animate-fade-in transition-all duration-200 hover:shadow-lg ${pkg.popular ? 'border-primary' : 'border-border'}`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {pkg.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-4 py-1 rounded-full gradient-primary text-xs font-bold text-primary-foreground shadow-glow">
                        EN POPULER
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${pkg.color} text-white`}>
                      {pkg.icon}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-foreground">{pkg.queries}</span>
                        <span className="text-sm text-muted-foreground">Kredi</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-lg font-bold text-primary">{product?.priceString || `${pkg.fallbackPrice} TL`}</span>
                        <span className="text-sm text-muted-foreground line-through">{pkg.originalPrice} TL</span>
                        <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs font-bold">
                          %{pkg.discount}
                        </span>
                      </div>
                    </div>

                    <Button
                      onClick={() => handlePurchase(pkg)}
                      size="sm"
                      disabled={selectedPackageId === pkg.id}
                      className={`rounded-xl ${pkg.popular ? 'gradient-primary shadow-glow' : ''}`}
                      variant={pkg.popular ? 'default' : 'outline'}
                    >
                      Satin Al
                    </Button>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex flex-wrap gap-3">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Check className="w-3.5 h-3.5 text-primary" />
                        Detayli analiz
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Check className="w-3.5 h-3.5 text-primary" />
                        PDF rapor
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Check className="w-3.5 h-3.5 text-primary" />
                        Suresiz kullanim
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
