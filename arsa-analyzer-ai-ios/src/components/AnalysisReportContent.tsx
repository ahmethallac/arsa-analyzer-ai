import { AlertTriangle, CheckCircle, FileText, MapPin, MessageCircle, TrendingUp, XCircle } from 'lucide-react';
import { AnalysisCard } from '@/components/AnalysisCard';
import { StrengthsRisks } from '@/components/StrengthsRisks';
import type { AnalysisFormData, AnalysisResult, LocationData } from '@/types/analysis';

interface AnalysisReportContentProps {
  result: AnalysisResult;
  formData?: AnalysisFormData | null;
  location?: LocationData | null;
  showNewAnalysisButton?: boolean;
  onNewAnalysis?: () => void;
  className?: string;
}

export function AnalysisReportContent({
  result,
  formData,
  location,
  showNewAnalysisButton = false,
  onNewAnalysis,
  className = 'max-w-2xl mx-auto space-y-5',
}: AnalysisReportContentProps) {
  const reportLocation = formData?.location || location || null;
  const hasLocationData = reportLocation?.city && reportLocation?.district;

  return (
    <div className={className}>
      {hasLocationData && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-accent">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">
                {reportLocation?.city}, {reportLocation?.district}
              </h2>
              {(reportLocation?.neighborhood || reportLocation?.block || reportLocation?.parcel) && (
                <p className="text-sm text-muted-foreground">
                  {reportLocation?.neighborhood && `${reportLocation.neighborhood}, `}
                  {reportLocation?.block && `Ada: ${reportLocation.block}`}
                  {reportLocation?.parcel && `, Parsel: ${reportLocation.parcel}`}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {result.generalAssessment && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <div className={`p-2 rounded-lg ${result.generalAssessment.verdict === 'FIRSAT' ? 'bg-success/10' : result.generalAssessment.verdict === 'RİSKLİ' ? 'bg-destructive/10' : 'bg-warning/10'}`}>
              {result.generalAssessment.verdict === 'FIRSAT' ? (
                <TrendingUp className="w-5 h-5 text-success" />
              ) : result.generalAssessment.verdict === 'RİSKLİ' ? (
                <AlertTriangle className="w-5 h-5 text-destructive" />
              ) : (
                <FileText className="w-5 h-5 text-warning" />
              )}
            </div>
            <span className={`text-sm font-bold ${result.generalAssessment.verdict === 'FIRSAT' ? 'text-success' : result.generalAssessment.verdict === 'RİSKLİ' ? 'text-destructive' : 'text-warning'}`}>
              {result.generalAssessment.verdict}
            </span>
          </div>
          <p className="text-sm text-foreground leading-relaxed font-medium">
            {result.generalAssessment.summary}
          </p>
        </div>
      )}

      <div className="space-y-4">
        <AnalysisCard title={result.shortTerm.title} points={result.shortTerm.points} score={result.shortTerm.score} variant="short" />
        <AnalysisCard title={result.mediumTerm.title} points={result.mediumTerm.points} score={result.mediumTerm.score} variant="medium" />
        <AnalysisCard title={result.longTerm.title} points={result.longTerm.points} score={result.longTerm.score} variant="long" />
      </div>

      <StrengthsRisks strengths={result.strengths} risks={result.risks} />

      {result.personalRecommendation && (
        <div className="rounded-2xl border-2 border-primary bg-card p-5 shadow-lg animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <MessageCircle className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-bold text-foreground">Ben Olsaydım...</h3>
          </div>
          <div className="flex items-center gap-2 mb-3">
            {result.personalRecommendation.decision.includes('ALIRIM') || result.personalRecommendation.decision.includes('KESİNLİKLE') ? (
              <CheckCircle className="w-6 h-6 text-success" />
            ) : result.personalRecommendation.decision.includes('ALMAM') || result.personalRecommendation.decision.includes('ASLA') ? (
              <XCircle className="w-6 h-6 text-destructive" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-warning" />
            )}
            <span className={`text-lg font-bold ${result.personalRecommendation.decision.includes('ALIRIM') || result.personalRecommendation.decision.includes('KESİNLİKLE') ? 'text-success' : result.personalRecommendation.decision.includes('ALMAM') || result.personalRecommendation.decision.includes('ASLA') ? 'text-destructive' : 'text-warning'}`}>
              {result.personalRecommendation.decision}
            </span>
          </div>
          <p className="text-sm text-foreground leading-relaxed mb-3">
            {result.personalRecommendation.statement}
          </p>
          {result.personalRecommendation.conditions && (
            <p className="text-xs text-muted-foreground italic border-t border-border pt-3">
              {result.personalRecommendation.conditions}
            </p>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm animate-fade-in">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-lg bg-accent">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground">Özet Değerlendirme</h3>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {result.summary}
        </p>
        <p className="text-xs text-muted-foreground mt-4">
          Oluşturulma: {result.generatedAt.toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>

      <div className="text-center py-6 border-t border-border mt-6">
        <p className="text-xs text-muted-foreground">
          Arsa Analizi uygulaması tarafından oluşturulmuştur.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Bu rapor yatırım tavsiyesi niteliği taşımamaktadır.
        </p>
        <p className="text-xs text-muted-foreground mt-3 font-sans font-bold">
          Geliştirici: Ahmet Emin HALLAÇ
        </p>
      </div>

      {showNewAnalysisButton && onNewAnalysis && (
        <div className="py-6">
          <button
            onClick={onNewAnalysis}
            className="w-full h-11 rounded-md px-8 gradient-primary shadow-glow text-primary-foreground font-medium"
          >
            Başka Bir Arazi Analiz Et
          </button>
        </div>
      )}
    </div>
  );
}
