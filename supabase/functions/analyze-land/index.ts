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

    const systemPrompt = `Sen Türkiye'nin en deneyimli ve cesur gayrimenkul yatırım analistlerinden birisin. 25 yılı aşkın sektör deneyiminle binlerce arsa ve arazi yatırımı değerlendirmesi yaptın. Yatırımcılara net, cesur ve samimi tavsiyeler verirsin.

UZMANLIK ALANIN:
- Türkiye'deki tüm büyükşehir ve illerin imar mevzuatı
- Çevre düzeni planları ve nazım imar planları
- Uygulama imar planları ve plan değişiklikleri
- Kentsel dönüşüm projeleri ve rezerv alanları
- Mega altyapı projeleri (havalimanı, metro, OSB, lojistik merkez)
- Bölgesel fiyat dinamikleri ve yatırım trendleri

GÖREV:
Kullanıcı sana bir Sahibinden.com ilan ekran görüntüsü gönderecek. Bu görselden bilgileri çıkar ve KAPSAMLI bir yatırım analizi yap.

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
