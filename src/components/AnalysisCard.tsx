import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnalysisCardProps {
  title: string;
  points: string[];
  score: number;
  variant: 'short' | 'medium' | 'long';
}

const variantConfig = {
  short: {
    label: 'Kısa Vade',
    sublabel: '0-2 Yıl',
    gradient: 'from-blue-500/10 to-blue-600/5',
    border: 'border-blue-500/20',
    icon: 'text-blue-500',
  },
  medium: {
    label: 'Orta Vade',
    sublabel: '2-5 Yıl',
    gradient: 'from-amber-500/10 to-amber-600/5',
    border: 'border-amber-500/20',
    icon: 'text-amber-500',
  },
  long: {
    label: 'Uzun Vade',
    sublabel: '5+ Yıl',
    gradient: 'from-emerald-500/10 to-emerald-600/5',
    border: 'border-emerald-500/20',
    icon: 'text-emerald-500',
  },
};

function ScoreIndicator({ score }: { score: number }) {
  const Icon = score >= 7 ? TrendingUp : score >= 4 ? Minus : TrendingDown;
  const color = score >= 7 ? 'text-emerald-500' : score >= 4 ? 'text-amber-500' : 'text-red-500';
  const bg = score >= 7 ? 'bg-emerald-500/10' : score >= 4 ? 'bg-amber-500/10' : 'bg-red-500/10';

  return (
    <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-full', bg)}>
      <Icon className={cn('w-4 h-4', color)} />
      <span className={cn('text-sm font-bold', color)}>{score}/10</span>
    </div>
  );
}

export function AnalysisCard({ title, points, score, variant }: AnalysisCardProps) {
  const config = variantConfig[variant];

  return (
    <div
      className={cn(
        'rounded-2xl border p-5 bg-gradient-to-br transition-all duration-300 hover:shadow-lg',
        config.gradient,
        config.border
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {config.label}
          </p>
          <p className="text-[10px] text-muted-foreground">{config.sublabel}</p>
          <h3 className="text-lg font-semibold text-foreground mt-1">{title}</h3>
        </div>
        <ScoreIndicator score={score} />
      </div>

      <ul className="space-y-2">
        {points.map((point, index) => (
          <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', config.icon.replace('text-', 'bg-'))} />
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}
