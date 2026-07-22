# ArtaSchool Pay — CONTEXT.md (Dev Handoff)
Acuan untuk development lokal (Claude Code / manual). Sumber kebenaran produk: `ArtaSchoolPay_PRD_v1.md`. Keputusan K1–K5 pada PRD §2.3 sudah **disetujui** (18 Jul 2026).

## Status Saat Ini
- ✅ PRD & blueprint teknis final (v1.0)
- ✅ Migration `001_init_schema.sql` — **tervalidasi di PostgreSQL 16** (18 Jul 2026, direkonstruksi ulang dari PRD karena file lama hilang): schema, trigger sinkronisasi `bills.amount_paid` (alokasi **dan** perubahan status payment), RPC (`generate_bills`, `approve_payment`, `review_payment`), RLS lengkap, seed (`supabase/seed.sql`) + smoke test lolos
- ✅ Sprint 1: scaffold Next.js + design system + CI (18 Jul 2026) — lint, typecheck, build hijau
- ✅ Sprint 2: auth (19 Jul 2026) — teruji end-to-end di Supabase lokal:
  - OTP orang tua: `/login` 2 langkah; Server Action menolak nomor yang tidak ada di `guardians` SEBELUM kirim OTP; migration `002_claim_guardian.sql` menautkan login pertama ke baris wali (+ audit log)
  - Login admin `/admin/login` (email+sandi, cek baris `admin_users` aktif); logout kedua area
  - Guard: `middleware.ts` (session) + `requireGuardian`/`requireAdmin` di layout (role); admin nyasar ke area orang tua dilempar ke `/admin`
  - Dev lokal: `supabase start` → `db reset` → `npm run typegen` → `npm run seed:admin` (admin@artaschool.local / admin-dev-12345); OTP uji `123456` utk nomor seed (config.toml `[auth.sms.test_otp]`, kredensial twilio dummy lokal)
  - Produksi nanti: kirim OTP via WA gateway (Fonnte) memakai auth hook `send_sms` — dijadwalkan Sprint 8; 2FA TOTP admin menyusul (PRD §6.1)
- ✅ Sprint 3: master data (19 Jul 2026) — teruji end-to-end di Supabase lokal:
  - Tahun ajaran: list + tambah; aktivasi atomik via RPC `activate_academic_year` (hanya 1 aktif/sekolah)
  - Kelas: tambah (auto ke tahun ajaran aktif) + hapus hanya bila 0 siswa
  - Siswa: CRUD + aktif/nonaktif; pindah kelas menukar enrollment tahun aktif (tidak menduplikasi); wali find-or-create by phone (many-to-many, tidak duplikat)
  - Import Excel (SheetJS): validasi baris-per-baris, baris valid tetap masuk, baris gagal dilaporkan + unduh CSV error; template & export via route handler `/admin/siswa/template` & `/export`
  - Audit: Server Action tidak insert `audit_logs` langsung — lewat RPC `log_audit` (migration `003_masterdata_helpers.sql`)
  - Verifikasi nyata: tambah siswa manual, import (2 masuk / 3 error: NIS duplikat, kelas tak ada, NIS kosong), pindah kelas, tautkan wali existing (reuse, 3 anak)
- ✅ Sprint 4: modul tagihan (19 Jul 2026) — teruji end-to-end di Supabase lokal:
  - Jenis pembayaran: CRUD + aktif/nonaktif (SPP recurring, Daftar Ulang, dll.)
  - Generate massal via RPC `generate_bills` (idempotent per siswa/jenis/periode — diuji: 2× generate SPP Agt tidak duplikat); periode wajib utk jenis recurring (Zod refine)
  - Tagihan individual (insert langsung + `log_audit`)
  - Pembebasan: RPC `waive_bill`/`unwaive_bill` (migration `004_billing_helpers.sql`) — catatan wajib, tolak bila sudah ada pembayaran, audit `bill.waived`; tagihan waived dikecualikan dari tunggakan
  - Tunggakan per kelas (agregasi bills unpaid/partial tahun aktif) + filter daftar (status/kelas/jenis via searchParams)
  - Uang: `rupiahSchema` integer non-negatif (Konvensi #2)
- ✅ Sprint 5: PWA orang tua (19 Jul 2026) — teruji end-to-end di Supabase lokal:
  - Beranda: kartu per anak (kelas, total tagihan berjalan, daftar tagihan unpaid/partial — waived otomatis tak tampil, status pembayaran terakhir) + pengumuman terbaru
  - Upload (`modules/payments`): pilih anak (pre-select via `?anak=`) → multi-select tagihan → nominal auto-fill & terjumlah (bisa diedit) → bank tujuan dari `schools.bank_accounts` → bukti foto/PDF; NIS/kelas tidak pernah diketik manual (PRD §7.1)
  - Kompresi gambar client-side (`lib/image.ts`: canvas → JPEG q0.8, sisi max 1600, re-encode sekaligus membuang EXIF)
  - Server Action `submitPayment`: validasi magic-bytes (JPEG/PNG/WebP/PDF, max 5 MB), sha256, upload service-role ke bucket privat `payment-proofs` (path `{school_id}/{student_id}/{payment_id}.{ext}`), lalu RPC `submit_payment` (migration `005_payment_submit.sql`) — validasi kepemilikan anak+tagihan, simpan `requested_bill_ids` (usulan; alokasi final tetap oleh admin saat approve), audit `payment.submitted`; berkas di-rollback bila insert gagal
  - Bucket dibuat otomatis oleh migration 005 (DO block, dilewati di CI polos); akses publik terbukti ditolak (400); `getProofSignedUrl` = signed URL 5 menit setelah cek otorisasi
  - Migration `006_parent_read_classes.sql`: fix RLS — orang tua kini boleh SELECT classes & academic_years (sebelumnya nama kelas ke-null di PWA)
  - Verifikasi nyata: login OTP wali → upload SPP+Daftar Ulang Rp 850.000 (pending, sha256 valid, 2 bill ids, audit, 1 objek storage) → berkas teks menyamar .jpg DITOLAK magic-bytes tanpa efek samping DB/storage
- ✅ Sprint 6: antrean verifikasi + alokasi (19 Jul 2026) — teruji end-to-end di Supabase lokal:
  - Antrean (`modules/verification`): tabel ter-filter (status default pending + cari nama), baris → panel detail `/admin/verifikasi/[id]`
  - Panel detail: bukti via signed URL 5 menit (gambar backdrop putih, PDF buka tab baru, tanpa-bukti anggun), detail kiriman, riwayat 5 pembayaran terakhir siswa di sisi kanan (PRD §7.2)
  - Alokasi: `proposeAllocations` — tagihan pilihan ortu (`requested_bill_ids`) dulu, lalu tertua; admin bisa edit; tombol Setujui terkunci sampai total = nominal (RPC juga menegakkan)
  - Aksi Terima/Tolak/Revisi + shortcut keyboard A/R/V (window listener, abai saat mengetik)
  - Verifikasi nyata: approve Rp 850.000 → payment approved, 2 alokasi, kedua bills `paid` via trigger, audit; reject → catatan wajib tersimpan + audit `payment.rejected`
- ✅ Sprint 7: riwayat & alur "Perlu Revisi" (19 Jul 2026) — teruji end-to-end di Supabase lokal:
  - Riwayat orang tua: filter chip status; item Perlu Revisi menampilkan catatan admin + tombol Kirim Ulang; item Ditolak menampilkan alasan; RLS membatasi ke anak sendiri
  - Detail `/riwayat/[id]`: timeline status (dikirim → hasil review), alokasi tagihan (bila approved), bukti via signed URL, badge "Kiriman ulang" utk revisi
  - Kirim Ulang: `/upload?revisi=<id>` → form pre-filled (anak, tagihan tercentang, nominal, pengirim) dari kiriman lama berstatus needs_revision
  - Migration `007_resubmit.sql`: `submit_payment` + `p_revision_of` (validasi: menunjuk payment needs_revision siswa yang sama); audit `payment.resubmitted`
  - Verifikasi nyata siklus penuh 2 role: upload Rp 300rb → admin minta revisi (shortcut V + catatan) → riwayat wali menampilkan catatan → Kirim Ulang pre-filled → koreksi Rp 350rb + bukti baru → payment baru pending dgn `revision_of` terisi, payment lama tetap needs_revision
- ✅ Sprint 8: notifikasi WA + pengumuman (19 Jul 2026) — teruji end-to-end di Supabase lokal:
  - Antrean `notification_jobs` (migration `008_notifications.sql`): status queued/sending/sent/failed/dead, attempts, backoff eksponensial, dead-letter; `claim_notification_jobs` pakai FOR UPDATE SKIP LOCKED (aman paralel)
  - Enqueue otomatis di RPC: `approve_payment` → 'payment.approved'; `review_payment` → 'payment.rejected'/'payment.needs_revision' (memuat catatan admin). Helper `format_rupiah` untuk isi pesan
  - Worker `POST /api/jobs/notifications` — dilindungi header `x-cron-secret` (env `CRON_SECRET`), throttle 250ms/pesan, batch 20; jadwal Vercel Cron tiap 5 menit (`vercel.json`)
  - Gateway `modules/notifications/gateway.ts` (Fonnte-style). **Tanpa `WA_GATEWAY_URL`/`TOKEN` → mode DRY-RUN** (log saja) sehingga alur bisa diuji tanpa gateway asli
  - Pengumuman: admin CRUD + audiens semua/kelas + broadcast via RPC `broadcast_announcement`; halaman wali menyaring audiens per kelas anak; monitor antrean di halaman admin
  - Verifikasi nyata: approve → 1 job auto-enqueue → worker kirim (dry-run) → status `sent`; worker tolak 401 tanpa/salah secret; siklus retry `queued→sending→failed(backoff)→sending→dead` terbukti; broadcast → 4 job (4 wali) semua terkirim; pengumuman kelas 4A TAMPIL bagi wali 4A dan TERSEMBUNYI bagi wali 1A
- ✅ Sprint 9: dashboard + laporan/export + audit viewer (19 Jul 2026) — teruji end-to-end di Supabase lokal:
  - Dashboard (`modules/reports`): 4 kartu (menunggu verifikasi, disetujui bulan ini, tunggakan, siswa aktif) + grafik batang upload 30 hari + donut status + tunggakan per kelas; semua kartu tertaut ke halaman terkait
  - **Grafik pakai SVG/CSS buatan sendiri, BUKAN recharts** — bundle jauh lebih kecil & warna murni dari token tema (PRD §7.4 menyebut recharts; ini penyimpangan sadar, hasil setara)
  - Laporan: jenis Pembayaran & Tunggakan, filter tanggal/kelas/status, ringkasan nominal; export XLSX & CSV (`/admin/laporan/export`, BOM UTF-8 utk Excel), PDF via dialog cetak + `@media print` (sembunyikan nav, paksa latar terang)
  - Audit viewer: filter aksi/tanggal, dibatasi `requireAdmin(['super_admin','kepala_sekolah'])` + RLS `audit_read`
  - Verifikasi nyata: angka dashboard cocok persis dgn query DB (disetujui bulan ini Rp 1.200.000, tunggakan Rp 5.100.000, 6 siswa aktif); filter laporan status/kelas benar; export XLSX (signature PK) & CSV (header+BOM) valid; audit 19 catatan + filter `payment` → 7; **admin_keuangan ditolak dari /admin/audit dan dialihkan ke dashboard**
- ✅ Sprint 10: hardening (19 Jul 2026) — **MVP kode selesai**, teruji di Supabase lokal:
  - Rate limit berbasis DB (migration `009_hardening.sql`, tahan lintas instance serverless): OTP 3/10 menit per nomor, upload 10/jam per wali. RPC `check_rate_limit` **dicabut dari anon/authenticated** — hanya service_role via Server Action (klien tak bisa menghabiskan kuota nomor orang lain)
  - Security headers di `next.config.mjs`: CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, HSTS; `poweredByHeader: false`
  - Storage: bucket tetap privat **tanpa policy apa pun** pada storage.objects → default-deny; satu-satunya jalur baca adalah signed URL 5 menit server-side (lebih ketat dari policy prefix school_id di PRD §6.3)
  - `npm run pentest` (`scripts/pentest.mjs`) — 21 uji memakai SESI WALI SUNGGUHAN (anon key + OTP uji), **21/21 lulus**: isolasi antar-wali, tolak submit/approve anak orang lain, admin_users/audit_logs/notification_jobs tertutup, audit append-only bahkan bagi service_role, bukti transfer tak bisa diunduh/di-signed-URL wali lain, anon nol akses
  - `npm run backup:drill` (`scripts/backup-drill.mjs`) — dump → restore ke DB baru → bandingkan 8 tabel kritis; **LULUS** (peringatan pg_restore hanya objek internal Supabase). Folder `/backups` masuk .gitignore
  - CI diperkuat: guard SQL menolak build bila `payments` punya policy UPDATE, trigger append-only hilang, atau ada tabel sensitif tanpa RLS — **terbukti menangkap regresi** saat RLS sengaja dimatikan
  - Dokumentasi operasional: `docs/PANDUAN-ADMIN.md` (bahasa non-teknis, alur harian, troubleshooting)
  - ⚠️ Utang teknis tercatat: CSP masih perlu `'unsafe-inline'` untuk skrip hidrasi Next.js → pindah ke nonce per-request di v2

## v2 — sedang berjalan
- ✅ Deteksi bukti ganda + pembayaran tunai/QRIS (22 Jul 2026, migration `010_duplicate_and_cash.sql`):
  - `find_duplicate_proof` memakai `proof_sha256` (disimpan sejak Sprint 5) — tanpa AI. `submit_payment` menolak bukti identik yang masih hidup (pending/approved); rantai revisi DIKECUALIKAN agar ortu boleh kirim ulang bukti sama bila hanya nominal yang salah
  - Panel verifikasi menampilkan penanda "Bukti ganda terdeteksi" + tautan silang ke pembayaran kembarannya (kasus nyata: bukti dikirim ulang setelah ditolak)
  - `record_cash_payment` (K5): admin catat tunai/QRIS → langsung approved + alokasi dieksekusi, tanpa antrean verifikasi; form di `/admin/tagihan?tunai=<siswa>`
  - Verifikasi nyata: tunai Rp 550.000 → SPP lunas & Daftar Ulang jadi `partial` (200rb/500rb); kirim bukti identik 2× → ditolak dgn pesan jelas, **tanpa payment/objek storage yatim** (4 payment = 4 hash unik = 4 objek)
- ✅ Wizard naik kelas (22 Jul 2026, migration `011_promotion_wizard.sql`):
  - `preview_promotion` (pratinjau tanpa mengubah apa pun) + `promote_students` (idempotent). Pemetaan otomatis "4A"→"5A" via `class_label_suffix`; kelas tujuan dibuat otomatis bila belum ada
  - Tingkat 6 = LULUS: tidak didaftarkan ke tahun baru, opsional dinonaktifkan (tak dapat tagihan baru, riwayat tetap utuh). Tidak pernah membuat kelas tingkat 7
  - UI `/admin/tahun-ajaran/naik-kelas`: pratinjau per kelas + jumlah siswa + penanda kelas baru, eksekusi terpisah dari aktivasi tahun ajaran
  - Verifikasi nyata: 6 siswa naik (1A→2A, 4A→5A), 2 kelas dibuat, 1 siswa lulus dinonaktifkan; jalankan ulang → 0 duplikat
- ✅ Nonce CSP (22 Jul 2026) — **utang teknis Sprint 10 LUNAS**:
  - `lib/csp.ts` + `middleware.ts`: nonce baru tiap request, `'strict-dynamic'`; `'unsafe-inline'` HILANG dari script-src. CSP pindah dari `next.config.mjs` ke middleware (nonce tak bisa statis)
  - style-src masih `'unsafe-inline'` — Next.js menyuntikkan <style> untuk CSS-in-JS & optimasi font; risikonya jauh lebih rendah
  - Verifikasi nyata: 2 request → 2 nonce berbeda; 13/14 skrip ber-nonce; hidrasi hidup; nol pelanggaran CSP; login admin penuh berhasil di bawah CSP ketat
- ✅ Digest harian kepsek (22 Jul 2026, migration `012_daily_digest.sql`):
  - `admin_users` + kolom `phone` & `daily_digest`; `enqueue_notification_phone` (penerima non-wali); `enqueue_daily_digest` (uang masuk hari ini WITA, antrean, tunggakan)
  - Worker `POST /api/jobs/digest` (x-cron-secret), cron Vercel `0 10 * * 1-6` = 18.00 WITA Sen–Sab. RPC dicabut dari anon/authenticated
  - Verifikasi nyata: 401 tanpa secret; digest terantre & terkirim; ketiga angka cocok dgn query DB
- ✅ 2FA TOTP admin (22 Jul 2026) — `[auth.mfa.totp]` diaktifkan di config.toml:
  - `modules/auth/mfa.ts` (enroll/confirm/verify/unenroll) + `requireAdminBasic` vs `requireAdmin` (yang menegakkan MFA). Halaman gerbang `/admin/2fa` & `/admin/keamanan` sengaja DI LUAR layout admin agar tak loop redirect
  - `super_admin` & `admin_keuangan` WAJIB 2FA sebelum bisa membuka dashboard
  - Verifikasi nyata: dashboard → dialihkan ke Keamanan; QR+secret tampil; kode TOTP asli → 2FA aktif (faktor `verified` di DB + audit); logout→login → gerbang `/admin/2fa` → dashboard
  - 🐞 2 bug nyata tertangkap saat verifikasi: (a) MFA action memakai `requireAdmin` → sirkular (harus punya 2FA untuk mendaftar 2FA); (b) `loginAdmin` tidak memfilter `auth_user_id` → `maybeSingle()` gagal begitu sekolah punya >1 admin. Keduanya diperbaiki
- 🟡 OCR bukti (22 Jul 2026) — **adapter siap, integrasi menunggu kredensial**:
  - `modules/payments/ocr.ts` + `POST /api/ocr/proof`: tanpa `OCR_API_URL`/`OCR_API_KEY` → OCR mati, form manual seperti biasa (pola sama dgn gateway WA)
  - Hasil OCR HANYA saran isian; tidak pernah menimpa yang sudah diketik ortu, dan tidak pernah menggagalkan upload
  - Teruji: parser Rupiah 5/5 (`Rp 1.250.000`, `1,250,000.00`, dst); endpoint ter-guard (303); upload tetap normal saat OCR mati
  - ⚠️ BELUM diuji terhadap layanan Sumopod sungguhan — bentuk respons JSON mungkin perlu disesuaikan saat kredensial tersedia

## Sisa sebelum Go-Live (bukan kode)
- UAT 1 sekolah pilot: 1 siklus SPP penuh tanpa WhatsApp manual (definisi selesai MVP, PRD §9)
- Isi `WA_GATEWAY_URL`/`WA_GATEWAY_TOKEN` (Fonnte/Wablas) — tanpa itu notifikasi jalan mode dry-run
- 2FA TOTP untuk `super_admin` & `admin_keuangan` (PRD §6.1) — dijadwalkan v2
- Aktifkan PITR + jadwal export terenkripsi di Supabase Cloud

## Catatan Dev (penting saat verifikasi browser)
- **JANGAN jalankan `npm run build` saat dev server hidup** — keduanya berbagi `.next` dan saling menimpa, menyebabkan cache korup (`Cannot find module './vendor-chunks/*.js'`, `main-app.js` 404, komponen client tak terhidrasi). Ini akar semua insiden korupsi selama Sprint 4–7. Fix bila terlanjur: stop dev server → `rm -rf .next` → start lagi. Urutan aman: stop dev → build → start dev.

## Stack
Next.js 14 (App Router) · TypeScript · Tailwind + shadcn/ui · TanStack Query · Supabase (Auth, PostgreSQL, Storage, Edge Functions) · Zod · Vercel

## Menjalankan Skema
```bash
npx supabase init && npx supabase start
npx supabase db reset        # menjalankan migrations/ + seed
```
Bucket storage dibuat manual (privat!): `payment-proofs` — lihat komentar §7 di file migration.

## Konvensi Wajib
1. **Mutasi status pembayaran HANYA lewat RPC** (`approve_payment`, `review_payment`) — tidak ada `update payments.status` langsung dari client. RLS memang tidak memberi policy update ke siapa pun.
2. **Uang** = `numeric(12,0)` Rupiah tanpa desimal. Jangan pernah float di TS — pakai integer (satuan rupiah penuh).
3. **File bukti** hanya diakses via signed URL (5 menit) yang digenerate Server Action setelah cek otorisasi. Jangan pernah expose path publik.
4. **Semua Server Action**: validasi Zod → cek role → mutasi → audit log.
5. **Bahasa UI**: id-ID penuh. Label status: pending="Menunggu", approved="Disetujui", rejected="Ditolak", needs_revision="Perlu Revisi".
6. `school_id` wajib ada di setiap query — walau MVP satu sekolah.
7. **Tema**: light/dark via `next-themes` (strategy `class`, default `system`). Komponen HANYA memakai token semantik (`bg-background`, `bg-surface`, `text-foreground`, `bg-primary`, dst) — dilarang hardcode hex/`bg-white`/`text-black`. Nilai token per tema: lihat PRD §7.4. Foto bukti transfer selalu di backdrop netral terang, jangan di-invert.

## Struktur Direktori (target Sprint 1)
```
/app/(parent)/...      /app/(admin)/...      /app/api/webhooks/wa
/modules/{auth,billing,payments,verification,students,announcements,reports,audit,notifications}
/lib/{supabase,design-system,utils}
/supabase/migrations/001_init_schema.sql   ← sudah ada
```

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only: signed URL, notif worker
WA_GATEWAY_URL= WA_GATEWAY_TOKEN= # Fonnte/Wablas
SENTRY_DSN=
```

## Sprint 1 — Checklist (✅ selesai 18 Jul 2026)
- [x] Scaffold Next.js 14.2.35 + TS strict + ESLint + Prettier
- [x] Arta Design System: token semantik dual-theme (CSS variables light/dark, PRD §7.4), radius, shadow → `tailwind.config` (`darkMode: 'class'`)
- [x] `next-themes`: ThemeProvider + `suppressHydrationWarning` di `<html>` + `theme-color` dinamis (`components/theme-color-meta.tsx`)
- [x] Komponen dasar gaya shadcn ditulis manual (Button, Card, StatusBadge, Table) di `components/ui/` — semua pakai token semantik
- [x] Komponen ThemeToggle (Terang/Gelap/Sistem) → header admin & halaman Akun orang tua
- [x] Supabase client (server & browser) di `lib/supabase/` — `lib/supabase/types.ts` masih placeholder; jalankan `npm run typegen` setelah `supabase start`
- [x] Layout `(parent)` mobile-first + bottom nav; layout `(admin)` sidebar
- [x] CI GitHub Actions: lint, typecheck, build + validasi migration & seed di service container `postgres:16` (stub skema auth: `supabase/ci/auth_stub.sql`)
- [x] Halaman placeholder semua route utama

## Jangan Dikerjakan Dulu (scope guard)
OCR, deteksi duplikat AI, payment gateway/VA, multi-sekolah self-service, push notification native. Semua v2/v3 — lihat PRD §9.
