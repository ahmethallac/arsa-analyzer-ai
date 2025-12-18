import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MapPin, ArrowRight, ChevronDown, Sparkles, Image, Camera, ZoomIn, X, Edit3, Smartphone, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { LocationForm } from '@/components/LocationForm';
import { MultiImageUpload } from '@/components/MultiImageUpload';
import { Footer } from '@/components/Footer';
import { useToast } from '@/hooks/use-toast';
import { useDevice } from '@/hooks/useDevice';
import { useAnalysisData } from '@/contexts/AnalysisDataContext';
import type { LocationData, UploadedImage } from '@/types/analysis';
import sahibindenExample from '@/assets/sahibinden-example.png';

const initialLocation: LocationData = {
  city: '',
  district: '',
  neighborhood: '',
  block: '',
  parcel: ''
};

export default function Index() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setAnalysisData } = useAnalysisData();
  const { profile, loading } = useDevice();
  const [location, setLocation] = useState<LocationData>(initialLocation);
  const [sahibindenImages, setSahibindenImages] = useState<UploadedImage[]>([]);
  const [araziImages, setAraziImages] = useState<UploadedImage[]>([]);
  const [showManualForm, setShowManualForm] = useState(false);
  const [showAraziUpload, setShowAraziUpload] = useState(false);
  const [showFullExample, setShowFullExample] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Determine if button should be disabled
  const isButtonDisabled = loading || isSubmitting || (!showManualForm && sahibindenImages.length === 0);

  // Clear validation error when images are uploaded
  const handleSahibindenImagesChange = (images: UploadedImage[]) => {
    setSahibindenImages(images);
    if (images.length > 0) {
      setValidationError(null);
    }
  };

  const handleSubmit = async () => {
    setValidationError(null);
    
    // Check if still loading profile
    if (loading) {
      setValidationError('Profil yükleniyor, lütfen bekleyin...');
      return;
    }

    // Check if profile has credits
    if (!profile || profile.credits < 1) {
      toast({
        title: 'Yetersiz kredi',
        description: 'Analiz yapmak için kredi satın almanız gerekiyor.',
        variant: 'destructive'
      });
      navigate('/packages');
      return;
    }

    if (showManualForm) {
      // Validate all required fields for manual mode
      if (!location.city || !location.district || !location.neighborhood || !location.block || !location.parcel || !location.sqm || !location.zoning || !location.deedStatus) {
        setValidationError('Lütfen tüm zorunlu alanları doldurun.');
        toast({
          title: 'Eksik bilgi',
          description: 'Lütfen tüm zorunlu alanları doldurun.',
          variant: 'destructive'
        });
        return;
      }
    } else {
      // Photo mode - require at least one image
      if (sahibindenImages.length === 0) {
        setValidationError('Lütfen önce bir sahibinden ilan ekran görüntüsü yükleyin.');
        return;
      }
    }

    // Start submitting
    setIsSubmitting(true);

    // Small delay for visual feedback
    await new Promise(resolve => setTimeout(resolve, 300));

    const data = {
      location: showManualForm ? location : null,
      images: [...sahibindenImages, ...araziImages]
    };
    setAnalysisData(data);
    navigate('/analysis');
  };
  return <div className="min-h-[100dvh] gradient-hero flex flex-col">
      {/* Header */}
      <header className="px-4 py-6 sm:px-6">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl gradient-primary shadow-glow">
                <MapPin className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground tracking-tight">Arsa Analiz</h1>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Akıllı Değerlendirme
                </p>
              </div>
            </div>
            
            {/* Credits Display */}
            {!loading && profile && (
              <Link 
                to="/profile" 
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent border border-border hover:bg-accent/80 transition-colors"
              >
                <Smartphone className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{profile.credits}</span>
                <span className="text-xs text-muted-foreground">kredi</span>
              </Link>
            )}
          </div>
        </div>
      </header>


      {/* Main Content */}
      <main className="px-4 pb-8 sm:px-6 flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto space-y-5">
          {/* Photo Upload Mode */}
          {!showManualForm && <>
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
                    <button onClick={() => setShowFullExample(true)} className="relative flex-shrink-0 w-24 h-32 rounded-lg overflow-hidden border-2 border-primary/30 hover:border-primary transition-colors group">
                      <img src={sahibindenExample} alt="Örnek görsel" className="w-full h-full object-cover object-top" />
                      <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-colors flex items-center justify-center">
                        <ZoomIn className="w-5 h-5 text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-primary/90 py-1">
                        <p className="text-[10px] text-primary-foreground text-center font-medium">Örnek</p>
                      </div>
                    </button>
                    
                    {/* Info */}
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-2">Sahibinden.com ilanındaki İlan Bilgileri sekmesini açıp ekran görüntüsü alıp yükleyin ya da bu bilgilerin yazdığı başka bir ekran görüntüsü yükleyin<strong className="text-foreground">İlan Bilgileri</strong> sekmesini açıp ekran görüntüsü alın.
                      </p>
                      <ul className="text-[11px] text-muted-foreground space-y-0.5">
                        <li>✓ Fiyat ve m² bilgisi</li>
                        <li>✓ İmar durumu</li>
                        <li>✓ Ada/Parsel no</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <MultiImageUpload label="İlan Ekran Görüntüleri" description="Sahibinden ilanının detaylarını içeren ekran görüntülerini yükleyin" images={sahibindenImages} onImagesChange={handleSahibindenImagesChange} type="sahibinden" maxImages={5} />
              </div>

              {/* Arazi Görselleri - Collapsible & Optional */}
              <div className="rounded-2xl border border-dashed border-border bg-card/50 overflow-hidden shadow-sm animate-fade-in" style={{
            animationDelay: '0.1s'
          }}>
                <button onClick={() => setShowAraziUpload(!showAraziUpload)} className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-accent/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <Camera className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">
                          Arazi Fotoğrafları Ekle
                        </span>
                        <span className="text-[10px] font-medium text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded">
                          OPSİYONEL
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        Arazinin gerçek fotoğrafları varsa, tepeden çekilmiş görsellerini de yükleyebilirsiniz
                      </p>
                    </div>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${showAraziUpload ? 'rotate-180' : ''}`} />
                </button>
                
                {showAraziUpload && <div className="px-5 pb-5 border-t border-border pt-4">
                    <div className="mb-4 p-3 rounded-xl bg-accent/30 border border-border">
                      <p className="text-xs text-muted-foreground">
                        🏞️ Arazi fotoğrafları eklerseniz, arazinin eğimi, engebesi ve yapılaşma uygunluğu da değerlendirilir.
                      </p>
                    </div>
                    
                    <MultiImageUpload label="Arazi Fotoğrafları" description="Arazinin farklı açılardan ve tepeden çekilmiş fotoğraflarını yükleyin" images={araziImages} onImagesChange={setAraziImages} type="arazi" maxImages={5} />
                  </div>}
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs font-medium text-muted-foreground">veya</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Manual Entry Toggle Button */}
              <button onClick={() => setShowManualForm(true)} className="w-full rounded-2xl border-2 border-secondary bg-card px-5 py-4 flex items-center justify-between text-left hover:bg-accent/50 transition-colors shadow-sm animate-fade-in" style={{
            animationDelay: '0.2s'
          }}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-secondary">
                    <Edit3 className="w-4 h-4 text-secondary-foreground" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-foreground">
                      İlan Bilgilerini Manuel Gir
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Görsel yüklemek yerine bilgileri kendiniz girin
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </button>
            </>}

          {/* Manual Entry Mode */}
          {showManualForm && <div className="rounded-2xl border-2 border-primary bg-card overflow-hidden shadow-sm animate-fade-in">
              <div className="px-5 py-4 bg-primary/5 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary">
                    <Edit3 className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-foreground">
                      Manuel Bilgi Girişi
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Tüm alanları doldurun
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="px-5 py-5">
                <LocationForm value={location} onChange={setLocation} />
                
                {/* Back to Photo Mode Button */}
                <button onClick={() => {
              setShowManualForm(false);
              setLocation(initialLocation);
            }} className="w-full mt-6 text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
                  Bilgilerimi manuel girmek istemiyorum
                </button>
              </div>
            </div>}

          {/* Validation Error Message */}
          {validationError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive animate-fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm">{validationError}</p>
            </div>
          )}

          {/* Submit Button */}
          <Button 
            onClick={handleSubmit} 
            size="lg" 
            disabled={isButtonDisabled}
            className="w-full h-14 text-base font-semibold rounded-xl gradient-primary shadow-glow hover:opacity-90 transition-all duration-200 hover:shadow-lg animate-fade-in disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none" 
            style={{ animationDelay: '0.3s' }}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                <span>Yükleniyor...</span>
              </>
            ) : isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                <span>Hazırlanıyor...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                <span>Analizi Başlat</span>
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            {!showManualForm && sahibindenImages.length === 0 
              ? 'Analiz başlatmak için ilan görseli yükleyin'
              : 'Analiz yaklaşık 30-45 saniye içinde hazırlanacak'
            }
          </p>
        </div>
      </main>

      <Footer />

      {/* Full Example Modal */}
      <Dialog open={showFullExample} onOpenChange={setShowFullExample}>
        <DialogContent className="max-w-sm p-2">
          <button onClick={() => setShowFullExample(false)} className="absolute top-2 right-2 p-1.5 rounded-full bg-foreground/80 text-background hover:bg-foreground transition-colors z-10">
            <X className="w-4 h-4" />
          </button>
          <img src={sahibindenExample} alt="Sahibinden ilan bilgileri örneği" className="w-full rounded-lg" />
        </DialogContent>
      </Dialog>
    </div>;
}