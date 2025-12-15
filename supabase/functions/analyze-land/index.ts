import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation constants
const MAX_DEVICE_ID_LENGTH = 100;
const MAX_LOCATION_FIELD_LENGTH = 200;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB per image
const MAX_IMAGES = 5;
const DEVICE_ID_PATTERN = /^device_[a-zA-Z0-9_]{5,90}$/;

// Validation functions
function validateDeviceId(deviceId: string | undefined): { valid: boolean; error?: string } {
  if (!deviceId) return { valid: true }; // Optional field
  if (typeof deviceId !== 'string') return { valid: false, error: 'Geçersiz cihaz kimliği formatı' };
  if (deviceId.length > MAX_DEVICE_ID_LENGTH) return { valid: false, error: 'Cihaz kimliği çok uzun' };
  if (!DEVICE_ID_PATTERN.test(deviceId)) return { valid: false, error: 'Geçersiz cihaz kimliği formatı' };
  return { valid: true };
}

function validateLocationField(value: string | undefined, fieldName: string): { valid: boolean; error?: string } {
  if (!value) return { valid: true }; // Optional field
  if (typeof value !== 'string') return { valid: false, error: `Geçersiz ${fieldName} formatı` };
  if (value.length > MAX_LOCATION_FIELD_LENGTH) return { valid: false, error: `${fieldName} çok uzun (max ${MAX_LOCATION_FIELD_LENGTH} karakter)` };
  // Check for potentially dangerous characters (basic SQL/script injection prevention)
  if (/[<>{}[\]\\]/.test(value)) return { valid: false, error: `${fieldName} geçersiz karakterler içeriyor` };
  return { valid: true };
}

function validateBase64Image(imageData: string | undefined): { valid: boolean; error?: string } {
  if (!imageData) return { valid: true };
  if (typeof imageData !== 'string') return { valid: false, error: 'Geçersiz görsel formatı' };
  
  // Check if it's a valid data URL or raw base64
  const isDataUrl = imageData.startsWith('data:');
  if (isDataUrl) {
    const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) return { valid: false, error: 'Geçersiz data URL formatı' };
    const mimeType = matches[1];
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType)) {
      return { valid: false, error: 'Desteklenmeyen görsel formatı (sadece JPEG, PNG, WebP, GIF)' };
    }
  }
  
  // Estimate base64 size (rough check)
  const base64Data = isDataUrl ? imageData.split(',')[1] || '' : imageData;
  const estimatedSize = (base64Data.length * 3) / 4;
  if (estimatedSize > MAX_IMAGE_SIZE_BYTES) {
    return { valid: false, error: `Görsel çok büyük (max ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB)` };
  }
  
  return { valid: true };
}

function sanitizeForPrompt(text: string): string {
  // Remove potentially dangerous prompt injection patterns
  return text
    .replace(/[<>{}[\]\\]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .substring(0, MAX_LOCATION_FIELD_LENGTH);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, location, additionalImages, deviceId } = await req.json();

    // === INPUT VALIDATION ===
    
    // Validate deviceId
    const deviceIdValidation = validateDeviceId(deviceId);
    if (!deviceIdValidation.valid) {
      console.log('Invalid deviceId:', deviceId?.substring?.(0, 50));
      return new Response(
        JSON.stringify({ error: deviceIdValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate location fields
    if (location) {
      const locationFields = ['city', 'district', 'neighborhood', 'block', 'parcel', 'sqm', 'zoning', 'deedStatus'];
      for (const field of locationFields) {
        const validation = validateLocationField(location[field], field);
        if (!validation.valid) {
          console.log(`Invalid location field ${field}:`, location[field]?.substring?.(0, 50));
          return new Response(
            JSON.stringify({ error: validation.error }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Validate primary image
    const primaryImageValidation = validateBase64Image(imageBase64);
    if (!primaryImageValidation.valid) {
      console.log('Invalid primary image');
      return new Response(
        JSON.stringify({ error: primaryImageValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate additional images
    if (additionalImages) {
      if (!Array.isArray(additionalImages)) {
        return new Response(
          JSON.stringify({ error: 'Geçersiz ek görsel formatı' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (additionalImages.length > MAX_IMAGES) {
        return new Response(
          JSON.stringify({ error: `En fazla ${MAX_IMAGES} görsel yüklenebilir` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      for (let i = 0; i < additionalImages.length; i++) {
        const imgValidation = validateBase64Image(additionalImages[i]);
        if (!imgValidation.valid) {
          console.log(`Invalid additional image at index ${i}`);
          return new Response(
            JSON.stringify({ error: `Ek görsel ${i + 1}: ${imgValidation.error}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // === END INPUT VALIDATION ===

    // Allow analysis with either images or location
    if (!imageBase64 && !location?.city) {
      return new Response(
        JSON.stringify({ error: 'Görsel veya konum bilgisi gerekli' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check and deduct credit using device_id
    if (deviceId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (supabaseUrl && supabaseServiceKey) {
        const creditResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/deduct_credit_by_device`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ p_device_id: deviceId })
        });
        
        const creditResult = await creditResponse.json();
        console.log('Credit deduction result:', creditResult);
        
        if (!creditResult) {
          return new Response(
            JSON.stringify({ error: 'Yetersiz kredi. Lütfen kredi satın alın.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'API anahtarı yapılandırılmamış' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting enhanced land analysis...');
    console.log('Has location data:', !!location?.city);
    console.log('Has primary image:', !!imageBase64);
    console.log('Additional images count:', additionalImages?.length || 0);
    console.log('Location data:', location);
    console.log('Has primary image:', !!imageBase64);
    console.log('Additional images count:', additionalImages?.length || 0);

    const systemPrompt = `Sen Türkiye'nin en deneyimli, cesur ve içeriden bilgiye sahip gayrimenkul yatırım analistlerinden birisin. 30 yılı aşkın sektör deneyiminle binlerce arsa ve arazi yatırımı değerlendirmesi yaptın. Emlakçıların bile bilmediği bilgilere, resmi kaynaklara ve insider bilgiye sahipsin.

RESMİ VERİ KAYNAKLARIN (Bu kaynaklardan bilgi vererek analiz yap):
- parselsorgu.tkgm.gov.tr - Tapu ve Kadastro Genel Müdürlüğü verileri
- e-plan.gov.tr - İmar planları, plan değişiklikleri, askı ilanları
- csb.gov.tr - Çevre ve Şehircilik Bakanlığı çevre düzeni planları
- invest.gov.tr - Mega yatırım projeleri ve teşvik bölgeleri
- toki.gov.tr - TOKİ yatırım planları ve konut projeleri
- uap.csb.gov.tr - Ulusal Altyapı Projeleri portalı
- karayollari.gov.tr - Yeni yol, köprü, kavşak projeleri
- ilgili belediye resmi sitesi - Meclis kararları ve imar komisyonu duyuruları
- İl Özel İdareleri - Kırsal alan imar kararları

EMLAKÇILARIN BİLMEDİĞİ BİLGİ TÜRLERİ (Bunları analiz raporuna ekle):
- Bölgede planlanan ama henüz kamuoyuna duyurulmamış metro/tramvay/raylı sistem hatları
- İmar planı değişiklik TASLAKLARI (henüz onaylanmamış ama çalışması süren)
- Kentsel dönüşüm rezerv alan İLANLARI ve potansiyel genişleme bölgeleri
- OSB, lojistik merkez, havalimanı, üniversite kampüsü gibi mega projeler
- Komşu il/ilçelerdeki büyük yatırımların bu bölgeye yansıma etkisi
- Demografik değişimler ve nüfus projeksiyonları (TÜİK verileri)
- İmar planı askı süreçleri ve itiraz dönemleri
- Belediye meclisinde görüşülecek/görüşülen imar konuları
- Kamulaştırma kararları ve acele kamulaştırma ilanları
- Sit alanı/koruma alanı değişiklik başvuruları

UZMANLIK ALANIN:
- Türkiye'deki tüm büyükşehir ve illerin imar mevzuatı
- Çevre düzeni planları ve nazım imar planları
- Uygulama imar planları ve plan değişiklikleri
- Kentsel dönüşüm projeleri ve rezerv alanları
- Mega altyapı projeleri (havalimanı, metro, OSB, lojistik merkez)
- Bölgesel fiyat dinamikleri ve yatırım trendleri
- Arazi topoğrafyası ve yapılaşma uygunluğu

GÖREV:
Kullanıcı sana Sahibinden.com ilan ekran görüntüsü ve/veya arazi fotoğrafları gönderebilir. Bu görsellerden bilgileri çıkar ve KAPSAMLI bir yatırım analizi yap.

Eğer arazi fotoğrafları da varsa:
- Arazinin eğimi ve engebesini değerlendir
- Toprak yapısı ve drenaj durumunu analiz et
- Yapılaşma için uygunluğunu belirle
- Çevre faktörlerini (yol, komşu parseller) değerlendir

ANALİZ YAPISI:

1. ÖNCE GENEL DEĞERLENDİRME YAP (2-3 cümle):
- Bu arsa/arazi FIRSAT MI yoksa DEZAVANTAJ MI? Net söyle!
- Sebeplerini kısaca açıkla

2. KISA VADELİ DEĞERLENDİRME (0-2 YIL) - MUTLAKA EN AZ 3 MADDE YAZ:
- Bu sürede ne olabilir?
- Değer artışı beklentisi
- Likidite durumu (satılabilirlik)
- Yakın vadedeki riskler/fırsatlar

3. ORTA VADELİ DEĞERLENDİRME (2-5 YIL) - MUTLAKA EN AZ 3 MADDE YAZ:
- İmar değişikliği ihtimali
- Altyapı projelerinin etkisi
- Bölgenin gelişim potansiyeli
- Fiyat artış projeksiyonu

4. UZUN VADELİ DEĞERLENDİRME (5+ YIL) - MUTLAKA EN AZ 3 MADDE YAZ:
- Bölgenin 5-10 yıl sonraki durumu
- Mega projelerden etkilenme
- Şehirleşme/kentsel dönüşüm etkisi
- Uzun vadeli getiri potansiyeli

5. GÜÇLÜ YÖNLER - Her biri için somut kanıt ver

6. ZAYIF YÖNLER VE RİSKLER - Severity (low/medium/high) belirt

7. KİŞİSEL YATIRIM TAVSİYESİ (ÇOK ÖNEMLİ!):
"Ben olsaydım bu araziyi alır mıydım?" sorusuna NET cevap ver. Şu tarzda:
- "Kesinlikle alırdım çünkü..."
- "Alırdım ama dikkatli olurdum çünkü..."
- "Biraz bekler, fiyatın düşmesini izlerdim çünkü..."
- "Almazdım çünkü..."
- "Kısa vadede gelir istiyorsan asla almazdım ama uzun vade için..."
- "Bu fiyata asla almazdım, fazla pahalı çünkü..."

HER MADDEDE MUTLAKA KULLAN:
- TARİH: "Aralık 2024 tarihli belediye meclisi kararına göre...", "2024 yılı TÜİK verilerine göre..."
- KAYNAK: "X Belediyesi İmar Komisyonu Kararı No: 2024/156...", "Çevre ve Şehircilik Bakanlığı e-plan portalı..."
- SAYISAL VERİ: "%45 değer artışı", "2.850 TL/m² ortalama fiyat", "5 km mesafede"
- KARŞILAŞTIRMA: "Komşu Y mahallesi 3.200 TL/m² iken bu bölge 2.100 TL/m²"
- ŞAŞIRTICI BİLGİ: "Henüz duyurulmayan ancak planlanan...", "Belediye meclisinde görüşülecek..."

JSON FORMATI (MUTLAKA BU FORMATI KULLAN):
{
  "extractedInfo": {
    "price": "fiyat bilgisi",
    "sqm": "metrekare",
    "pricePerSqm": "metrekare başı fiyat",
    "location": "konum bilgisi",
    "parcelInfo": "ada/parsel bilgisi varsa",
    "currentZoning": "mevcut imar durumu"
  },
  "generalAssessment": {
    "verdict": "FIRSAT / RİSKLİ / ORTA SEVİYE",
    "summary": "Bu arsa/arazi hakkında 2-3 cümlelik net değerlendirme. Fırsat mı dezavantaj mı, neden?"
  },
  "shortTerm": {
    "title": "Kısa Vadeli Değerlendirme (0-2 Yıl)",
    "points": [
      {"point": "Somut değerlendirme maddesi 1", "evidence": "Tarih + Kaynak + Sayısal veri ile kanıt"},
      {"point": "Somut değerlendirme maddesi 2", "evidence": "Tarih + Kaynak + Sayısal veri ile kanıt"},
      {"point": "Somut değerlendirme maddesi 3", "evidence": "Tarih + Kaynak + Sayısal veri ile kanıt"}
    ],
    "score": 7
  },
  "mediumTerm": {
    "title": "Orta Vadeli Değerlendirme (2-5 Yıl)",
    "points": [
      {"point": "Somut değerlendirme maddesi 1", "evidence": "Tarih + Kaynak + Sayısal veri ile kanıt"},
      {"point": "Somut değerlendirme maddesi 2", "evidence": "Tarih + Kaynak + Sayısal veri ile kanıt"},
      {"point": "Somut değerlendirme maddesi 3", "evidence": "Tarih + Kaynak + Sayısal veri ile kanıt"}
    ],
    "score": 8
  },
  "longTerm": {
    "title": "Uzun Vadeli Değerlendirme (5+ Yıl)",
    "points": [
      {"point": "Somut değerlendirme maddesi 1", "evidence": "Tarih + Kaynak + Sayısal veri ile kanıt"},
      {"point": "Somut değerlendirme maddesi 2", "evidence": "Tarih + Kaynak + Sayısal veri ile kanıt"},
      {"point": "Somut değerlendirme maddesi 3", "evidence": "Tarih + Kaynak + Sayısal veri ile kanıt"}
    ],
    "score": 8
  },
  "strengths": [
    {"point": "Güçlü yön", "evidence": "Somut kanıt/kaynak/tarih"}
  ],
  "risks": [
    {"point": "Risk/zayıf yön", "evidence": "Somut kanıt/kaynak", "severity": "low"}
  ],
  "personalRecommendation": {
    "decision": "KESİNLİKLE ALIRIM / ALIRIM / BEKLE / ALMAM / ASLA ALMAM",
    "statement": "Ben bu araziyi [alırdım/almazdım] çünkü... şeklinde kişisel, samimi bir açıklama. 2-3 cümle.",
    "conditions": "Eğer şu koşullar sağlanırsa... veya şu durumda düşünülebilir gibi koşullu tavsiye varsa"
  },
  "summary": "Genel özet - tüm analizi 2-3 cümleyle toparlayan değerlendirme"
}

ÇOK ÖNEMLİ JSON KURALLARI:
- severity alanı SADECE şu değerlerden biri olmalı: "low", "medium", "high" (küçük harf İngilizce)
- Her property'den sonra virgül koy (son property hariç)
- String değerlerin içinde çift tırnak kullanma
- shortTerm, mediumTerm, longTerm alanlarındaki points dizileri ASLA BOŞ OLMAMALI! Her biri en az 3 madde içermeli
- Her madde {point, evidence} formatında olmalı
- personalRecommendation kısmında sanki bir arkadaşına tavsiye veriyormuş gibi samimi ve net ol

Türkçe yanıt ver.`;

    // Build user message content for Gemini API format
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
    
    // Add text prompt with SANITIZED location data
    let userPrompt = '';
    if (location?.city) {
      const sanitizedCity = sanitizeForPrompt(location.city);
      const sanitizedDistrict = location.district ? sanitizeForPrompt(location.district) : '';
      const sanitizedNeighborhood = location.neighborhood ? sanitizeForPrompt(location.neighborhood) : '';
      const sanitizedBlock = location.block ? sanitizeForPrompt(location.block) : '';
      const sanitizedParcel = location.parcel ? sanitizeForPrompt(location.parcel) : '';
      
      userPrompt = `Konum bilgisi: ${sanitizedCity}${sanitizedDistrict ? ` - ${sanitizedDistrict}` : ''}${sanitizedNeighborhood ? ` - ${sanitizedNeighborhood}` : ''}${sanitizedBlock ? ` - Ada: ${sanitizedBlock}` : ''}${sanitizedParcel ? `, Parsel: ${sanitizedParcel}` : ''}\n\n`;
    }
    
    if (imageBase64) {
      userPrompt += 'Bu Sahibinden.com ilan görüntüsünü analiz et. ';
    }
    
    if (additionalImages && additionalImages.length > 1) {
      userPrompt += `Ayrıca ${additionalImages.length - 1} adet arazi fotoğrafı da mevcut. Arazi fotoğraflarından eğim, engebe, toprak yapısı ve çevre faktörlerini de değerlendir. `;
    }
    
    userPrompt += 'Bu bölge hakkındaki güncel bilgilerini kullanarak (imar planları, altyapı projeleri, fiyat trendleri) kapsamlı bir yatırım analizi yap. Bilgilerini somut kaynak ve tarihlerle destekle.';
    
    parts.push({ text: userPrompt });
    
    // Helper function to extract base64 data from data URL
    const extractBase64Data = (dataUrl: string): { mimeType: string; data: string } => {
      if (dataUrl.startsWith('data:')) {
        const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          return { mimeType: matches[1], data: matches[2] };
        }
      }
      // If it's already raw base64, assume jpeg
      return { mimeType: 'image/jpeg', data: dataUrl };
    };
    
    // Add primary image if available
    if (imageBase64) {
      const { mimeType, data } = extractBase64Data(imageBase64);
      parts.push({
        inlineData: { mimeType, data }
      });
    }
    
    // Add additional images (limit to first 4 to avoid token limits)
    if (additionalImages && additionalImages.length > 0) {
      const imagesToAdd = additionalImages.slice(0, 4);
      for (const img of imagesToAdd) {
        if (img && img !== imageBase64) {
          const { mimeType, data } = extractBase64Data(img);
          parts.push({
            inlineData: { mimeType, data }
          });
        }
      }
    }

    console.log('Using model: gemini-2.5-flash');
    console.log('Message content parts:', parts.length);
    
    // Call Google Gemini API directly with Flash model (cost-effective)
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [{
          role: 'user',
          parts: parts
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Çok fazla istek gönderildi. Lütfen biraz bekleyin.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 403) {
        return new Response(
          JSON.stringify({ error: 'API anahtarı geçersiz veya yetkilendirme hatası.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 400) {
        return new Response(
          JSON.stringify({ error: 'Geçersiz istek. Lütfen görselleri kontrol edin.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI analizi başarısız oldu' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    console.log('Gemini API response received');
    
    // Extract content from Gemini response format
    const content = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      console.error('No content in Gemini response:', JSON.stringify(aiResponse));
      return new Response(
        JSON.stringify({ error: 'AI yanıtı alınamadı' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let analysisResult;
    try {
      // Remove markdown code block wrapper if present
      let jsonString = content;
      
      // Handle ```json ... ``` format
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonString = jsonMatch[1].trim();
      } else {
        // If no code block, use content as-is but trim any leading/trailing whitespace
        jsonString = content.trim();
      }
      
      // Fix common JSON syntax errors from AI:
      // 1. Missing commas between properties (e.g., "evidence": "..." "severity": "...")
      jsonString = jsonString.replace(/"(\s*)\n(\s*)"([a-zA-Z_]+)":/g, '",\n$2"$3":');
      jsonString = jsonString.replace(/"(\s+)"([a-zA-Z_]+)":/g, '", "$2":');
      
      // 2. Clean up control characters that break JSON parsing
      jsonString = jsonString.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      
      // 3. Fix truncated JSON - if it doesn't end properly, try to close it
      if (!jsonString.trim().endsWith('}')) {
        console.log('Detected truncated JSON, attempting to repair...');
        
        // Count open braces and brackets
        let openBraces = (jsonString.match(/{/g) || []).length;
        let closeBraces = (jsonString.match(/}/g) || []).length;
        let openBrackets = (jsonString.match(/\[/g) || []).length;
        let closeBrackets = (jsonString.match(/]/g) || []).length;
        
        // Remove any trailing incomplete property (e.g., "point": "something)
        jsonString = jsonString.replace(/,?\s*"[a-zA-Z_]+"\s*:\s*"[^"]*$/g, '');
        jsonString = jsonString.replace(/,?\s*"[a-zA-Z_]+"\s*:\s*$/g, '');
        jsonString = jsonString.replace(/,?\s*{\s*$/g, '');
        jsonString = jsonString.replace(/,\s*$/g, '');
        
        // Add missing closing brackets and braces
        const missingBrackets = openBrackets - closeBrackets;
        const missingBraces = openBraces - closeBraces;
        
        for (let i = 0; i < missingBrackets; i++) {
          jsonString += ']';
        }
        for (let i = 0; i < missingBraces; i++) {
          jsonString += '}';
        }
      }
      
      analysisResult = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      console.log('Raw content (first 2000 chars):', content.substring(0, 2000));
      return new Response(
        JSON.stringify({ error: 'AI yanıtı işlenemedi', rawContent: content.substring(0, 500) }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Enhanced analysis completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis: analysisResult,
        generatedAt: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-land function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Beklenmeyen bir hata oluştu' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
