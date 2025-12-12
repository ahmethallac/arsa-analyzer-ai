import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, ArrowRight, ChevronDown, Sparkles, Image, FileText, ZoomIn, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { LocationForm } from '@/components/LocationForm';
import { MultiImageUpload } from '@/components/MultiImageUpload';
import { useToast } from '@/hooks/use-toast';
import type { LocationData, UploadedImage } from '@/types/analysis';
import sahibindenExample from '@/assets/sahibinden-example.png';

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
  const [sahibindenImages, setSahibindenImages] = useState<UploadedImage[]>([]);
  const [araziImages, setAraziImages] = useState<UploadedImage[]>([]);
  const [showManualForm, setShowManualForm] = useState(false);
  const [showFullExample, setShowFullExample] = useState(false);

  const handleSubmit = () => {
    const hasImages = sahibindenImages.length > 0 || araziImages.length > 0;
    const hasManualData = showManualForm && location.city && location.district && location.block && location.parcel;

    if (!hasImages && !hasManualData) {
      toast({
        title: 'Bilgi gerekli',
        description: 'Lütfen en az bir görsel yükleyin veya arazi bilgilerini manuel girin.',
        variant: 'destructive',
      });
      return;
    }

    const analysisData = {
      location: showManualForm ? location : null,
      images: [...sahibindenImages, ...araziImages],
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
              <h1 className="text-xl font-bold text-foreground tracking-tight">Arsa Analiz</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                AI Destekli Değerlendirme
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 pb-8 sm:px-6">
        <div className="max-w-xl mx-auto space-y-5">
          {/* Hero Card - Sahibinden Upload */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-accent">
                <Image className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Sahibinden İlan Görseli</h2>
                <p className="text-xs text-muted-foreground">Analiz için en önemli adım</p>
              </div>
            </div>
            
            {/* Example Image Preview */}
            <div className="mb-4 p-3 rounded-xl bg-accent/50 border border-border">
              <p className="text-xs text-foreground font-medium mb-3">📱 Bu şekilde bir ekran görüntüsü yükleyin:</p>
              
              <div className="flex gap-3">
                {/* Thumbnail */}
                <button
                  onClick={() => setShowFullExample(true)}
                  className="relative flex-shrink-0 w-24 h-32 rounded-lg overflow-hidden border-2 border-primary/30 hover:border-primary transition-colors group"
                >
                  <img 
                    src={sahibindenExample} 
                    alt="Örnek görsel" 
                    className="w-full h-full object-cover object-top"
                  />
                  <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-colors flex items-center justify-center">
                    <ZoomIn className="w-5 h-5 text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-primary/90 py-1">
                    <p className="text-[10px] text-primary-foreground text-center font-medium">Örnek</p>
                  </div>
                </button>
                
                {/* Info */}
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-2">
                    Sahibinden.com ilanındaki <strong className="text-foreground">İlan Bilgileri</strong> sekmesini açıp ekran görüntüsü alın.
                  </p>
                  <ul className="text-[11px] text-muted-foreground space-y-0.5">
                    <li>✓ Fiyat ve m² bilgisi</li>
                    <li>✓ İmar durumu</li>
                    <li>✓ Ada/Parsel no</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <MultiImageUpload
              label="İlan Ekran Görüntüleri"
              description="Sahibinden ilanının detaylarını içeren ekran görüntülerini yükleyin"
              images={sahibindenImages}
              onImagesChange={setSahibindenImages}
              type="sahibinden"
              maxImages={5}
            />
          </div>

          {/* Arazi Görselleri */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-accent">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Arazi Fotoğrafları</h2>
                <p className="text-xs text-muted-foreground">Opsiyonel - Daha detaylı analiz için</p>
              </div>
            </div>
            
            <div className="mb-4 p-3 rounded-xl bg-accent/50 border border-border">
              <p className="text-xs text-muted-foreground">
                🏞️ Arazinin gerçek fotoğraflarını eklerseniz, eğim, engebe ve arazi yapısı da analiz edilir.
              </p>
            </div>
            
            <MultiImageUpload
              label="Arazi Fotoğrafları"
              description="Arazinin farklı açılardan çekilmiş fotoğraflarını yükleyin"
              images={araziImages}
              onImagesChange={setAraziImages}
              type="arazi"
              maxImages={5}
            />
          </div>

          {/* Manual Entry Toggle */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <button
              onClick={() => setShowManualForm(!showManualForm)}
              className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-accent/50 transition-colors"
            >
              <span className="text-sm font-medium text-muted-foreground">
                📝 Arazi bilgilerini manuel eklemek istiyorum
              </span>
              <ChevronDown 
                className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${showManualForm ? 'rotate-180' : ''}`} 
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
            className="w-full h-14 text-base font-semibold rounded-xl gradient-primary shadow-glow hover:opacity-90 transition-all duration-200 hover:shadow-lg animate-fade-in"
            style={{ animationDelay: '0.3s' }}
          >
            <Sparkles className="w-5 h-5 mr-2" />
            <span>Analiz Başlat</span>
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            AI analizi yaklaşık 20-30 saniye içinde hazırlanacak
          </p>
        </div>
      </main>

      {/* Full Example Modal */}
      <Dialog open={showFullExample} onOpenChange={setShowFullExample}>
        <DialogContent className="max-w-sm p-2">
          <button
            onClick={() => setShowFullExample(false)}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-foreground/80 text-background hover:bg-foreground transition-colors z-10"
          >
            <X className="w-4 h-4" />
          </button>
          <img 
            src={sahibindenExample} 
            alt="Sahibinden ilan bilgileri örneği" 
            className="w-full rounded-lg"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
