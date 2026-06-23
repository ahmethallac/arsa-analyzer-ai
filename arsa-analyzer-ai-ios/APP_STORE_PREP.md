# App Store hazırlık notları

Bu klasör iOS/App Store hazırlığı için ayrılmış kopyadır. Android için çalışan ana proje klasörü değiştirilmedi.

## Windows tarafında yapılan hazırlık

- Paket ekranı platforma göre mağaza seçer:
  - Android: `verify-google-play-purchase`
  - iOS: `verify-app-store-purchase`
- App Store receipt doğrulaması için yeni Supabase Edge Function eklendi:
  - `supabase/functions/verify-app-store-purchase`
- App Store transaction id ile kredi yazan migration eklendi:
  - `supabase/migrations/20260623120000_app_store_purchase_credits.sql`
- Gizlilik politikasındaki ödeme metni App Store / Google Play ortak hale getirildi.

## Supabase secrets

Apple doğrulama fonksiyonu için Supabase tarafında şu secret gerekli olabilir:

```bash
supabase secrets set APP_STORE_BUNDLE_ID=com.arsaanaliz.app
```

Uygulamada ileride abonelik eklenirse veya Apple receipt yapısı shared secret isterse:

```bash
supabase secrets set APP_STORE_SHARED_SECRET=<app-specific-shared-secret>
```

Mevcut kredi paketleri consumable IAP olarak planlandı:

- `package_10`
- `package_20`
- `package_50`

## Mac tarafında yapılacaklar

Mac'te bu klasör açıldıktan sonra:

```bash
npm install
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios
```

Xcode'da:

- Apple Developer hesabı ile Team seç.
- Bundle ID: `com.arsaanaliz.app`
- In-App Purchase capability gerekiyorsa aç.
- Gerçek cihaz veya TestFlight ile satın alma testlerini yap.
- `Product > Archive` ile build al.
- `Distribute App > App Store Connect` ile yükle.

## App Store Connect

App Store Connect'te consumable in-app purchase ürünlerini aynı id'lerle oluştur:

- `package_10`
- `package_20`
- `package_50`

Ürünler review'a gönderilecek app versiyonuyla ilişkilendirilmeli ve sandbox satın alma testi yapılmalı.
