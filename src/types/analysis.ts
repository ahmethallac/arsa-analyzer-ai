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

export interface AnalysisResult {
  shortTerm: {
    title: string;
    points: string[];
    score: number; // 1-10
  };
  mediumTerm: {
    title: string;
    points: string[];
    score: number;
  };
  longTerm: {
    title: string;
    points: string[];
    score: number;
  };
  strengths: string[];
  risks: string[];
  summary: string;
  generatedAt: Date;
}

export interface AnalysisFormData {
  location: LocationData;
  images: UploadedImage[];
}
