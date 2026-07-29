# Menyiapkan Gateway WhatsApp (WAHA)

Panduan menjalankan dan memasang **WAHA** (WhatsApp HTTP API,
<https://waha.devlike.pro>) sebagai gateway. Setelah ini notifikasi
(pembayaran disetujui/ditolak, pengumuman, digest, dan **OTP login orang tua**)
benar-benar terkirim — bukan hanya masuk log dry-run.

> WAHA di-**hosting sendiri** (Docker), berbeda dari layanan SaaS. Anda
> menjalankan servernya, lalu aplikasi memanggilnya lewat HTTP. Kode gateway
> sudah mengikuti API WAHA persis (`modules/notifications/gateway.ts`).

---

## Kenapa nomor khusus, bukan nomor pribadi

Gateway mengirim banyak pesan atas nama sekolah. Bila memakai nomor pribadi
staf, nomor itu berisiko diblokir WhatsApp dan mengganggu komunikasi pribadi.
Siapkan **satu nomor khusus** (kartu SIM baru / nomor sekolah), idealnya plus
**satu nomor cadangan** — pemblokiran adalah risiko nyata (PRD §10).

---

## Langkah

### 1. Jalankan server WAHA

WAHA berjalan sebagai container Docker. Cara paling sederhana:

```bash
docker run -d --name waha --restart always \
  -p 3000:3000 \
  -e WAHA_API_KEY=GANTI_DENGAN_KUNCI_RAHASIA_PANJANG \
  -e WHATSAPP_DEFAULT_ENGINE=WEBJS \
  devlikeapro/waha
```

- **`WAHA_API_KEY`** = kunci rahasia; ini nilai untuk `WA_GATEWAY_TOKEN` nanti.
  Buat acak & panjang.
- Untuk produksi: taruh di belakang domain + HTTPS (mis. Caddy/Nginx), jangan
  ekspos port 3000 mentah ke internet. Alamat inilah `WA_GATEWAY_URL`.
- Simpan volume agar sesi tidak hilang saat container restart — lihat dok WAHA
  "Persistent storage".

### 2. Buat & sambungkan sesi

WAHA memakai konsep **sesi**. Sesi default bernama `default`.

1. Buka dashboard WAHA: `http://SERVER:3000/dashboard` (login pakai API key).
2. **Start** sesi `default`.
3. Status akan menjadi **SCAN_QR_CODE** → buka WhatsApp di ponsel bernomor
   khusus → **Perangkat Tertaut** → **Tautkan Perangkat** → pindai QR.
4. Status berubah menjadi **WORKING**. Baru pada status ini pesan bisa dikirim.

> Nomor selain `default`? Set `WA_SESSION` ke nama sesi tersebut.

### 3. Isi environment variable

Di `.env.local` (pengembangan) atau dashboard Vercel (produksi):

```
WA_GATEWAY_URL=https://waha.sekolah-anda.com   # URL dasar WAHA, tanpa /api
WA_GATEWAY_TOKEN=<WAHA_API_KEY dari langkah 1>
WA_SESSION=default                              # boleh dikosongkan
```

Aplikasi otomatis menambah `/api/sendText` — cukup isi URL dasarnya.

### 4. Uji sebelum dipakai sungguhan

```bash
node scripts/cek-wa-gateway.mjs "+62812xxxxxxxx"
```

Skrip akan:
1. **Cek status sesi** dulu — bila belum `WORKING`, ia memberi tahu persis apa
   yang kurang (scan QR / start sesi / API key salah).
2. Bila `WORKING`, **kirim satu pesan uji** ke nomor tujuan.

- **✓ BERHASIL** + pesan tiba → kredensial siap.
- **✗** → skrip menyebut penyebab & solusinya.

---

## Menyambungkan OTP login orang tua

Notifikasi (approve/tolak/pengumuman/digest) langsung jalan setelah langkah di
atas. Tetapi **OTP login orang tua** melewati Supabase Auth, jadi ada satu
sambungan tambahan — lihat `docs/CHECKLIST-GO-LIVE.md` §3:

1. Supabase → Authentication → Hooks → aktifkan **Send SMS** hook →
   arahkan ke `https://APLIKASI/api/hooks/send-sms`.
2. Salin secret hook (format `v1,whsec_…`) ke `SEND_SMS_HOOK_SECRET`.
3. Hook meneruskan OTP ke WAHA yang sama. Tanpa `WA_GATEWAY_*`, OTP hanya
   masuk log dry-run dan **orang tua tidak bisa login**.

---

## Bila pesan tidak sampai

| Gejala | Kemungkinan sebab |
|---|---|
| Skrip uji ✗ "X-Api-Key ditolak" | Token salah. Samakan dengan `WAHA_API_KEY`. |
| Skrip uji ✗ status "SCAN_QR_CODE" | Sesi belum ditautkan. Scan QR di dashboard WAHA. |
| Skrip uji ✗ status "STOPPED" | Sesi belum di-start. Start di dashboard WAHA. |
| Skrip uji ✗ "Sesi tidak ada" | Nama sesi salah. Cek `WA_SESSION`. |
| Notifikasi macet di antrean | Cek monitor `/admin/pengumuman`. "Gagal permanen" = alasan ada di kolom galat. |
| Tiba-tiba semua HTTP 422 | Sesi keluar dari WORKING (WA logout / ponsel offline). Scan ulang. |

Antrean punya retry + dead-letter otomatis, jadi gangguan sesaat (sesi sempat
reconnect) akan dicoba ulang. "Gagal permanen" perlu tindakan manusia.

---

## Catatan teknis (untuk yang memelihara)

- Endpoint kirim: `POST {WA_GATEWAY_URL}/api/sendText`, header `X-Api-Key`,
  body JSON `{ session, chatId, text }`. Nomor `+62…` → `chatId` `62…@c.us`.
- WAHA memakai **kode HTTP yang benar** (401 api-key, 422 sesi belum WORKING,
  5xx server) — berbeda dari sebagian gateway lain yang selalu 200. Logika
  interpretasi ada di `modules/notifications/waha-parse.ts`, diuji
  `npm run test:gateway`.
- Ponsel gateway harus tetap online agar sesi bertahan WORKING.
- Worker pengirim: `POST /api/jobs/notifications` (cron Vercel tiap 5 menit),
  throttle 250 ms/pesan agar tidak dianggap spam.
