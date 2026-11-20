# ServisTakip

ServisTakip, işletmelerin servis operasyonlarını mobil cihazlardan yönetmesini sağlayan bir uygulamadır. Çalışanlar servis talebi oluşturabilir, teknisyenler kendilerine atanan işleri takip edebilir, yöneticiler ise iş akışını ve yedek parça stoklarını yönetebilir.

Uygulama Expo ve React Native ile geliştirilmiştir. Kimlik doğrulama, veritabanı, dosya depolama ve yetkilendirme için Supabase kullanır.

## Özellikler

- E-posta ve parola ile kayıt olma, oturum açma ve parola yenileme
- Kategori, öncelik, konum ve açıklama bilgileriyle servis kaydı oluşturma
- Servis kayıtlarını listeleme ve ayrıntılarını görüntüleme
- Servis kayıtlarına fotoğraf ekleme
- Teknisyen atama ve servis durumunu yönetme
- Servis kaydı üzerinde mesajlaşma
- Servis geçmişini ve ekli dosyaları görüntüleme
- Kategorileri oluşturma, düzenleme ve etkin veya devre dışı duruma getirme
- Yedek parça kataloğunu ve stok girişlerini yönetme
- Servis kayıtlarında kullanılan parçaları ve kullanım iptallerini takip etme
- Uygulama içi bildirimleri görüntüleme
- Supabase Row Level Security (RLS) ile kullanıcı rolüne ve servis kaydına göre erişim denetimi

## Kullanıcı rolleri

| Rol | Yetkiler |
| --- | --- |
| **Çalışan (employee)** | Servis kaydı oluşturur ve kendi oluşturduğu kayıtları takip eder. |
| **Teknisyen (technician)** | Kendisine atanan servis kayıtlarını yürütür, kayıt üzerinde iletişim kurar ve kullanılan parçaları işler. |
| **Yönetici (manager)** | Servis kayıtlarını yönetir, teknisyen atar, kategorileri ve parça kataloğunu düzenler, stok hareketlerini inceler. |

Yetkilendirme uygulama ekranlarının yanı sıra Supabase veritabanındaki RLS politikaları ve veritabanı fonksiyonlarıyla uygulanır. Kullanıcı rolü ve hesabın etkinlik durumu güvenilir yönetim işlemleriyle belirlenir.

## Teknoloji yığını

- **Mobil uygulama:** React Native 0.88, Expo SDK 58, TypeScript
- **Gezinme:** React Navigation 7
- **Backend:** Supabase Auth, PostgreSQL, Row Level Security, Storage ve RPC fonksiyonları
- **Veri yönetimi:** TanStack Query
- **Formlar ve doğrulama:** React Hook Form ve Zod
- **Cihaz özellikleri:** Expo Image Picker
- **Oturum saklama:** React Native AsyncStorage

## Mimari

Kod, özellik alanlarına göre düzenlenmiştir:

- `src/features/`: kimlik doğrulama, ana sayfa, servis kayıtları, kategoriler, parçalar, profil ve bildirim ekranları
- `src/navigation/`: oturum durumuna göre kimlik doğrulama veya uygulama ekranlarını açan gezinme yapısı
- `src/services/`: Supabase istemcisi ile servis kayıtları, kategoriler, stok ve bildirim işlemleri
- `src/types/`, `src/hooks/`, `src/theme/` ve `src/utils/`: ortak türler ve arayüz yardımcıları
- `supabase/migrations/`: veritabanı şeması, RLS politikaları, tetikleyiciler, RPC fonksiyonları ve ek dosyalar için Storage yapılandırması

Servis, kategori ve stok verilerini değiştiren işlemler veritabanı RPC fonksiyonları üzerinden yürütülür. Mobil uygulama Supabase publishable key kullanır; veri erişim yetkileri RLS politikalarıyla denetlenir.

## Gereksinimler

- Node.js LTS ve npm
- Bir Supabase projesi
- Android geliştirme için Android Studio ve Android emülatörü veya Expo Go destekleyen bir Android cihaz
- iOS simülatöründe yerel geliştirme için macOS ve Xcode

## Kurulum

Depoyu klonlayıp bağımlılıkları yükleyin:

```bash
git clone https://github.com/OzgunDenizSevilmis/ServisTakip.git
cd ServisTakip
npm install
```

Proje kökünde `.env` dosyası oluşturun ve Supabase projenizin API ayarlarında bulunan şu değerleri girin:

- `EXPO_PUBLIC_SUPABASE_URL`: Supabase proje URL'si
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase publishable key

Bu değerleri kaynak koduna veya herkese açık dosyalara eklemeyin. `EXPO_PUBLIC_` ile başlayan değişkenler uygulama paketine dahil edilir. Mobil uygulamada yalnızca publishable key kullanılmalıdır; Supabase service-role key hiçbir zaman uygulamaya veya istemci ortam değişkenlerine eklenmemelidir.

Supabase Dashboard'da **SQL Editor** bölümünü açıp aşağıdaki migration dosyasını çalıştırın:

`supabase/migrations/20261102100000_initial_schema.sql`

Migration; tabloları, RLS politikalarını, veritabanı fonksiyonlarını ve servis ekleri için özel Storage bucket yapılandırmasını oluşturur.

Supabase Auth ayarlarında e-posta ile kimlik doğrulamayı etkinleştirin. Parola yenileme bağlantılarının uygulamaya dönebilmesi için uygulamanın `servistakip://` URL şemasını Supabase Auth yönlendirme adresleri listesine ekleyin.

## Uygulamayı çalıştırma

Expo geliştirme sunucusunu başlatın:

```bash
npm start
```

Ardından Expo geliştirme menüsünden uygulamayı cihazda veya emülatörde açın. Platform kısayolları:

```bash
npm run android
npm run ios
npm run web
```

iOS simülatöründe yerel çalıştırma için macOS ve Xcode gerekir. Android kısayolunu çalıştırmadan önce bir Android emülatörü başlatın.

## Proje kontrolleri

Tür denetimi, lint ve biçim kontrolü için:

```bash
npm run typecheck
npm run lint
npm run format:check
```

## Güvenlik

- `.env` dosyasını Git'e eklemeyin ve gerçek anahtarları dokümantasyonda paylaşmayın.
- Service-role key'i mobil uygulamada veya istemci tarafında kullanmayın.
- Veritabanı değişikliklerinde migration içindeki RLS politikalarını ve rol denetimlerini koruyun.
