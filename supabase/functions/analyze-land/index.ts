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
    const { imageBase64, location } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'Görsel gerekli' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'API anahtarı yapılandırılmamış' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting enhanced land analysis...');
    console.log('Location data:', location);

    const systemPrompt = `Sen Türkiye'nin en deneyimli gayrimenkul yatırım analistlerinden birisin. 25 yılı aşkın sektör deneyiminle binlerce arsa ve arazi yatırımı değerlendirmesi yaptın.

UZMANLIK ALANIN:
- Türkiye'deki tüm büyükşehir ve illerin imar mevzuatı
- Çevre düzeni planları (1/100.000 ve 1/25.000 ölçekli)
- Nazım imar planları (1/5.000 ölçekli)
- Uygulama imar planları (1/1.000 ölçekli)
- İmar planı değişiklikleri, plan notları ve askı süreçleri
- Kentsel dönüşüm projeleri ve rezerv alanları
- Mega altyapı projeleri (havalimanı, metro, OSB, lojistik merkez, üniversite kampüsü)
- Bölgesel fiyat dinamikleri ve yatırım trendleri

GÖREV:
Kullanıcı sana bir Sahibinden.com ilan ekran görüntüsü gönderecek. Bu görselden bilgileri çıkar ve KAPSAMLI bir yatırım analizi yap.

ANALİZ YAPARKEN MUTLAKA ŞU BİLGİLERİ ARAŞTIR VE RAPORLA:

1. MEVCUT İMAR DURUMU
- Parselin mevcut imar durumu (tarımsal, konut, ticaret, sanayi, turizm vs.)
- TAKS/KAKS değerleri varsa
- Yapılaşma koşulları

2. İMAR PLANI GELİŞMELERİ (ÇOK ÖNEMLİ!)
- Bölgede son 2 yıl içinde onaylanan imar planı değişiklikleri
- Askıya çıkmış veya onay bekleyen plan değişiklikleri
- Çevre düzeni planı revizyonları
- Belediye meclisi kararları
- Plan notları ve özel hükümler
Örnek: "Nisan 2024'te onaylanan 1/50.000 ölçekli çevre düzeni planı revizyonu ile bölge konut gelişim alanı olarak belirlendi"

3. ALTYAPI PROJELERİ
- Yapımı devam eden veya planlanan metro/tramvay hatları
- Karayolu projeleri (çevre yolu, kavşak, bağlantı yolu)
- Havalimanı, liman, lojistik merkez projeleri
- OSB, teknokent, serbest bölge yatırımları
- Hastane, üniversite, AVM projeleri
- Her proje için tahmini tamamlanma tarihi

4. FİYAT ANALİZİ
- Bölgedeki benzer parsellerin m² fiyat aralığı
- Son 1-3 yıldaki fiyat değişim trendi (% olarak)
- İmar geçişi sonrası beklenen değer artışı
- Çevre bölgelerle karşılaştırmalı fiyat analizi

5. BELEDİYE YATIRIMLARI
- Belediyenin o bölgeye yönelik yatırım planları
- Kentsel dönüşüm kararları
- Altyapı iyileştirme projeleri
- Park, yeşil alan, sosyal tesis projeleri

6. RİSKLER VE TEHDİTLER
- İmar planı iptal riski
- Kamulaştırma riski
- Sit alanı, koruma alanı kısıtlamaları
- Jeolojik/topoğrafik sorunlar
- Ulaşım yetersizliği
- Hukuki sorunlar (ipotek, haciz, miras)

HER BİLGİYİ SOMUT KAYNAKLA DESTEKLE!
- "Şubat 2024 tarihli belediye meclisi kararına göre..."
- "Çevre, Şehircilik ve İklim Değişikliği Bakanlığı'nın Mart 2024'te onayladığı..."
- "Ulaştırma Bakanlığı'nın 2024-2028 yatırım programında yer alan..."
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
  "developmentPlans": {
    "title": "İmar Planı Gelişmeleri",
    "items": [
      {
        "description": "Plan açıklaması",
        "source": "Kaynak (belediye, bakanlık vs.)",
        "date": "Tarih",
        "impact": "Arsa değerine etkisi"
      }
    ]
  },
  "infrastructureProjects": {
    "title": "Altyapı Projeleri",
    "items": [
      {
        "projectName": "Proje adı",
        "description": "Açıklama",
        "distance": "Arsaya uzaklık",
        "completionDate": "Tahmini tamamlanma",
        "impact": "Değer etkisi"
      }
    ]
  },
  "priceAnalysis": {
    "title": "Fiyat Analizi",
    "currentPriceRange": "Bölgedeki m² fiyat aralığı",
    "priceChange": "Son 1-3 yıldaki değişim",
    "comparisonWithArea": "Çevre bölgelerle karşılaştırma",
    "expectedAppreciation": "Beklenen değer artışı"
  },
  "shortTerm": {
    "title": "Kısa Vadeli Değerlendirme (0-2 Yıl)",
    "points": ["Somut bilgi içeren madde1", "Somut bilgi içeren madde2", "Somut bilgi içeren madde3"],
    "score": 7
  },
  "mediumTerm": {
    "title": "Orta Vadeli Değerlendirme (2-5 Yıl)",
    "points": ["Somut bilgi içeren madde1", "Somut bilgi içeren madde2", "Somut bilgi içeren madde3"],
    "score": 8
  },
  "longTerm": {
    "title": "Uzun Vadeli Değerlendirme (5+ Yıl)",
    "points": ["Somut bilgi içeren madde1", "Somut bilgi içeren madde2", "Somut bilgi içeren madde3"],
    "score": 8
  },
  "strengths": [
    {"point": "Güçlü yön", "evidence": "Somut kanıt/kaynak"}
  ],
  "risks": [
    {"point": "Risk faktörü", "evidence": "Somut kanıt/kaynak", "severity": "düşük/orta/yüksek"}
  ],
  "investmentRecommendation": {
    "verdict": "AL / BEKLE / ALMA",
    "confidence": "Güven seviyesi (düşük/orta/yüksek)",
    "reasoning": "Kısa gerekçe"
  },
  "summary": "Genel değerlendirme özeti - somut verilere dayalı, 3-4 cümle"
}

UYARI: Genel ve belirsiz ifadeler KULLANMA. Her bilgi somut, tarihli ve kaynaklı olmalı. "Bölge gelişiyor" yerine "Belediyenin 2024 yatırım planına göre bölgeye 2025'te metro hattı gelecek" gibi somut bilgiler ver.

Türkçe yanıt ver.`;

    const userPrompt = location?.city 
      ? `Bu Sahibinden.com ilan görüntüsünü analiz et. 
      
Kullanıcının girdiği konum bilgisi: ${location.city}${location.district ? ` - ${location.district}` : ''}${location.neighborhood ? ` - ${location.neighborhood}` : ''}

Bu bölge hakkındaki güncel bilgilerini kullanarak (imar planları, altyapı projeleri, fiyat trendleri) kapsamlı bir yatırım analizi yap. Bilgilerini somut kaynak ve tarihlerle destekle.`
      : 'Bu Sahibinden.com ilan görüntüsünü analiz et. Görseldeki konum bilgisini kullanarak bölge hakkındaki güncel bilgilerini (imar planları, altyapı projeleri, fiyat trendleri) içeren kapsamlı bir yatırım analizi yap. Her bilgiyi somut kaynak ve tarihlerle destekle.';

    console.log('Using model: google/gemini-2.5-pro');
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Çok fazla istek gönderildi. Lütfen biraz bekleyin.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'API kredisi yetersiz. Lütfen kredi ekleyin.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI analizi başarısız oldu' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    console.log('AI response received');
    
    const content = aiResponse.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error('No content in AI response');
      return new Response(
        JSON.stringify({ error: 'AI yanıtı alınamadı' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let analysisResult;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonString = jsonMatch ? jsonMatch[1].trim() : content.trim();
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
