import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Crown, MapPin, Package, ShieldCheck, Sparkles, Star, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/Footer';
import { useDevice } from '@/hooks/useDevice';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface CreditPackage {
  id: 'package_10' | 'package_20' | 'package_50';
  queries: number;
  price: number;
  originalPrice: number;
  discount: number;
  icon: React.ReactNode;
  popular?: boolean;
  color: string;
}

const packages: CreditPackage[] = [
  {
    id: 'package_10',
    queries: 10,
    price: 150,
    originalPrice: 250,
    discount: 40,
    icon: <Zap className="w-6 h-6" />,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'package_20',
    queries: 20,
    price: 250,
    originalPrice: 417,
    discount: 40,
    icon: <Star className="w-6 h-6" />,
    popular: true,
    color: 'from-primary to-emerald-500',
  },
  {
    id: 'package_50',
    queries: 50,
    price: 500,
    originalPrice: 833,
    discount: 40,
    icon: <Crown className="w-6 h-6" />,
    color: 'from-amber-500 to-orange-500',
  },
];

export default function Packages() {
  const navigate = useNavigate();
  const { profile } = useDevice();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth?redirect=/packages', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handlePurchase = async (pkg: CreditPackage) => {
    setSelectedPackageId(pkg.id);
    toast({
      title: 'Google Play ödeme hazırlanıyor',
      description: 'Play Console ürünleri aktifleşince satın alma ekranı buradan açılacak.',
    });
    setSelectedPackageId(null);
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
                  Akıllı Değerlendirme
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
              Ödemeler Google Play üzerinden alınacak. Satın alma token’ı backend tarafında doğrulanmadan kredi eklenmez.
            </p>
          </div>

          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent border border-border mb-4">
              <Package className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Kredi Paketleri</span>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">İhtiyacınıza Uygun Paketi Seçin</h2>
            <p className="text-muted-foreground">
              Kredi satın alma işlemleri güvenli Google Play ödeme ekranıyla tamamlanır.
            </p>
          </div>

          {profile && (
            <div className="p-4 rounded-xl bg-accent/50 border border-border text-center">
              <p className="text-sm text-muted-foreground">Mevcut Krediniz</p>
              <p className="text-2xl font-bold text-primary">{profile.credits}</p>
            </div>
          )}

          <div className="space-y-4">
            {packages.map((pkg, index) => (
              <div
                key={pkg.id}
                className={`relative rounded-2xl border-2 bg-card p-6 shadow-sm animate-fade-in transition-all duration-200 hover:shadow-lg ${pkg.popular ? 'border-primary' : 'border-border'}`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 rounded-full gradient-primary text-xs font-bold text-primary-foreground shadow-glow">
                      EN POPÜLER
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
                      <span className="text-lg font-bold text-primary">{pkg.price} TL</span>
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
                    Satın Al
                  </Button>
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Check className="w-3.5 h-3.5 text-primary" />
                      Detaylı analiz
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Check className="w-3.5 h-3.5 text-primary" />
                      PDF rapor
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Check className="w-3.5 h-3.5 text-primary" />
                      Süresiz kullanım
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
