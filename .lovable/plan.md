
## 1. Paket revizyonu (Packages.tsx)
- İlk paketi `5 kredi / 150 TL` yap (id `package_5`, mevcut price ID `price_1TuJJQGXuVsNcb81cE6qgYFC` — Stripe'da isim zaten güncellendi, sadece görüneni değiştiriyoruz).
- 20 kredi paketinin price ID'sini `price_1TuXchGXuVsNcb81Tagzt58l` yap; `fallbackPrice: 300`, `originalPrice` ve indirim yüzdesini yeni fiyata göre güncelle (417 → ~500 TL, indirim %40).
- 50 kredi paketi aynı kalır.
- "Mevcut Krediniz" kutusundaki 0 durumunda "en az 5 kredilik paketi alın" mesajını yumuşat.

## 2. Ücretsiz kredi tamamen kaldırılıyor
- Kayıt sırasında verilen 1 kredilik hoşgeldin bonusu (`ensure_profile_credit_floor` / `ensure_signup_bonus`) ve cihaz profili için 5 kredi (`get_or_create_device_profile`) veren kısımlar kaldırılacak; yeni kullanıcılar 0 kredi ile başlayacak.
- `Index.tsx`'te "kredi yok" durumunda direkt `/packages`'a yönlendir; hiçbir sorgu ücretsiz başlamayacak.
- Migration olarak `ensure_profile_credit_floor`, `ensure_signup_bonus`, `handle_new_user`, `get_or_create_device_profile`, `link_device_to_user`, `get_credit_balance_for_user_device` fonksiyonları yeniden yazılacak: signup_bonus insert eden satırlar çıkarılacak, initial `credits = 0` olacak.
- (Var olan kullanıcıların mevcut kredileri korunur — sadece yeni verme durur.)

## 3. Ana sayfaya "Örnek Rapor Gör" bölümü
- Yüklenen PDF (`ArsaAnaliz.app_Kocale-Kartepe-Şirinsulhiye_mah._örnek_rapor.pdf`) lovable-assets üzerinden CDN'e yüklenip `src/assets/ornek-rapor.pdf.asset.json` olarak import edilecek.
- `Index.tsx`'te belirgin bir "📄 Örnek Rapor Gör" kartı/butonu.
- Tıklayınca full-screen `Dialog` popup: içeride `<iframe src={pdfUrl} />` ile PDF gömülü, sağ üstte büyük, kontrastlı bir kapatma (X) butonu.
- Mobil için PDF iframe yüksekliği `100dvh` ile ayarlanacak, "Yeni sekmede aç" fallback linki de bulunacak.

## 4. PDF indirme kalitesinin düzeltilmesi (usePdfDownload.ts)
Mevcut kod tek büyük `html2canvas` görseli çekip A4'e "pozisyonu negatif kaydırarak" bölüyor — bu yüzden yazılar sayfa aralarında kesiliyor ve düşük DPI'da bulanık çıkıyor.

Yeni yaklaşım:
- `html2canvas` scale'i 3'e çıkart, `letterRendering: true`, `imageTimeout: 0`, arka planı gerçek `--background` değerine ayarla.
- Bölünme sorununu çözmek için: rapor içeriğini `AnalysisReportContent` içinde bölüm bazlı (`.pdf-section` sınıfı) render et. `usePdfDownload` her section'ı ayrı ayrı `html2canvas` ile çekip, sığmıyorsa yeni sayfada başlat — böylece **başlıklar/kartlar ortadan bölünmez**.
- JPEG yerine PNG kal (metin keskinliği için), ancak `pdf.addImage` için `compression: 'FAST'` ve `format: 'PNG'`.
- Alternatif olarak (basit yol): tek büyük canvas'ı A4 genişliğine ölçekle, sayfa yüksekliğine göre `sliceCanvas` fonksiyonu ile **piksel bazında böl** (her sayfa için ayrı bir canvas oluştur, ilgili y-aralığını `drawImage` ile aktar). Bu, negatif offset yerine gerçek dilim kullanır — kenar bulanıklığı olmaz.
- Font rendering: PDF içeriğinde kullanılan Türkçe karakterler için `AnalysisReportContent`'in dışa aktarılan versiyonunda web fontlarının yüklendiğini garanti etmek için `document.fonts.ready` beklenecek.
- Genişlik `720px` yerine A4 oranına uygun `794px` (@96dpi) olacak.

## 5. Analiz geçmişi sunucu tarafına taşınıyor + 15 gün otomatik silme
Şu an geçmiş sadece `localStorage`'da (`analysisHistory.ts`). Kullanıcı isteği: veritabanında saklansın, 15 gün sonra her yerden silinsin.

- Migration ile yeni tablo:
  ```
  public.analysis_reports (
    id uuid pk,
    user_id uuid not null references auth.users,
    location_json jsonb,
    result_json jsonb not null,
    created_at timestamptz default now(),
    expires_at timestamptz default now() + interval '15 days'
  )
  ```
  + GRANT'ler + RLS: kullanıcı sadece kendi kayıtlarını görüp silebilir.
- Otomatik silme: `pg_cron` (Lovable Cloud'da mevcut) ile günlük çalışan job: `DELETE FROM analysis_reports WHERE expires_at < now();`. Ayrıca `SELECT` sorguları da RLS içinde `expires_at > now()` filtresi ekleyecek (garantili).
- `analysisHistory.ts` `supabase` ile konuşacak şekilde yeniden yazılacak: `saveAnalysisHistoryItem`, `getAnalysisHistory`, `removeAnalysisHistoryItem` async fonksiyonlar olacak.
- `Analysis.tsx` PDF üretiminden bağımsız olarak analiz tamamlanır tamamlanmaz kaydı DB'ye ekleyecek (mevcut mantık PDF indirilene kadar bekliyordu — kullanıcı PDF indirmese bile geçmiş kaydedilmeli).
- `Profile.tsx` geçmiş bölümü:
  - Liste `useQuery` ile Supabase'ten gelecek.
  - Her kayda tıklanınca yeni bir `HistoryDetail` modal/rota açılacak → `AnalysisReportContent` ile tam rapor görüntülenir + "PDF indir" butonu.
  - "Bu raporlar 15 gün boyunca saklanır, sonra otomatik silinir." bilgi metni.
- Eski `localStorage`'daki geçmiş temizlenecek (bir defalık migration script/effect).

## 6. E-posta ile kayıtta doğrulama linki istenmesin
- `supabase.configure_auth` ile `auto_confirm_email: true` yapılacak.
- `Auth.tsx`'te e-posta ile signup sonrası "Onay maili gönderildi" akışı yerine direkt oturum açıp `/`'a yönlendirilecek.
- Google girişi zaten sorunsuz; sadece e-posta akışı sadeleşecek.

## Teknik notlar
- Değişecek dosyalar: `src/pages/Packages.tsx`, `src/pages/Index.tsx`, `src/pages/Analysis.tsx`, `src/pages/Profile.tsx`, `src/pages/Auth.tsx`, `src/hooks/usePdfDownload.ts`, `src/components/AnalysisReportContent.tsx`, `src/lib/analysisHistory.ts`.
- Yeni asset: `src/assets/ornek-rapor.pdf.asset.json`.
- Yeni migration: `analysis_reports` tablosu + pg_cron job + ücretsiz kredi veren fonksiyonların temizlenmesi.
- Auth ayarı: `auto_confirm_email = true`.
- Stripe secret & webhook zaten kurulu — değişiklik yok.
