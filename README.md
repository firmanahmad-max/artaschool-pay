# ArtaSchool Pay

Administrasi pembayaran sekolah yang cepat, transparan & modern — verifikasi
bukti transfer tanpa WhatsApp berserakan.

- **Sumber kebenaran produk**: [`ArtaSchoolPay_PRD_v1.md`](./ArtaSchoolPay_PRD_v1.md)
- **Handoff pengembangan**: [`CONTEXT.md`](./CONTEXT.md)

## Stack

Next.js 14 (App Router) · TypeScript strict · Tailwind + shadcn-style UI ·
TanStack Query · Supabase (Auth, PostgreSQL, Storage, Edge Functions) · Zod · Vercel

## Menjalankan Lokal

```bash
npm install
cp .env.local.example .env.local   # isi kredensial Supabase

# Database lokal (butuh Docker):
npx supabase init && npx supabase start
npx supabase db reset              # migrations/ + seed
npm run typegen                    # regenerate lib/supabase/types.ts

npm run dev                        # http://localhost:3000
```

Bucket storage dibuat manual (privat!): `payment-proofs` — lihat komentar §7 di
[`supabase/migrations/001_init_schema.sql`](./supabase/migrations/001_init_schema.sql).

## Rute

| Area | URL |
|---|---|
| PWA orang tua | `/beranda`, `/upload`, `/riwayat`, `/pengumuman`, `/akun` |
| Dashboard admin | `/admin`, `/admin/verifikasi`, `/admin/tagihan`, `/admin/siswa`, `/admin/tahun-ajaran`, `/admin/pengumuman`, `/admin/laporan`, `/admin/audit` |
| Webhook | `POST /api/webhooks/wa` |

## Skrip

- `npm run dev` / `build` / `start`
- `npm run lint` · `npm run typecheck` · `npm run format`
- `npm run typegen` — generate tipe Supabase (butuh `supabase start`)
- `npm run seed:admin` — buat akun admin pengembangan
- `npm run pentest` — 21 uji batas keamanan memakai sesi wali sungguhan
- `npm run backup:drill` — dump → restore → bandingkan tabel kritis

> ⚠️ Jangan menjalankan `npm run build` selagi `npm run dev` hidup — keduanya
> berbagi folder `.next` dan bisa saling merusak cache. Urutan aman:
> stop dev → build → start dev.

## Dokumentasi

- [Panduan Admin](./docs/PANDUAN-ADMIN.md) — operasional harian untuk staf sekolah

Konvensi wajib (uang integer Rupiah, mutasi status hanya via RPC, token tema
semantik, dsb.) ada di [`CONTEXT.md`](./CONTEXT.md).
