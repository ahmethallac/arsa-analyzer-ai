import { Link, useLocation } from 'react-router-dom';
import { CreditCard, History, Home, Settings, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', label: 'Analiz', icon: Home, match: (path: string, hash: string) => path === '/' && !hash },
  { to: '/profile#history', label: 'Geçmiş', icon: History, match: (path: string, hash: string) => path === '/profile' && hash === '#history' },
  { to: '/packages', label: 'Kredi', icon: CreditCard, match: (path: string) => path === '/packages' },
  { to: '/profile', label: 'Profil', icon: UserCircle, match: (path: string, hash: string) => path === '/profile' && hash !== '#history' },
  { to: '/settings', label: 'Ayarlar', icon: Settings, match: (path: string) => path === '/settings' },
];

export function Footer() {
  const location = useLocation();

  return (
    <>
      <div className="h-[88px] shrink-0" aria-hidden="true" />
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/95 px-2 pb-[calc(0.45rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_30px_hsl(220_20%_10%/0.08)] backdrop-blur-xl">
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.match(location.pathname, location.hash);

            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'group flex h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold text-muted-foreground transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  isActive && 'bg-primary text-primary-foreground shadow-glow hover:bg-primary hover:text-primary-foreground',
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
