# Checklist Go-Live — Pengelola Sistem

Harus selesai **sebelum** sekolah pilot mulai [UAT](./UAT-SEKOLAH-PILOT.md).

---

## 1. Supabase (produksi)

- [ ] Buat project Supabase baru (region terdekat, mis. Singapore)
- [ ] Jalankan seluruh migration: `supabase db push`
- [ ] **Jangan** jalankan `supabase/seed.sql` di produksi — itu data demo
- [ ] Buat bucket `payment-proofs` bila migration tidak membuatnya (privat!)
- [ ] Aktifkan **PITR** (Point-in-Time Recovery) 7 hari
- [ ] Aktifkan **TOTP MFA**: Authentication → Providers → MFA → TOTP `enabled`
- [ ] Catat `NEXT_PUBLIC_SUPABASE_URL`, anon key, service role key

## 2. WhatsApp — pilih mode

**Mode manual (tanpa gateway — bisa langsung go-live):** otomatis aktif di
produksi bila `WA_GATEWAY_URL`/`TOKEN` kosong (atau paksa `WA_MODE=manual`).
Pesan menunggu di **Kotak Keluar WA** untuk dikirim admin lewat WhatsApp
sekolah; pengumuman massal lewat Daftar Siaran. Lihat Panduan Admin §6.

- [ ] Tetapkan **satu nomor WhatsApp sekolah** (boleh nomor TU yang sudah ada)
      untuk mengirim dari Kotak Keluar
- [ ] Tentukan siapa & kapan memeriksa Kotak Keluar (mis. pukul 10.00 & 15.00)
- [ ] Impor kontak wali (.vcf) ke ponsel tsb → buat Daftar Siaran per kelas

**Mode gateway (otomatis — WAHA, self-hosted):** setelah ada nomor khusus.
Panduan lengkap: `docs/SETUP-GATEWAY-WA.md`.

- [ ] Jalankan server WAHA (Docker) di belakang domain + HTTPS
- [ ] Set `WAHA_API_KEY` (kunci rahasia panjang) + volume persisten sesi
- [ ] Start sesi `default` → scan QR dengan **nomor khusus** (bukan pribadi)
- [ ] Siapkan 1 nomor cadangan (risiko pemblokiran — PRD §10)
- [ ] Isi `WA_GATEWAY_URL` (URL WAHA), `WA_GATEWAY_TOKEN` (=`WAHA_API_KEY`),
      opsional `WA_SESSION`
- [ ] `node scripts/cek-wa-gateway.mjs "+62…"` → status sesi WORKING + pesan tiba

> Tanpa kredensial ini, produksi otomatis berjalan dalam **mode manual**
> (bukan dry-run): tidak ada pesan yang diam-diam dianggap terkirim.

## 3. Login orang tua

**Utama — kode aktivasi + PIN (tidak butuh gateway WA):**

- [ ] Supabase → Authentication → Providers → **Phone harus aktif** (dipakai
      login nomor HP + PIN). Supabase mensyaratkan pengirim SMS — arahkan ke
      hook `send_sms` di bawah walau gateway belum ada.
- [ ] Isi `APP_URL` (URL publik aplikasi) — dipakai pada tautan aktivasi di
      pesan WA ke wali
- [ ] Terbitkan kode aktivasi untuk setiap wali: Siswa & Kelas → buka siswa →
      **Kode aktivasi** → **Kirim via WhatsApp** (lihat Panduan Admin)
- [ ] Uji: aktivasi 1 wali → masuk dengan nomor HP + PIN → ubah PIN di Akun

**Opsional — OTP WhatsApp (hanya bila gateway §2 sudah jalan):**

- [ ] Aktifkan auth hook `send_sms` di Supabase → arahkan ke
      `https://APLIKASI/api/hooks/send-sms` (endpoint sudah ada)
- [ ] Buat secret hook di Supabase (format `v1,whsec_<base64>`), salin ke
      env `SEND_SMS_HOOK_SECRET` aplikasi — endpoint memverifikasi tanda tangan
      Standard Webhooks dan menolak yang tidak sah
- [ ] Pastikan `WA_GATEWAY_URL`/`TOKEN` terisi (hook meneruskan OTP ke gateway).
      Tanpa gateway, opsi "Masuk dengan kode WhatsApp" otomatis disembunyikan
      dan wali memakai PIN
- [ ] Supabase → Authentication → Providers → Phone → **SMS OTP Expiry = 300**
      (default hanya **60 detik** — terlalu singkat bagi wali yang membaca WA
      agak lambat), lalu isi env `SMS_OTP_EXPIRY_SECONDS=300` dengan nilai
      yang SAMA agar teks pesan OTP menyebut durasi yang benar
- [ ] Uji OTP ke minimal 3 nomor berbeda operator (Telkomsel/XL/Indosat)
- [ ] Pastikan kode masuk < 1 menit

## 4. Deploy aplikasi (Vercel)

- [ ] Import repo, deploy
- [ ] Isi seluruh environment variable (lihat `.env.local.example`)
- [ ] `CRON_SECRET` — acak panjang, **bukan** nilai contoh
- [ ] Pastikan dua cron aktif: notifikasi (tiap 5 menit) & digest (18.00 WITA)
- [ ] Uji manual worker:
      `curl -X POST -H "x-cron-secret: ..." https://APLIKASI/api/jobs/notifications`
- [ ] Pasang domain khusus + HTTPS

## 5. Data sekolah

- [ ] Buat sekolah + rekening bank di tabel `schools`
- [ ] Buat akun admin: 1 super admin, 1 admin keuangan, 1 operator, 1 kepala sekolah
- [ ] Isi `phone` + `daily_digest = true` untuk kepala sekolah
- [ ] **Setiap admin wajib mengaktifkan 2FA** saat login pertama
      (super admin & admin keuangan diblokir sampai aktif)

## 5b. Monitoring (Sentry)

- [ ] Buat project Sentry, salin DSN
- [ ] Isi `SENTRY_DSN` (server) & `NEXT_PUBLIC_SENTRY_DSN` (browser)
- [ ] Opsional untuk stack trace terbaca: `SENTRY_ORG`, `SENTRY_PROJECT`,
      `SENTRY_AUTH_TOKEN` (source map diunggah lalu dihapus dari bundel)
- [ ] Verifikasi laporan masuk: picu error uji, cek muncul di Sentry
- [ ] **Periksa laporan pertama secara manual**: pastikan tidak ada nomor HP,
      NIS, nama siswa, nominal, atau path bukti yang lolos — penyaring UU PDP
      ada di `lib/sentry-scrub.ts`, jalankan `npm run test:scrub` bila diubah

> Tanpa DSN, Sentry mati total (tidak ada koneksi keluar) dan aplikasi tetap
> berjalan normal — tetapi error produksi menjadi tidak terlihat.

## 6. Verifikasi keamanan

- [ ] `npm run pentest` → **52/52 lulus**
- [ ] `npm run backup:drill` → lulus, simpan dump ke storage terenkripsi terpisah
- [ ] Cek header: `curl -I https://APLIKASI` → CSP ber-nonce, HSTS, X-Frame-Options
- [ ] Pastikan bukti transfer **tidak** bisa diakses tanpa signed URL

## 7. Gladi resik

- [ ] `npm run uat` pada lingkungan staging → **18/18 lulus**
- [ ] Coba manual di ponsel sungguhan (Android & iOS): login, unggah, riwayat
- [ ] Uji di jaringan lambat (3G) — orang tua tidak semua ber-WiFi

## 8. Kesiapan pendukung

- [ ] Cetak/bagikan [Panduan Admin](./PANDUAN-ADMIN.md) ke staf
- [ ] Buat video 60 detik cara wali mengirim bukti (PRD §10)
- [ ] Tentukan siapa yang membalas keluhan wali selama UAT
- [ ] Siapkan grup WhatsApp peserta uji coba

---

## Jangan Lupa

- **Proses lama tetap jalan** selama UAT. Baru dimatikan setelah UAT lulus.
- **Jangan** memakai data demo di produksi (`admin@artaschool.local`,
  `SD Contoh Nusantara`, nomor `+62812345670xx`).
- Retensi bukti transfer: **7 tahun** (kebutuhan pembukuan).
