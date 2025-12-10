import { CheckCircle2, AlertTriangle } from 'lucide-react';

interface StrengthsRisksProps {
  strengths: string[];
  risks: string[];
}

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
        <ul className="space-y-2">
          {strengths.map((item, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
              {item}
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
        <ul className="space-y-2">
          {risks.map((item, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
