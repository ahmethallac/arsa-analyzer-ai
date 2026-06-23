# Deploy `verify-google-play-purchase` Edge Function

## Amaç
Mevcut `supabase/functions/verify-google-play-purchase/index.ts` dosyasını Lovable Cloud (Supabase) üzerine deploy etmek. UI'da ve secret'larda değişiklik yok.

## Mevcut Durum
- Fonksiyon kodu zaten repoda mevcut ve doğru yapılandırılmış (CORS, JWT doğrulama, Google Play API çağrısı, `grant_google_play_purchase_credits` RPC çağrısı).
- Gerekli secret'lar mevcut: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_PLAY_PACKAGE_NAME`.
- Frontend (`src/lib/payments.ts`) zaten `supabase.functions.invoke('verify-google-play-purchase', ...)` ile bu fonksiyonu çağırıyor.

## Eksik Secret (Kritik)
Fonksiyon `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` secret'ını okuyor ama secret listesinde **bu secret yok**. Bu secret olmadan fonksiyon her çağrıda 503 dönecek:
```
"Ödeme sistemi henüz yapılandırılmadı."
```

`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`: Google Cloud Console → IAM → Service Accounts üzerinden oluşturulan, Google Play Android Developer API erişimi olan service account'un JSON anahtarının tam içeriği.

## Adımlar (build mode'a geçildikten sonra)

1. **Deploy**: `supabase--deploy_edge_functions` ile `verify-google-play-purchase` fonksiyonunu deploy et.
2. **Doğrula**: `supabase--edge_function_logs` ile deploy başarılı mı kontrol et.
3. **(Opsiyonel) Test**: `supabase--curl_edge_functions` ile OPTIONS isteği atarak CORS yanıtını doğrula (gerçek satın alma testi mobil cihaz gerektirir).

## Sorular

1. **`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` secret'ı**: Şimdi eklemek ister misin? Eklemezsek fonksiyon deploy olur ama her çağrıda 503 döner. Hazır JSON anahtarın varsa deploy sonrası `add_secret` ile ekleyebilirim.
2. Sadece deploy ile mi sınırlı kalalım, yoksa deploy sonrası bir smoke test (curl) de yapayım mı?
