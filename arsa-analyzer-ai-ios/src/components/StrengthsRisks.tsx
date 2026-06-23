import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StrengthItem, RiskItem } from '@/types/analysis';

interface StrengthsRisksProps {
  strengths: StrengthItem[];
  risks: RiskItem[];
}

const severityConfig = {
  low: { label: 'Düşük', bg: 'bg-amber-500/20', text: 'text-amber-600' },
  medium: { label: 'Orta', bg: 'bg-orange-500/20', text: 'text-orange-600' },
  high: { label: 'Yüksek', bg: 'bg-red-500/20', text: 'text-red-600' },
};

export function StrengthsRisks({ strengths, risks }: StrengthsRisksProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Strengths */}
      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-full bg-emerald-500/20">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Güçlü Yönler</h3>
        </div>
        <ul className="space-y-3">
          {strengths.map((item, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
              <div>
                <p className="text-sm text-foreground font-medium">{item.point}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.evidence}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Risks */}
      <div className="rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-500/10 to-red-600/5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-full bg-red-500/20">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Riskler</h3>
        </div>
        <ul className="space-y-3">
          {risks.map((item, index) => {
            const severity = severityConfig[item.severity] || severityConfig.medium;
            return (
              <li key={index} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-foreground font-medium">{item.point}</p>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', severity.bg, severity.text)}>
                      {severity.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.evidence}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
