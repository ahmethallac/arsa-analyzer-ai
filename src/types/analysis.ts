export interface LocationData {
  city: string;
  district: string;
  neighborhood: string;
  block: string; // Ada
  parcel: string; // Parsel
}

export interface UploadedImage {
  file: File;
  preview: string;
  type: 'sahibinden' | 'arazi';
}

export interface AnalysisPoint {
  point: string;
  evidence: string;
}

export interface StrengthItem {
  point: string;
  evidence: string;
}

export interface RiskItem {
  point: string;
  evidence: string;
  severity: 'low' | 'medium' | 'high';
}

export interface GeneralAssessment {
  verdict: string;
  summary: string;
}

export interface PersonalRecommendation {
  decision: string;
  statement: string;
  conditions?: string;
}

export interface TermAnalysis {
  title: string;
  points: AnalysisPoint[];
  score: number;
}

export interface AnalysisResult {
  extractedInfo: {
    price: string;
    sqm: string;
    pricePerSqm: string;
    location: string;
    parcelInfo?: string;
    currentZoning?: string;
  };
  generalAssessment: GeneralAssessment;
  shortTerm: TermAnalysis;
  mediumTerm: TermAnalysis;
  longTerm: TermAnalysis;
  strengths: StrengthItem[];
  risks: RiskItem[];
  personalRecommendation: PersonalRecommendation;
  summary: string;
  generatedAt: Date;
}

export interface AnalysisFormData {
  location: LocationData | null;
  images: UploadedImage[];
}
