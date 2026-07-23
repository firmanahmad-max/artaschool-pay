# Menyiapkan Gateway WhatsApp (Fonnte)

Panduan mendapatkan dan memasang kredensial gateway WhatsApp. Setelah ini,
notifikasi (pembayaran disetujui/ditolak, pengumuman, digest, dan **OTP login
orang tua**) benar-benar terkirim — bukan hanya masuk log dry-run.

> Aplikasi memakai **Fonnte**. Kode gateway sudah mengikuti API Fonnte persis
> (`modules/notifications/gateway.ts`). Provider lain (mis. Wablas) bentuk
> API-nya berbeda dan perlu penyesuaian kode.

---

## Kenapa nomor khusus, bukan nomor pribadi

Gateway mengirim banyak pesan atas nama sekolah. Bila memakai nomor pribadi
staf, nomor itu berisiko diblokir WhatsApp dan mengganggu komunikasi pribadi.
Siapkan **satu nomor khusus** (kartu SIM baru / nomor sekolah), idealnya plus
**satu nomor cadangan** — pemblokiran adalah risiko nyata (PRD §10).

---

## Langkah

### 1. Daftar Fonnte
1. Buka https://fonnte.com lalu daftar.
2. Isi saldo/paket sesuai perkiraan volume. Kasar: (jumlah wali) × (notifikasi
   per bulan) + OTP login. Untuk sekolah pilot kecil, paket termurah cukup.

### 2. Sambungkan nomor WhatsApp ("Device")
1. Dashboard → **Device** → **Add Device**.
2. Buka WhatsApp di ponsel bernomor khusus tadi → **Perangkat Tertaut** →
   **Tautkan Perangkat** → pindai QR yang muncul di Fonnte.
3. Pastikan status device menjadi **connected**.

> Ponsel ini harus tetap menyala & online. Untuk produksi, gunakan ponsel yang
> memang didedikasikan (bukan yang dibawa pulang staf).

### 3. Salin token
- Dashboard → **Device** → salin **Token** milik device tersebut.
- Ini nilai untuk `WA_GATEWAY_TOKEN`. Token per-device, bukan token akun.

### 4. Isi environment variable

Di `.env.local` (pengembangan) atau dashboard Vercel (produksi):

```
WA_GATEWAY_URL=https://api.fonnte.com/send
WA_GATEWAY_TOKEN=<token dari langkah 3>
```

### 5. Uji sebelum dipakai sungguhan

Kirim satu pesan uji ke nomor Anda sendiri:

```bash
node scripts/cek-wa-gateway.mjs "+62812xxxxxxxx"
```

- **✓ BERHASIL** + pesan tiba di ponsel → kredensial siap.
- **✗ DITOLAK** → skrip menyebut alasannya dan cara memperbaiki
  (token salah, device terputus, kuota habis, format nomor).

---

## Menyambungkan OTP login orang tua

Notifikasi (approve/tolak/pengumuman/digest) langsung jalan setelah langkah di
atas. Tetapi **OTP login orang tua** melewati Supabase Auth, jadi ada satu
sambungan tambahan — lihat `docs/CHECKLIST-GO-LIVE.md` §3:

1. Supabase → Authentication → Hooks → aktifkan **Send SMS** hook →
   arahkan ke `https://APLIKASI/api/hooks/send-sms`.
2. Salin secret hook (format `v1,whsec_…`) ke `SEND_SMS_HOOK_SECRET`.
3. Hook meneruskan OTP ke gateway yang sama. Tanpa `WA_GATEWAY_*`, OTP hanya
   masuk log dry-run dan **orang tua tidak bisa login**.

---

## Bila pesan tidak sampai

| Gejala | Kemungkinan sebab |
|---|---|
| Skrip uji ✗ "token invalid" | Token salah / bukan token device. Salin ulang. |
| Skrip uji ✗ "device disconnect" | Ponsel gateway offline / WhatsApp keluar. Scan ulang QR. |
| Skrip uji ✓ tapi pesan tak tiba | Nomor tujuan salah format, atau diblokir. Coba nomor lain. |
| Notifikasi macet di antrean | Cek monitor `/admin/pengumuman`. "Gagal permanen" = alasan ada di kolom galat. |
| Semua "Gagal permanen" mendadak | Nomor gateway kemungkinan diblokir WhatsApp. Alihkan ke nomor cadangan. |

Antrean punya retry + dead-letter otomatis, jadi gangguan sesaat akan dicoba
ulang. Yang "Gagal permanen" perlu tindakan manusia.

---

## Catatan teknis (untuk yang memelihara)

- Fonnte **selalu membalas HTTP 200**, bahkan saat gagal — sukses/gagal ada di
  field `status` pada body. Kode gateway sudah membaca `status`, bukan sekadar
  kode HTTP (`modules/notifications/fonnte-parse.ts`, diuji `npm run test:gateway`).
- Body dikirim sebagai form (`x-www-form-urlencoded`), bukan JSON.
- Worker pengirim: `POST /api/jobs/notifications` (cron Vercel tiap 5 menit),
  dengan throttle 250 ms/pesan agar nomor tidak dianggap spam.
