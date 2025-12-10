import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
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

    console.log('Starting land analysis...');
    console.log('Location data:', location);

    const systemPrompt = `Sen bir arsa ve arazi yatırım analistisin. Türkiye'deki arsa piyasasını çok iyi biliyorsun.
    
Kullanıcı sana bir Sahibinden.com ilan ekran görüntüsü gönderecek. Bu görüntüden:
1. Fiyat bilgisini çıkar
2. Metrekare bilgisini çıkar
3. Konum detaylarını çıkar (il, ilçe, mahalle)
4. İlan özelliklerini analiz et

Ardından bu arsa için kapsamlı bir yatırım analizi yap:

YANIT FORMATINI MUTLAKA JSON OLARAK VER:
{
  "extractedInfo": {
    "price": "fiyat bilgisi",
    "sqm": "metrekare",
    "pricePerSqm": "metrekare başı fiyat",
    "location": "konum bilgisi"
  },
  "shortTerm": {
    "title": "Kısa Vadeli Değerlendirme (0-2 Yıl)",
    "points": ["madde1", "madde2", "madde3"],
    "score": 7
  },
  "mediumTerm": {
    "title": "Orta Vadeli Değerlendirme (2-5 Yıl)",
    "points": ["madde1", "madde2", "madde3"],
    "score": 8
  },
  "longTerm": {
    "title": "Uzun Vadeli Değerlendirme (5+ Yıl)",
    "points": ["madde1", "madde2", "madde3"],
    "score": 8
  },
  "strengths": ["güçlü yön 1", "güçlü yön 2", "güçlü yön 3"],
  "risks": ["risk 1", "risk 2", "risk 3"],
  "summary": "Genel değerlendirme özeti (2-3 cümle)"
}

Puanlama 1-10 arasında olmalı.
Türkçe yanıt ver.`;

    const userPrompt = location?.city 
      ? `Bu Sahibinden.com ilan görüntüsünü analiz et. Kullanıcı manuel olarak şu bilgileri de girdi: ${location.city} - ${location.district || ''} ${location.neighborhood || ''}`
      : 'Bu Sahibinden.com ilan görüntüsünü analiz et ve arsa yatırım değerlendirmesi yap.';

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
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

    // Parse JSON from response
    let analysisResult;
    try {
      // Extract JSON from markdown code blocks if present
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

    console.log('Analysis completed successfully');

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
