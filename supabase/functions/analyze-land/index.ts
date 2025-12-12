import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, location, additionalImages } = await req.json();

    // Allow analysis with either images or location
    if (!imageBase64 && !location?.city) {
      return new Response(
        JSON.stringify({ error: 'Görsel veya konum bilgisi gerekli' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
    console.log('Location data:', location);
    console.log('Has primary image:', !!imageBase64);
    console.log('Additional images count:', additionalImages?.length || 0);

    const systemPrompt = `Sen Türkiye'nin en deneyimli ve cesur gayrimenkul yatırım analistlerinden birisin. 25 yılı aşkın sektör deneyiminle binlerce arsa ve arazi yatırımı değerlendirmesi yaptın. Yatırımcılara net, cesur ve samimi tavsiyeler verirsin.

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

ANALİZ YAPISIN:

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

6. ZAYIF YÖNLER VE RİSKLER - Severity (düşük/orta/yüksek) belirt

7. KİŞİSEL YATIRIM TAVSİYESİ (ÇOK ÖNEMLİ!):
"Ben olsaydım bu araziyi alır mıydım?" sorusuna NET cevap ver. Şu tarzda:
- "Kesinlikle alırdım çünkü..."
- "Alırdım ama dikkatli olurdum çünkü..."
- "Biraz bekler, fiyatın düşmesini izlerdim çünkü..."
- "Almazdım çünkü..."
- "Kısa vadede gelir istiyorsan asla almazdım ama uzun vade için..."
- "Bu fiyata asla almazdım, fazla pahalı çünkü..."

HER BİLGİYİ SOMUT KAYNAKLA DESTEKLE!
- "Şubat 2024 tarihli belediye meclisi kararına göre..."
- "Bölgedeki m² fiyatları son 18 ayda ortalama %65 artış gösterdi..."

JSON FORMATI:
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
      {"point": "Somut değerlendirme maddesi 1", "evidence": "Kaynak veya gerekçe"},
      {"point": "Somut değerlendirme maddesi 2", "evidence": "Kaynak veya gerekçe"},
      {"point": "Somut değerlendirme maddesi 3", "evidence": "Kaynak veya gerekçe"}
    ],
    "score": 7
  },
  "mediumTerm": {
    "title": "Orta Vadeli Değerlendirme (2-5 Yıl)",
    "points": [
      {"point": "Somut değerlendirme maddesi 1", "evidence": "Kaynak veya gerekçe"},
      {"point": "Somut değerlendirme maddesi 2", "evidence": "Kaynak veya gerekçe"},
      {"point": "Somut değerlendirme maddesi 3", "evidence": "Kaynak veya gerekçe"}
    ],
    "score": 8
  },
  "longTerm": {
    "title": "Uzun Vadeli Değerlendirme (5+ Yıl)",
    "points": [
      {"point": "Somut değerlendirme maddesi 1", "evidence": "Kaynak veya gerekçe"},
      {"point": "Somut değerlendirme maddesi 2", "evidence": "Kaynak veya gerekçe"},
      {"point": "Somut değerlendirme maddesi 3", "evidence": "Kaynak veya gerekçe"}
    ],
    "score": 8
  },
  "strengths": [
    {"point": "Güçlü yön", "evidence": "Somut kanıt/kaynak"}
  ],
  "risks": [
    {"point": "Risk/zayıf yön", "evidence": "Somut kanıt/kaynak", "severity": "düşük/orta/yüksek"}
  ],
  "personalRecommendation": {
    "decision": "KESİNLİKLE ALIRIM / ALIRIM / BEKLE / ALMAM / ASLA ALMAM",
    "statement": "Ben bu araziyi [alırdım/almazdım] çünkü... şeklinde kişisel, samimi bir açıklama. 2-3 cümle.",
    "conditions": "Eğer şu koşullar sağlanırsa... veya şu durumda düşünülebilir gibi koşullu tavsiye varsa"
  },
  "summary": "Genel özet - tüm analizi 2-3 cümleyle toparlayan değerlendirme"
}

ÇOK ÖNEMLİ:
- shortTerm, mediumTerm, longTerm alanlarındaki points dizileri ASLA BOŞ OLMAMALI! Her biri en az 3 madde içermeli.
- Her madde {point, evidence} formatında olmalı.
- personalRecommendation kısmında sanki bir arkadaşına tavsiye veriyormuş gibi samimi ve net ol.

Türkçe yanıt ver.`;

    // Build user message content for Gemini API format
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
    
    // Add text prompt
    let userPrompt = '';
    if (location?.city) {
      userPrompt = `Konum bilgisi: ${location.city}${location.district ? ` - ${location.district}` : ''}${location.neighborhood ? ` - ${location.neighborhood}` : ''}${location.block ? ` - Ada: ${location.block}` : ''}${location.parcel ? `, Parsel: ${location.parcel}` : ''}\n\n`;
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
    
    // Call Google Gemini API directly
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
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      let jsonString = jsonMatch ? jsonMatch[1].trim() : content.trim();
      
      // Clean up control characters that break JSON parsing
      // Replace literal newlines inside strings with escaped newlines
      jsonString = jsonString.replace(/[\x00-\x1F\x7F]/g, (char: string) => {
        if (char === '\n') return '\\n';
        if (char === '\r') return '\\r';
        if (char === '\t') return '\\t';
        return '';
      });
      
      analysisResult = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      console.log('Raw content:', content);
      return new Response(
        JSON.stringify({ error: 'AI yanıtı işlenemedi', rawContent: content }),
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
