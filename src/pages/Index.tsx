import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Upload, ArrowRight, ChevronDown } from 'lucide-react';
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
  const [showManualForm, setShowManualForm] = useState(false);

  const handleSahibindenSelect = (file: File, preview: string) => {
    setSahibindenImage({ file, preview, type: 'sahibinden' });
  };

  const handleSubmit = () => {
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
      location: showManualForm ? location : null,
      images: [sahibindenImage].filter(Boolean),
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
        <div className="max-w-xl mx-auto space-y-6">
          {/* Sahibinden Image Upload - Primary */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-primary mb-4">
              <Upload className="w-5 h-5" />
              <h2 className="text-lg font-semibold">Sahibinden Ekran Görüntüsü</h2>
            </div>
            
            <ImageUpload
              label="İlan Sayfası Görüntüsü"
              description="Sahibinden'deki arazi ilanının ekran görüntüsünü yükleyin. Fiyat, metrekare, konum ve ilan detayları görünür olmalı."
              onImageSelect={handleSahibindenSelect}
              onImageRemove={() => setSahibindenImage(null)}
              preview={sahibindenImage?.preview}
              required
            />
          </div>

          {/* Manual Entry Toggle */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <button
              onClick={() => setShowManualForm(!showManualForm)}
              className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-accent/50 transition-colors"
            >
              <span className="text-sm font-medium text-muted-foreground">
                Arazi bilgilerini manuel eklemek istiyorum
              </span>
              <ChevronDown 
                className={`w-5 h-5 text-muted-foreground transition-transform ${showManualForm ? 'rotate-180' : ''}`} 
              />
            </button>
            
            {showManualForm && (
              <div className="px-5 pb-5 border-t border-border pt-5">
                <LocationForm value={location} onChange={setLocation} />
              </div>
            )}
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
