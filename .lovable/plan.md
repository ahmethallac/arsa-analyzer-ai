# Admin Paneli ve Yönetim Sistemi

## 1. Veritabanı Değişiklikleri

### Mevcut promo kodlarını temizle
- `promo_code_usages` tablosundaki tüm kayıtlar silinir
- `promo_codes` tablosundaki tüm kayıtlar silinir (TEST2024, TEST2026)

### Rol sistemi (güvenli yaklaşım)
- `app_role` enum: `admin`, `user`
- `user_roles` tablosu (user_id, role) — profillerde saklanmaz (güvenlik)
- `has_role(user_id, role)` security definer fonksiyonu
- `ahmethallaccom@gmail.com` giriş yaptığında otomatik `admin` rolü atansın (trigger)

### Admin fonksiyonları (hepsi SECURITY DEFINER, admin kontrolü ile)
- `admin_list_users()` — tüm kullanıcılar: email, toplam satın alınan kredi, mevcut kredi, rapor sayısı, kayıt tarihi
- `admin_list_reports()` — tüm raporlar: kullanıcı email, başlık, oluşturma tarih/saati
- `admin_grant_credits(user_id, amount, note)` — kullanıcıya kredi ekle
- `admin_delete_user(user_id)` — kullanıcıyı ve tüm verilerini sil
- `admin_create_promo_code(code, credits, is_unlimited)` — yeni kupon
- `admin_list_promo_codes()` — kuponlar + kullanım sayısı
- `admin_delete_promo_code(id)`
- `admin_list_promo_usages(promo_code_id)` — kim, ne zaman kullandı

### Admin için sınırsız kredi
- `deduct_credit_for_user_device` fonksiyonu güncellenir: kullanıcı admin ise kredi düşülmez, işlem başarılı sayılır
- Rapor kaydetme normal çalışmaya devam eder (geçmişte görünsün)

## 2. Kimlik Doğrulama (OTP)

- Admin `/admin` sayfasına gider, mail girer
- `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })` — 6 haneli kod maile gönderilir
- Kod ekranı çıkar, kullanıcı 6 haneyi girer
- `supabase.auth.verifyOtp({ email, token, type: 'email' })` ile doğrulama
- Session cihazda kalır (mevcut `persistSession: true` ayarı sayesinde otomatik "cihazı tanır")
- Sadece `has_role(uid, 'admin')` true dönerse panel gösterilir; değilse "Yetkisiz" ekranı

Not: Supabase Auth ayarlarında OTP email template aktif olmalı (Cloud'da varsayılan olarak aktif). Ayrıca `ahmethallaccom@gmail.com` ilk kez giriş yapmadan önce sistemde kayıtlı olması gerekir — trigger yeni user oluşturduğunda otomatik admin rolü verecek, dolayısıyla ilk OTP girişinde `shouldCreateUser: true` kullanılır (sadece admin whitelist için).

## 3. Admin Panel Arayüzü

Yeni sayfa: `src/pages/Admin.tsx`, route `/admin`

Sekmeler (Tabs):

**Kullanıcılar sekmesi**
- Tablo: Email · Toplam Satın Alınan Kredi · Mevcut Kredi · Rapor Sayısı · Kayıt Tarihi · İşlemler
- Her satırda: "Kredi Ekle" (miktar girişli dialog) ve "Hesabı Sil" (onay dialog)

**Raporlar sekmesi**
- Tablo: Email · Rapor Başlığı · Tarih/Saat
- Sıralama: en yeni üstte

**Kuponlar sekmesi**
- Yeni kupon oluşturma formu: Kod · Kredi miktarı · Sınırsız mı (checkbox)
- Aktif kuponlar tablosu: Kod · Kredi · Kullanım sayısı · İşlemler (Detay, Sil)
- Detay dialog: kim ne zaman kullandı listesi

## 4. Kupon Kullanımında Üyelik Zorunluluğu

`apply_promo_code` fonksiyonu zaten `auth.uid()` kontrolü yapıyor — değişiklik gerekmez. Profil sayfasındaki kupon giriş alanı da zaten üye olmayanları `/auth` sayfasına yönlendiriyor.

## 5. Yönlendirme

- `arsaanaliz.app/admin` → `Admin.tsx`
- Giriş yapılmamışsa email + OTP kod girişi ekranı
- Giriş yapılmış ama admin değilse "Bu sayfaya erişim yetkiniz yok"
- Admin ise panel gösterilir

---

## Teknik Detaylar

**Yeni dosyalar:**
- `src/pages/Admin.tsx` — panel UI

**Düzenlenecek dosyalar:**
- `src/App.tsx` — `/admin` route eklenir
- Migration dosyası — rol tablosu, admin RPC fonksiyonları, admin sınırsız kredi mantığı, promo temizliği

**Güvenlik:**
- Tüm admin RPC'leri başında `IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'unauthorized'` kontrolü
- Client-side admin kontrolü sadece UI için; gerçek güvenlik server-side RPC'de
- `user_roles` tablosu RLS aktif, sadece admin okuyabilir

**Onay bekleniyor:** Bu plan tamam mı? Onaylarsan migration + Admin.tsx + route eklemesini yapayım.
