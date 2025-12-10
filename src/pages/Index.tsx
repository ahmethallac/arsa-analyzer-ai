import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, ImagePlus, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LocationForm } from '@/components/LocationForm';
import { ImageUpload } from '@/components/ImageUpload';
import { useToast } from '@/hooks/use-toast';
import type { LocationData, UploadedImage } from '@/types/analysis';

const initialLocation: LocationData = {
  city: '',
  district: '',
  neighborhood: '',
  block: '',
  parcel: '',
};

export default function Index() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [location, setLocation] = useState<LocationData>(initialLocation);
  const [sahibindenImage, setSahibindenImage] = useState<UploadedImage | null>(null);
  const [imarImage, setImarImage] = useState<UploadedImage | null>(null);

  const handleSahibindenSelect = (file: File, preview: string) => {
    setSahibindenImage({ file, preview, type: 'sahibinden' });
  };

  const handleImarSelect = (file: File, preview: string) => {
    setImarImage({ file, preview, type: 'imar' });
  };

  const handleSubmit = () => {
    // Validation
    if (!location.city || !location.district || !location.block || !location.parcel) {
      toast({
        title: 'Eksik bilgi',
        description: 'Lütfen şehir, ilçe, ada ve parsel bilgilerini girin.',
        variant: 'destructive',
      });
      return;
    }

    if (!sahibindenImage) {
      toast({
        title: 'Görsel gerekli',
        description: 'Lütfen Sahibinden ekran görüntüsü yükleyin.',
        variant: 'destructive',
      });
      return;
    }

    // Store data and navigate to analysis page
    const analysisData = {
      location,
      images: [sahibindenImage, imarImage].filter(Boolean),
    };
    
    sessionStorage.setItem('analysisData', JSON.stringify(analysisData));
    navigate('/analysis');
  };

  return (
    <div className="min-h-screen gradient-hero">
      {/* Header */}
      <header className="px-4 py-6 sm:px-6">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl gradient-primary shadow-glow">
              <MapPin className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Arsa Analiz</h1>
              <p className="text-xs text-muted-foreground">AI Destekli Değerlendirme</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 pb-8 sm:px-6">
        <div className="max-w-xl mx-auto space-y-8">
          {/* Intro Card */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-accent">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground mb-1">Nasıl Çalışır?</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Arsa bilgilerinizi girin ve Sahibinden ilanının ekran görüntüsünü yükleyin. 
                  AI, kısa, orta ve uzun vadeli yatırım değerlendirmesi yapacak.
                </p>
              </div>
            </div>
          </div>

          {/* Location Form */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <LocationForm value={location} onChange={setLocation} />
          </div>

          {/* Image Uploads */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-6">
            <div className="flex items-center gap-2 text-primary">
              <ImagePlus className="w-5 h-5" />
              <h2 className="text-lg font-semibold">Görseller</h2>
            </div>

            <ImageUpload
              label="Sahibinden Ekran Görüntüsü"
              description="İlan sayfasının ekran görüntüsünü yükleyin (fiyat, metrekare, özellikler görünmeli)"
              onImageSelect={handleSahibindenSelect}
              onImageRemove={() => setSahibindenImage(null)}
              preview={sahibindenImage?.preview}
              required
            />

            <ImageUpload
              label="İmar Durumu Belgesi (Opsiyonel)"
              description="Belediyeden alınan imar durumu belgesinin görselini yükleyin"
              onImageSelect={handleImarSelect}
              onImageRemove={() => setImarImage(null)}
              preview={imarImage?.preview}
            />
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            size="lg"
            className="w-full h-14 text-base font-semibold rounded-xl gradient-primary shadow-glow hover:opacity-90 transition-opacity"
          >
            <span>Analiz Başlat</span>
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Analiz sonuçları yaklaşık 30 saniye içinde hazırlanacak
          </p>
        </div>
      </main>
    </div>
  );
}
