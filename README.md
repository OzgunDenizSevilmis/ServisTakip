# ServisTakip

Servis operasyonlarını, servis kayıtlarını ve parça envanterini takip etmek için
React Native ve Expo tabanlı mobil uygulama iskeleti.

## Gereksinimler

- Node.js LTS
- npm
- Android Studio ve çalışan bir Android emülatörü (Android geliştirme için)

## Kurulum

```bash
npm install
Copy-Item .env.example .env
```

`.env` dosyasındaki Supabase değerlerini kendi projenizin değerleriyle doldurun.
Gerçek anahtarları kaynak koduna veya `.env.example` dosyasına eklemeyin.

## Çalıştırma

```bash
npm start
npm run android
```

Expo geliştirici menüsünden Android emülatörü seçilebilir. Uygulama başlangıçta
geçici giriş ekranını gösterir; "Geçici olarak devam et" seçeneği placeholder
tab ekranlarına yönlendirir.

## Kontroller

```bash
npm run typecheck
npm run lint
npm run format:check
```

Supabase istemcisi [src/services/supabase/client.ts](./src/services/supabase/client.ts) içinde tek
bir noktadan yapılandırılmıştır. İlk veritabanı şeması ve RLS politikaları
[supabase/migrations/20261102100000_initial_schema.sql](./supabase/migrations/20261102100000_initial_schema.sql)
dosyasında tanımlıdır. Ticket, kategori, parça, stok ve attachment iş akışı
RPC fonksiyonları da aynı migration içinde tanımlıdır.

Attachment akışında istemci önce private Storage bucket'a yükleme yapmalı,
ardından `add_ticket_attachment` RPC'sini çağırmalıdır. RPC başarısız olursa
istemci yüklediği nesneyi silmelidir. Ağ kesintileriyle kalan sahipsiz
nesneler için service-role anahtarı mobil uygulamaya konulmadan, güvenilir bir
Edge Function veya zamanlanmış server-side job ile `ticket_attachments`
kayıtlarıyla eşleşmeyen nesneler periyodik olarak temizlenmelidir.
