import { useEffect } from 'react';

export default function PrivacyPolicy() {
  useEffect(() => {
    document.title = 'Gizlilik Politikasi - Arsa Analizi';
  }, []);

  return (
    <main className="min-h-[100dvh] bg-background px-5 py-8 text-foreground sm:px-8">
      <article className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2 border-b border-border pb-5">
          <h1 className="text-3xl font-bold tracking-tight">Gizlilik Politikası</h1>
          <p className="text-xl font-semibold">Arsa Analizi Gizlilik Politikası</p>
          <p className="text-sm text-muted-foreground">Son güncelleme: 15 Haziran 2026</p>
        </header>

        <section className="space-y-3">
          <p>Bu uygulama kullanıcıdan doğrudan kişisel veri toplamaz.</p>
          <p>
            Uygulama yalnızca kullanıcı tarafından girilen bilgileri, kullanıcının talep ettiği analiz işlemini
            gerçekleştirmek için kullanır.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Toplanan veriler</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>Kullanıcı tarafından girilen metinler, arsa bilgileri</li>
            <li>Kullanıcının yüklediği görseller</li>
            <li>Kullanıcının hesap ve kredi işlemleri için gerekli oturum bilgileri</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Bu veriler</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>Üçüncü taraflarla satılmaz veya pazarlama amacıyla paylaşılmaz</li>
            <li>Pazarlama amacıyla kullanılmaz</li>
            <li>Yalnızca analiz, hesap, kredi ve ödeme işlemlerini gerçekleştirmek için kullanılır</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Ödeme işlemleri</h2>
          <p>
            Uygulama içi satın alma işlemleri kullanılan platforma göre App Store veya Google Play tarafından
            gerçekleştirilir. Uygulama kredi tanımlama amacıyla satın alma durumunu doğrular, ancak ödeme kartı
            bilgilerini toplamaz veya saklamaz.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">İletişim</h2>
          <p>
            E-posta:{' '}
            <a className="font-medium text-primary underline-offset-4 hover:underline" href="mailto:info@ahmethallac.com">
              info@ahmethallac.com
            </a>
          </p>
        </section>
      </article>
    </main>
  );
}
