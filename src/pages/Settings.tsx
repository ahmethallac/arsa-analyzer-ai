import { Link, useNavigate } from 'react-router-dom';
import { Monitor, Moon, ShieldCheck, Sparkles, Sun, UserCircle } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/hooks/useAuth';
import { useDevice } from '@/hooks/useDevice';

export default function Settings() {
  const navigate = useNavigate();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user } = useAuth();
  const { profile } = useDevice();
  const isDark = resolvedTheme === 'dark';

  const toggleDarkMode = (checked: boolean) => {
    setTheme(checked ? 'dark' : 'light');
  };

  return (
    <div className="min-h-[100dvh] gradient-hero flex flex-col">
      <header className="px-4 py-6 sm:px-6">
        <div className="max-w-xl mx-auto">
          <Link to="/" className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl gradient-primary shadow-glow">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Ayarlar</h1>
              <p className="text-xs text-muted-foreground">Görünüm ve hesap tercihleri</p>
            </div>
          </Link>
        </div>
      </header>

      <main className="px-4 pb-8 sm:px-6 flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto space-y-5">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent">
                  {isDark ? <Moon className="w-5 h-5 text-primary" /> : <Sun className="w-5 h-5 text-primary" />}
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Koyu Mod</h2>
                  <p className="text-xs text-muted-foreground">Gece kullanımı için daha yumuşak görünüm</p>
                </div>
              </div>
              <Switch checked={isDark} onCheckedChange={toggleDarkMode} aria-label="Koyu modu aç veya kapat" />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { id: 'light', label: 'Açık', icon: Sun },
                { id: 'dark', label: 'Koyu', icon: Moon },
                { id: 'system', label: 'Sistem', icon: Monitor },
              ].map((option) => {
                const Icon = option.icon;
                const active = theme === option.id;

                return (
                  <Button
                    key={option.id}
                    type="button"
                    variant={active ? 'default' : 'outline'}
                    className={active ? 'gradient-primary' : ''}
                    onClick={() => setTheme(option.id)}
                  >
                    <Icon className="w-4 h-4 mr-1.5" />
                    {option.label}
                  </Button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-accent">
                <UserCircle className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Hesap</h2>
                <p className="text-xs text-muted-foreground">
                  {user ? user.email : 'Hesap bilgilerinize giriş yaparak ulaşın'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => navigate(user ? '/profile' : '/auth?redirect=/profile')}>
                Profil
              </Button>
              <Button variant="outline" onClick={() => navigate('/profile#history')}>
                İşlem Geçmişi
              </Button>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-bold text-foreground">Kredi Güvenliği</h2>
                <p className="text-xs text-muted-foreground">
                  Kalan kredi: <span className="font-semibold text-foreground">{profile?.credits ?? 0}</span>
                </p>
              </div>
              <Button size="sm" className="gradient-primary" onClick={() => navigate('/packages')}>
                Kredi Al
              </Button>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
