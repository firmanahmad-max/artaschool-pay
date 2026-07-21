# ArtaSchool Pay — PRD & Blueprint Teknis v1.0
**Administrasi Pembayaran Sekolah yang Cepat, Transparan & Modern**
Disusun sebagai elaborasi dari Pre-PRD v0.1 + Prototipe UI/UX | Juli 2026

---

## 1. Ringkasan Eksekutif

ArtaSchool Pay menyelesaikan satu masalah nyata yang sangat spesifik: **verifikasi bukti transfer sekolah yang selama ini berserakan di WhatsApp**. Fokus yang tajam ini adalah kekuatan terbesar produk — jangan dilebarkan sebelum masalah inti terpecahkan sempurna.

Pre-PRD v0.1 sudah solid di sisi *fitur* dan *alur*, tetapi belum siap eksekusi karena ada 5 celah kritis:

1. **Model data belum ada** — tidak ada definisi tagihan (billing). Sistem saat ini hanya mencatat *pembayaran masuk*, bukan *apa yang seharusnya dibayar*. Tanpa konsep tagihan, fitur "validasi nominal", "tunggakan per kelas", dan laporan keuangan tidak mungkin akurat.
2. **State machine status pembayaran ambigu** — ada 6 status tapi transisinya tidak didefinisikan (apa beda "Diverifikasi" dan "Disetujui"? Siapa boleh memindahkan status?).
3. **Keamanan belum dispesifikasikan** — bukti transfer adalah data finansial sensitif. Belum ada spesifikasi RLS, signed URL, validasi file, dan proteksi terhadap penyalahgunaan.
4. **Relasi Orang Tua ↔ Anak belum jelas** — satu orang tua bisa punya banyak anak, satu anak bisa punya dua wali. Ini many-to-many, dan menentukan seluruh desain auth.
5. **Arsitektur multi-tenant (SaaS) harus diputuskan sejak hari pertama** — menambahkan `school_id` belakangan pada sistem yang sudah berjalan adalah migrasi paling menyakitkan yang bisa terjadi. Keputusan: **single-tenant deployment, multi-tenant schema** sejak MVP.

Dokumen ini menutup kelima celah tersebut dan menyusun rencana eksekusi 10 sprint hingga MVP produksi.

---

## 2. Analisis Pre-PRD & Prototipe UI

### 2.1 Yang Sudah Kuat
- Alur 10 langkah orang tua → admin sudah benar dan lengkap.
- Pemisahan modul Orang Tua (mobile-first PWA) vs Admin (desktop dashboard) tepat — terlihat konsisten di prototipe UI.
- Aksi verifikasi 3-arah (Terima / Tolak / Perlu Revisi) dengan catatan wajib adalah desain yang matang — lebih baik dari sekadar approve/reject.
- Roadmap AI ditempatkan di fase lanjut, bukan MVP. Ini disiplin produk yang baik.
- Stack rekomendasi (Next.js + Supabase) **identik dengan ArtaFin** — artinya bisa reuse pola auth, storage, OCR pipeline (Sumopod), dan komponen UI yang sudah teruji.

### 2.2 Celah pada Prototipe UI (untuk diperbaiki di iterasi desain berikut)
- **Form upload meminta NIS & kelas diketik manual** padahal data anak sudah ada di sistem — cukup pilih anak, sisanya auto-fill. Setiap field manual = satu sumber kesalahan input.
- **Belum ada state kosong (empty state)** — bagaimana tampilan orang tua baru yang belum pernah upload? Bagaimana dashboard admin di hari pertama tahun ajaran?
- **Belum ada layar "Perlu Revisi"** di sisi orang tua — padahal ini alur terpenting: orang tua harus tahu *apa* yang salah dan *bagaimana* memperbaikinya tanpa upload ulang dari nol.
- **Panel verifikasi admin belum menampilkan riwayat** — admin perlu melihat "siswa ini bulan lalu bayar berapa, pernah ditolak karena apa" untuk konteks.
- **Typo pada prototipe**: "Uploaat Pembayaran" → "Upload Pembayaran".
- **Kontras status badge** perlu diuji WCAG AA — kuning "Menunggu" di atas putih rawan tidak terbaca.

### 2.3 Keputusan Produk yang Perlu Dikunci Sebelum Coding

| # | Pertanyaan | Rekomendasi | Alasan |
|---|-----------|-------------|--------|
| K1 | Apakah ada konsep tagihan (bill)? | **Ya, wajib** | Tanpa tagihan tidak ada tunggakan, tidak ada validasi nominal |
| K2 | Beda "Diverifikasi" vs "Disetujui"? | **Hapus "Diverifikasi"** | 5 status cukup: Draft → Menunggu → (Disetujui / Ditolak / Perlu Revisi) |
| K3 | Login orang tua pakai apa? | **Nomor HP + OTP WhatsApp** (fallback email) | Orang tua Indonesia: WhatsApp > email. Tidak ada password = tidak ada "lupa password" |
| K4 | Satu bukti transfer untuk banyak tagihan? | **Ya (split payment)** | Realita: orang tua transfer 1x untuk SPP 3 bulan sekaligus |
| K5 | Pembayaran tunai di sekolah dicatat? | **Ya, admin bisa input manual** | Kalau tidak, laporan keuangan tidak lengkap dan sekolah tetap pakai buku |

---

## 3. Arsitektur Sistem

### 3.1 Prinsip
1. **Modular monolith** — satu codebase Next.js, modul dipisah per domain (`/modules/billing`, `/modules/verification`, `/modules/students`, dst). Microservices adalah overkill untuk skala ini.
2. **Multi-tenant by schema, single-tenant by deployment** — semua tabel punya `school_id` + RLS sejak hari 1. MVP jalan untuk 1 sekolah; SaaS tinggal buka pendaftaran, bukan migrasi.
3. **Database sebagai sumber kebenaran otorisasi** — RLS Supabase adalah lapisan keamanan utama; middleware Next.js hanya lapisan kedua.
4. **Setiap mutasi tercatat** — audit log bukan fitur v2, melainkan kebutuhan kepercayaan sejak MVP (ini uang sekolah).

### 3.2 Stack Final

| Lapisan | Teknologi | Catatan |
|---------|-----------|---------|
| Frontend | Next.js 14 (App Router) + TypeScript | Reuse pola ArtaFin |
| UI | Tailwind CSS + shadcn/ui | Bangun di atas **Arta Design System** (token warna indigo-ungu sesuai prototipe) |
| State/Data | TanStack Query + Server Actions | Mutasi via Server Actions, cache via Query |
| Backend | Supabase (PostgreSQL 15, Auth, Storage, Realtime, Edge Functions) | |
| Storage | Supabase Storage (bucket privat) | Bukti transfer TIDAK PERNAH publik |
| Notifikasi | WhatsApp Gateway (Fonnte/Wablas) + Web Push (PWA) | Email SMTP sebagai fallback |
| OCR (v2) | Sumopod API | Pipeline sama dengan ArtaFin |
| Hosting | Vercel (frontend) + Supabase Cloud | Opsi self-host: Coolify + Supabase self-hosted |
| Monitoring | Sentry + Supabase Logs | |

### 3.3 Struktur Modul (Codebase)

```
/app
  /(parent)          → PWA orang tua (mobile-first)
  /(admin)           → Dashboard admin (desktop-first)
  /api/webhooks      → WhatsApp gateway callback, dsb.
/modules
  /auth              → login OTP, session, role guard
  /billing           → tagihan, jenis pembayaran, generate massal
  /payments          → upload, state machine, split payment
  /verification      → antrean verifikasi, aksi admin
  /students          → siswa, kelas, tahun ajaran, import Excel
  /announcements     → pengumuman + broadcast
  /reports           → laporan, export PDF/Excel/CSV
  /audit             → audit log (append-only)
  /notifications     → dispatcher WA/push/email
/lib
  /supabase, /design-system, /utils
```

---

## 4. Model Data (PostgreSQL / Supabase)

### 4.1 Diagram Relasi Inti

```
schools ─┬─ academic_years ─── classes ─── class_enrollments ─── students
         ├─ payment_types ─── bills ──┬── bill_items
         ├─ guardians ─── guardian_students ─── students
         ├─ payments ─── payment_allocations ──→ bills
         ├─ announcements
         ├─ admin_users ─── roles
         └─ audit_logs
```

### 4.2 Skema Tabel Utama

```sql
-- Semua tabel memiliki school_id untuk kesiapan multi-tenant
create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  logo_url text,
  address text,
  bank_accounts jsonb default '[]',   -- [{bank, no_rek, atas_nama}]
  qris_url text,
  settings jsonb default '{}',
  created_at timestamptz default now()
);

create table academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  name text not null,                  -- "2026/2027"
  is_active boolean default false,
  starts_on date, ends_on date,
  unique(school_id, name)
);

create table classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  academic_year_id uuid not null references academic_years(id),
  grade smallint not null,             -- 1..6
  label text not null,                 -- "4A"
  unique(academic_year_id, label)
);

create table students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  nis text not null,
  full_name text not null,
  is_active boolean default true,
  unique(school_id, nis)
);

create table class_enrollments (        -- siswa bisa naik kelas antar tahun ajaran
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id),
  class_id uuid not null references classes(id),
  unique(student_id, class_id)
);

create table guardians (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  auth_user_id uuid unique references auth.users(id),
  full_name text not null,
  phone text not null,                 -- kunci login OTP WhatsApp
  email text,
  unique(school_id, phone)
);

create table guardian_students (        -- many-to-many
  guardian_id uuid references guardians(id),
  student_id uuid references students(id),
  relation text default 'wali',        -- ayah/ibu/wali
  primary key (guardian_id, student_id)
);

create table payment_types (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  name text not null,                  -- SPP, Daftar Ulang, Buku Paket
  default_amount numeric(12,0),
  is_recurring boolean default false,  -- SPP = true (bulanan)
  is_active boolean default true
);

-- ===== INTI SISTEM: TAGIHAN =====
create table bills (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  student_id uuid not null references students(id),
  payment_type_id uuid not null references payment_types(id),
  academic_year_id uuid not null references academic_years(id),
  period date,                         -- 2026-03-01 utk "SPP Maret 2026"; null utk non-recurring
  amount numeric(12,0) not null,
  amount_paid numeric(12,0) default 0, -- di-update oleh trigger dari allocations
  status text not null default 'unpaid'
    check (status in ('unpaid','partial','paid','waived','cancelled')),
  due_date date,
  unique(student_id, payment_type_id, period)
);

-- ===== PEMBAYARAN (bukti transfer) =====
create table payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  student_id uuid not null references students(id),
  submitted_by uuid references guardians(id),      -- null jika input manual admin
  method text not null default 'transfer'
    check (method in ('transfer','cash','qris')),
  amount numeric(12,0) not null,
  bank_name text, sender_name text,
  transferred_at timestamptz,
  proof_path text,                     -- path di bucket privat
  status text not null default 'pending'
    check (status in ('draft','pending','approved','rejected','needs_revision')),
  reviewed_by uuid references admin_users(id),
  reviewed_at timestamptz,
  review_note text,                    -- wajib jika rejected/needs_revision (enforced di app layer)
  revision_of uuid references payments(id),  -- rantai revisi
  created_at timestamptz default now()
);

create table payment_allocations (      -- 1 bukti transfer bisa melunasi >1 tagihan
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id),
  bill_id uuid not null references bills(id),
  amount numeric(12,0) not null
);

create table admin_users (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  auth_user_id uuid unique references auth.users(id),
  full_name text not null,
  role text not null
    check (role in ('super_admin','admin_keuangan','operator','kepala_sekolah','viewer')),
  is_active boolean default true
);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  title text not null,
  body text,
  image_url text, attachment_url text,
  audience jsonb default '{"scope":"all"}',  -- {"scope":"class","class_ids":[...]}
  publish_at timestamptz, expires_at timestamptz,
  created_by uuid references admin_users(id)
);

create table audit_logs (               -- APPEND-ONLY: tidak ada update/delete
  id bigint generated always as identity primary key,
  school_id uuid not null,
  actor_id uuid, actor_role text,
  action text not null,                -- 'payment.approved', 'student.deactivated'
  entity text, entity_id uuid,
  before jsonb, after jsonb,
  ip inet, user_agent text,
  created_at timestamptz default now()
);
```

**Catatan penting skema:**
- `bills.amount_paid` di-maintain oleh trigger `after insert/delete on payment_allocations` (hanya untuk payment berstatus `approved`) — laporan tunggakan jadi query murah.
- `payments.revision_of` membentuk rantai: orang tua yang diminta revisi mengirim payment baru yang menunjuk payment lama, sehingga riwayat audit utuh.
- Generate tagihan SPP massal = satu fungsi RPC: `generate_bills(payment_type_id, period)` untuk semua siswa aktif → idempotent berkat unique constraint.

---

## 5. State Machine Pembayaran (Final — 5 Status)

```
                    ┌────────────────────────────┐
 [Orang tua kirim]  │                            ▼
 draft ──────────▶ pending ──[Terima]────▶ approved  (final, alokasi dieksekusi)
                    │
                    ├──[Tolak + catatan wajib]──▶ rejected  (final)
                    │
                    └──[Revisi + catatan wajib]─▶ needs_revision
                                                    │
                              [orang tua kirim ulang, revision_of terisi]
                                                    ▼
                                                 pending (payment baru)
```

**Aturan transisi:**
- Hanya `admin_keuangan` dan `super_admin` yang boleh melakukan Terima/Tolak/Revisi.
- `approved` bersifat final. Koreksi kesalahan = aksi khusus "Batalkan Persetujuan" oleh `super_admin` dengan catatan wajib + tercatat di audit log (bukan edit biasa).
- Semua transisi menembakkan: (1) audit log, (2) notifikasi WhatsApp/push ke orang tua, (3) update `bills.amount_paid` bila approved.

---

## 6. Keamanan (Non-Negotiable untuk Data Finansial)

### 6.1 Autentikasi
- **Orang tua**: OTP via WhatsApp ke nomor terdaftar (Supabase Auth phone/custom OTP). Nomor didaftarkan oleh admin saat import siswa — orang tua tidak bisa self-register memakai nomor sembarang (mencegah orang asing mengklaim anak orang lain).
- **Admin**: email + password + wajib aktifkan 2FA (TOTP) untuk role `super_admin` dan `admin_keuangan`.
- Session: cookie httpOnly, secure, sameSite=lax; refresh token rotation (default Supabase).

### 6.2 Otorisasi — Row Level Security
Contoh policy kunci:

```sql
alter table payments enable row level security;

-- Orang tua hanya melihat pembayaran anak-anaknya sendiri
create policy parent_read_own on payments for select using (
  student_id in (
    select gs.student_id from guardian_students gs
    join guardians g on g.id = gs.guardian_id
    where g.auth_user_id = auth.uid()
  )
);

-- Orang tua hanya bisa insert (tidak pernah update/delete) untuk anaknya
create policy parent_insert_own on payments for insert with check (
  submitted_by in (select id from guardians where auth_user_id = auth.uid())
  and student_id in (
    select gs.student_id from guardian_students gs
    join guardians g on g.id = gs.guardian_id
    where g.auth_user_id = auth.uid()
  )
  and status = 'pending'
);

-- Admin dibatasi ke sekolahnya sendiri (kesiapan SaaS)
create policy admin_same_school on payments for all using (
  school_id = (select school_id from admin_users where auth_user_id = auth.uid())
);
```

Aturan yang sama diterapkan ke semua tabel. **Viewer & kepala_sekolah: select-only** (dipaksa di RLS, bukan hanya di UI).

### 6.3 Keamanan File Bukti Transfer
- Bucket **privat**; akses hanya via **signed URL berumur 5 menit** yang digenerate server-side setelah cek otorisasi.
- Path file: `{school_id}/{student_id}/{payment_id}.{ext}` — RLS storage policy mengikat prefix `school_id`.
- Validasi upload di Edge Function: maksimal 5 MB; magic-bytes check (bukan cuma ekstensi) hanya JPEG/PNG/WebP/PDF; strip metadata EXIF (lokasi GPS orang tua tidak boleh tersimpan); re-encode gambar untuk menetralkan payload tersembunyi.
- Simpan `sha256` file → fondasi "deteksi bukti ganda" di v2 (duplikat = lookup hash, belum perlu AI).

### 6.4 Proteksi Aplikasi
- Rate limiting upload: maksimal 10 upload/jam per akun orang tua.
- Rate limiting OTP: 3 permintaan/10 menit per nomor.
- Semua Server Action memvalidasi input dengan Zod sebelum menyentuh database.
- CSP header ketat, tidak ada inline script; sanitasi konten pengumuman (XSS).
- Backup: PITR Supabase 7 hari + export harian terenkripsi ke storage terpisah.
- Nominal disimpan `numeric`, bukan float; semua kalkulasi uang di database/server.

### 6.5 Matriks RBAC

| Kemampuan | Super Admin | Admin Keuangan | Operator | Kepsek | Viewer |
|---|---|---|---|---|---|
| Verifikasi (terima/tolak/revisi) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Batalkan persetujuan | ✅ | ❌ | ❌ | ❌ | ❌ |
| Kelola siswa/kelas/tahun ajaran | ✅ | ❌ | ✅ | ❌ | ❌ |
| Input pembayaran tunai | ✅ | ✅ | ✅ | ❌ | ❌ |
| Pengumuman & broadcast | ✅ | ❌ | ✅ | ❌ | ❌ |
| Laporan & export | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kelola admin & role | ✅ | ❌ | ❌ | ❌ | ❌ |
| Lihat audit log | ✅ | ❌ | ❌ | ✅ | ❌ |

---

## 7. Spesifikasi Fungsional per Modul (MVP)

### 7.1 PWA Orang Tua
1. **Login OTP WhatsApp** → pilih anak (jika >1).
2. **Beranda**: kartu per anak berisi tagihan berjalan + status terakhir; tombol besar "Upload Pembayaran"; pengumuman terbaru.
3. **Upload Pembayaran** (perbaikan dari prototipe):
   - Pilih anak → **pilih tagihan yang mau dibayar** (bisa multi-select, nominal terjumlah otomatis) → nominal auto-fill (bisa diedit untuk pembayaran sebagian) → bank tujuan (dropdown dari pengaturan sekolah) → nama pengirim → tanggal → foto/berkas bukti → preview → kirim.
   - NIS/kelas tidak pernah diketik manual.
   - Kompresi gambar client-side sebelum upload (hemat kuota orang tua).
4. **Riwayat**: filter status; item "Perlu Revisi" menampilkan catatan admin + tombol "Kirim Ulang" yang membuka form pre-filled.
5. **Detail pembayaran**: bukti, alokasi ke tagihan mana saja, timeline status.
6. **Offline-aware PWA**: riwayat ter-cache; upload saat offline masuk antrean dan terkirim ketika online.

### 7.2 Dashboard Admin
1. **Dashboard**: 4 kartu ringkasan (sesuai prototipe) + grafik upload 30 hari + donut status + **daftar tunggakan per kelas** (baru, dimungkinkan oleh model tagihan).
2. **Antrean Verifikasi**: tabel ter-filter (kelas/status/jenis/tanggal/cari); panel detail dengan zoom bukti + **riwayat pembayaran siswa di sisi kanan**; aksi Terima/Tolak/Revisi dengan catatan wajib; keyboard shortcut (A/R/V) untuk verifikasi cepat massal.
3. **Alokasi saat Terima**: sistem mengusulkan alokasi otomatis ke tagihan tertua yang belum lunas; admin bisa mengubah sebelum konfirmasi.
4. **Master Data**: tahun ajaran (aktifkan → wizard naik kelas), kelas, siswa (import Excel dengan template + validasi baris-per-baris + laporan error yang bisa diunduh).
5. **Tagihan**: generate SPP massal per periode; tagihan individual; pembebasan (waived) dengan catatan.
6. **Pengumuman & Broadcast**: buat pengumuman; broadcast WA per kelas/angkatan/semua (antrean dengan throttle agar nomor gateway tidak diblokir).
7. **Laporan**: rekap per periode/kelas/jenis/status; export XLSX/CSV/PDF; laporan tunggakan.
8. **Audit Log**: read-only, filter per aktor/aksi/tanggal.

### 7.3 Notifikasi (Event-Driven)

| Event | Orang Tua | Admin |
|---|---|---|
| Upload masuk | — | Badge antrean + digest WA harian |
| Disetujui | WA + push | — |
| Ditolak / Perlu Revisi | WA + push (dengan catatan) | — |
| Tagihan baru / jatuh tempo H-3 | WA + push | — |
| Pengumuman | Push (WA jika broadcast) | — |

Semua kirim WA lewat tabel antrean `notification_jobs` + worker (Edge Function terjadwal) dengan retry & dead-letter — gateway WA lokal sering tidak stabil, jangan kirim inline di request.

---

### 7.4 Tema Terang & Gelap (Light/Dark Mode)

Kedua aplikasi (PWA orang tua dan dashboard admin) mendukung tema terang dan gelap sejak MVP.

**Perilaku:**
- Default mengikuti preferensi sistem (`prefers-color-scheme`); pengguna dapat mengunci pilihan manual (Terang / Gelap / Sistem).
- Pilihan tersimpan per perangkat (localStorage via `next-themes`) — tanpa flash saat load (script inline sebelum hydration, atribut `class="dark"` di `<html>`).
- Letak toggle: PWA orang tua → halaman **Akun**; dashboard admin → ikon di **header** (sebelah profil).

**Arsitektur token (semantic, bukan hardcode warna):** seluruh komponen hanya memakai token semantik — `bg-background`, `bg-surface`, `text-foreground`, `border-border`, `bg-primary` — yang dipetakan ke CSS variables. Ganti tema = ganti nilai variabel, bukan menyentuh komponen. Ini juga fondasi Arta Design System lintas produk.

| Token | Light | Dark | Catatan |
|---|---|---|---|
| `--background` | `#F7F7FB` | `#0B0E1A` | Dark bernuansa indigo gelap, bukan hitam pekat |
| `--surface` (kartu) | `#FFFFFF` | `#151A2C` | Soft shadow di light → border halus di dark |
| `--foreground` | `#0F172A` | `#E2E8F0` | |
| `--muted-foreground` | `#64748B` | `#94A3B8` | |
| `--border` | `#E2E8F0` | `#293045` | |
| `--primary` | `#4F46E5` (indigo-600) | `#818CF8` (indigo-400) | Primary dicerahkan di dark agar kontras AA di atas surface |
| `--primary-foreground` | `#FFFFFF` | `#0B0E1A` | |

**Badge status (kontras AA di kedua tema, selalu ikon + label, bukan warna saja):**

| Status | Light | Dark |
|---|---|---|
| Menunggu | teks `amber-700` di `amber-100` | teks `amber-300` di `amber-500/15` |
| Disetujui | teks `emerald-700` di `emerald-100` | teks `emerald-300` di `emerald-500/15` |
| Ditolak / Perlu Revisi | teks `red-700` / `orange-700` di tint-nya | teks `red-300` / `orange-300` di tint 15% |

**Aturan khusus dark mode:**
- **Foto bukti transfer tidak pernah di-filter/invert** — struk didesain untuk latar terang; tampilkan di panel dengan backdrop putih/netral + border agar tetap terbaca saat verifikasi.
- Grafik (recharts) membaca warna dari CSS variables, bukan hex hardcode — grid line dan tooltip ikut tema.
- Glassmorphism ringan pada light dikurangi di dark (blur turun, opacity surface naik) agar teks tetap tajam.
- Meta tag `theme-color` dinamis mengikuti tema (status bar PWA di Android menyatu).

## 8. Non-Functional Requirements

| Aspek | Target |
|---|---|
| Waktu muat PWA orang tua | < 2,5 dtk di 3G cepat (LCP), bundle route < 150 KB gz |
| Aksi verifikasi admin | < 400 ms P95 |
| Ketersediaan | 99,5% (jam sekolah 06.00–17.00 WITA kritis) |
| Skala desain | 2.000 siswa/sekolah, 50 sekolah (SaaS), 10rb upload/bulan/sekolah |
| Aksesibilitas | WCAG 2.1 AA; status tidak hanya warna tapi juga ikon+label |
| Tema | Light & dark mode penuh; default ikuti sistem; kontras AA di kedua tema |
| Bahasa | id-ID penuh; format Rp dan tanggal Indonesia |
| Retensi bukti transfer | 7 tahun (kebutuhan pembukuan), lalu arsip dingin |
| Privasi | Sesuai UU PDP: data anak minimal, EXIF dibuang, hak hapus akun wali |

---

## 9. Roadmap Eksekusi

### MVP — 10 Sprint (±10 minggu, solo developer)

| Sprint | Deliverable |
|---|---|
| 1 | Setup repo, Arta Design System token (dual-theme light/dark), skema DB + RLS + seed, CI |
| 2 | Auth: OTP WA orang tua, login admin, role guard, session |
| 3 | Master data: tahun ajaran, kelas, siswa + import/export Excel |
| 4 | Modul tagihan: payment_types, generate massal, tunggakan |
| 5 | PWA orang tua: beranda, upload (kompresi, validasi, storage privat) |
| 6 | State machine + antrean verifikasi admin + alokasi |
| 7 | Riwayat & detail orang tua, alur "Perlu Revisi" end-to-end |
| 8 | Notifikasi: antrean WA + push; pengumuman |
| 9 | Dashboard admin + laporan + export; audit log viewer |
| 10 | Hardening: rate limit, pentest mandiri, backup drill, UAT dengan 1 sekolah pilot, dokumentasi admin |

**Definisi selesai MVP**: 1 sekolah pilot menjalankan 1 siklus penuh SPP bulanan (generate tagihan → orang tua upload → verifikasi → laporan) tanpa menyentuh WhatsApp manual.

### v2 (bulan 4–6)
Input tunai + QRIS statis, OCR bukti via Sumopod (auto-isi nominal/bank/tanggal), deteksi duplikat via hash, multi tahun ajaran penuh + wizard naik kelas, 2FA enforcement, digest harian kepala sekolah.

### v3 (bulan 7–12)
Payment gateway + Virtual Account (Midtrans/Xendit — menghapus verifikasi manual sepenuhnya untuk VA), deteksi manipulasi gambar, analytics AI, onboarding self-service multi-sekolah (SaaS), billing per sekolah (Rp per siswa aktif/bulan).

---

## 10. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Nomor WA gateway diblokir | Notifikasi mati | Antrean + throttle, 2 nomor cadangan, fallback push/email |
| Orang tua gagap teknologi | Adopsi rendah | Onboarding oleh sekolah, video 60 detik, UI 3-langkah, admin bisa upload atas nama orang tua |
| Salah verifikasi (human error) | Kepercayaan turun | Riwayat siswa di panel, catatan wajib, batalkan-persetujuan ber-audit |
| Solo developer bottleneck | Jadwal molor | Modular monolith, reuse ArtaFin, scope MVP dikunci keras |
| Data siswa bocor | Fatal (data anak) | RLS ketat, bucket privat, signed URL, audit, backup terenkripsi |
| Sekolah minta fitur custom | Scope creep | Settings-driven config, tolak custom code per sekolah |

---

## 11. Metrik Keberhasilan

- **North star**: % pembayaran bulanan yang terverifikasi via aplikasi (target pilot: >80% dalam 3 bulan).
- Waktu median dari upload → keputusan admin (target: < 4 jam kerja).
- Rasio "Perlu Revisi" (target: < 10%; bila tinggi berarti form upload masih membingungkan).
- Tunggakan tervisibilitas: laporan tunggakan akurat 100% vs pembukuan manual sekolah.

---

*Dokumen ini siap dijadikan acuan Sprint 1. Langkah berikutnya yang disarankan: (1) validasi model tagihan dengan admin TU sekolah pilot, (2) finalisasi Arta Design System token, (3) setup repo + skema DB.*
