# Üyelik Sistemi Ekleme Planı

## Mevcut Durum

- Uygulama tamamen anonim, cihaz bazlı (device_id) çalışıyor
- Yeni cihazlara otomatik 1 ücretsiz kredi veriliyor. tek sorgu hakkı
- Hiçbir yerde giriş/üyelik yok

## Hedef

- 1 sorgu Analizi yapmak için üyelik GEREKMEYECEK (eskisi gibi anonim, cihaz bazlı kalacak)
- 1 adet ücretsiz sorgu hakkı bitince kredi alması gerekecek
- Kredi satın almak veya promosyon kodu girmek için üyelik ZORUNLU olacak
- Giriş seçenekleri: Google, eposta
- şifre olmayacak sadece mail adresine gelen kod ile giriş yapılacak. 
- Bir kere giriş yapılmış bir cihazı tanısın ve çıkış yapmasın. sadece kendi isteğiyle çıkış yapabilir
- hesabını isterse silme bölümü olsun. profil kısmında en altta kırmızı ve küçük yazsın. 

## Yapılacaklar

### 1. Backend (Lovable Cloud / Auth)

- Email/şifre auth açık olacak (signup otomatik onay KAPALI – kullanıcı doğrulamalı)
- Google OAuth açılacak (Lovable Cloud yönetimli)
- `profiles` tablosuna isteğe bağlı `user_id` (auth.users referansı) kolonu eklenecek
- Cihaz profili ile auth kullanıcısı eşleştirme fonksiyonu: `link_device_to_user(device_id, user_id)` – giriş yapan kullanıcının device profilini hesabına bağlar, krediler birleşir
- `apply_promo_code` ve satın alma akışı `user_id` gerektirecek şekilde güncellenecek (RPC seviyesinde doğrulama)

### 2. Frontend

**Yeni sayfa: `/auth**`

- Tabs: Google ile giriş, E-posta
- E-posta: signup + login formları, 
- Başarılı girişte device_id otomatik olarak hesaba bağlanır, kullanıcı geldiği sayfaya döner

&nbsp;

`**useDevice` hook genişletme → `useAuth` eklenecek**

- `session`, `user` state
- `onAuthStateChange` listener
- Giriş yapıldığında device profilini user'a bağlama

**Profile sayfası güncellemesi**

- Eğer giriş yapılmışsa: e-posta/telefon/Google ismi göster, "Çıkış yap" butonu
- Giriş yapılmamışsa: "Giriş Yap" butonu (kredi satın al ve promosyon kodu bölümlerinin üstünde uyarı)
- "Kredi Satın Al" butonu: giriş yoksa `/auth?redirect=/packages` yönlendir
- Promosyon kodu uygula: giriş yoksa "Önce giriş yapın" uyarısı ve `/auth` butonu

**Packages sayfası güncellemesi**

- Sayfa açılırken auth kontrolü; giriş yoksa `/auth?redirect=/packages` yönlendir

**Index (analiz) sayfası**

- Değişmez – anonim kullanım devam eder

### 3. Güvenlik

- `apply_promo_code` RPC'si artık `auth.uid()` zorunlu kılacak (device_id yerine veya yanında)
- Satın alma edge fonksiyonu `auth.uid()` doğrulayacak
- RLS politikaları auth.uid bazlı eklenecek