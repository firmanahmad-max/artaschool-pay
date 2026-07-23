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

## 2. Gateway WhatsApp

- [ ] Daftar Fonnte/Wablas, sambungkan nomor WhatsApp sekolah
- [ ] **Gunakan nomor khusus**, bukan nomor pribadi staf
- [ ] Siapkan 1 nomor cadangan (risiko pemblokiran — PRD §10)
- [ ] Isi `WA_GATEWAY_URL` & `WA_GATEWAY_TOKEN`
- [ ] Uji kirim satu pesan ke nomor sendiri

> Tanpa kredensial ini sistem tetap jalan, tetapi notifikasi hanya masuk
> antrean dan **tidak benar-benar terkirim** (mode dry-run).

## 3. OTP login orang tua

- [ ] Aktifkan auth hook `send_sms` di Supabase → arahkan ke
      `https://APLIKASI/api/hooks/send-sms` (endpoint sudah ada)
- [ ] Buat secret hook di Supabase (format `v1,whsec_<base64>`), salin ke
      env `SEND_SMS_HOOK_SECRET` aplikasi — endpoint memverifikasi tanda tangan
      Standard Webhooks dan menolak yang tidak sah
- [ ] Pastikan `WA_GATEWAY_URL`/`TOKEN` terisi (hook meneruskan OTP ke gateway;
      tanpa itu OTP hanya masuk log dry-run dan **orang tua tak bisa login**)
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

## 6. Verifikasi keamanan

- [ ] `npm run pentest` → **21/21 lulus**
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
