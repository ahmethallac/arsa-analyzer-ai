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
  type: 'sahibinden' | 'imar';
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

export interface DevelopmentPlan {
  name: string;
  date: string;
  impact: string;
}

export interface InfrastructureProject {
  name: string;
  status: string;
  expectedCompletion: string;
  impact: string;
}

export interface PriceAnalysis {
  currentPricePerSqm: string;
  regionAverage: string;
  trend: string;
  comparison: string;
}

export interface InvestmentRecommendation {
  decision: 'BUY' | 'WAIT' | 'AVOID';
  reason: string;
  confidence: number;
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
  };
  shortTerm: TermAnalysis;
  mediumTerm: TermAnalysis;
  longTerm: TermAnalysis;
  developmentPlans: DevelopmentPlan[];
  infrastructureProjects: InfrastructureProject[];
  priceAnalysis: PriceAnalysis;
  strengths: StrengthItem[];
  risks: RiskItem[];
  investmentRecommendation: InvestmentRecommendation;
  summary: string;
  generatedAt: Date;
}

export interface AnalysisFormData {
  location: LocationData;
  images: UploadedImage[];
}
