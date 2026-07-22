/**
 * Bootstrap sekolah pilot pada instalasi PRODUKSI yang masih kosong.
 * Membuat: sekolah + tahun ajaran aktif + akun admin. Data siswa menyusul
 * lewat import Excel di aplikasi.
 *
 *   node scripts/bootstrap-sekolah.mjs
 *
 * Sengaja TIDAK memakai `supabase/seed.sql` — berkas itu berisi data demo
 * yang tidak boleh masuk produksi.
 *
 * Env wajib: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Env opsional: SEKOLAH_NAMA, SEKOLAH_SLUG, ADMIN_EMAIL, KEPSEK_PHONE
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset.");
  process.exit(1);
}

const NAMA = process.env.SEKOLAH_NAMA ?? "SD Pilot";
const SLUG = process.env.SEKOLAH_SLUG ?? "sd-pilot";
const EMAIL = process.env.ADMIN_EMAIL ?? "superadmin@sekolah.local";
const KEPSEK_PHONE = process.env.KEPSEK_PHONE ?? null;

const db = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Sandi acak kuat — dicetak sekali, wajib diganti admin saat login pertama
const sandi = randomBytes(12).toString("base64url");

console.log("\n=== Bootstrap sekolah pilot ===\n");
console.log(`  Supabase : ${URL}`);
console.log(`  Sekolah  : ${NAMA} (${SLUG})`);
console.log(`  Admin    : ${EMAIL}\n`);

// Penjaga: menolak berjalan bila instalasi sudah berisi data
const { count } = await db.from("schools").select("id", { count: "exact", head: true });
if ((count ?? 0) > 0) {
  console.error(
    `Instalasi ini sudah memuat ${count} sekolah. Skrip ini hanya untuk instalasi kosong.\n` +
      "Bila ingin menambah sekolah pada instalasi berjalan, lakukan lewat aplikasi.",
  );
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const jawab = await rl.question("Lanjutkan membuat data di atas? (ketik: ya) ");
rl.close();
if (jawab.trim().toLowerCase() !== "ya") {
  console.log("Dibatalkan.");
  process.exit(0);
}

const tahunIni = new Date().getFullYear();
const namaTahun = `${tahunIni}/${tahunIni + 1}`;

const { data: sekolah, error: eSekolah } = await db
  .from("schools")
  .insert({ name: NAMA, slug: SLUG, bank_accounts: [] })
  .select("id")
  .single();
if (eSekolah) throw eSekolah;

const { error: eTahun } = await db.from("academic_years").insert({
  school_id: sekolah.id,
  name: namaTahun,
  is_active: true,
});
if (eTahun) throw eTahun;

const { data: user, error: eUser } = await db.auth.admin.createUser({
  email: EMAIL,
  password: sandi,
  email_confirm: true,
});
if (eUser) throw eUser;

const { error: eAdmin } = await db.from("admin_users").insert({
  school_id: sekolah.id,
  auth_user_id: user.user.id,
  full_name: "Super Admin",
  role: "super_admin",
  is_active: true,
  phone: KEPSEK_PHONE,
  daily_digest: Boolean(KEPSEK_PHONE),
});
if (eAdmin) throw eAdmin;

console.log("\nSelesai.\n");
console.log(`  Tahun ajaran aktif : ${namaTahun}`);
console.log(`  Email login        : ${EMAIL}`);
console.log(`  Sandi sementara    : ${sandi}`);
console.log("\nLangkah berikutnya:");
console.log("  1. Login, aktifkan 2FA (wajib untuk super admin), lalu GANTI SANDI.");
console.log("  2. Isi rekening bank sekolah pada tabel `schools.bank_accounts`.");
console.log("  3. Buat kelas, lalu import siswa lewat menu Siswa & Kelas.");
console.log("  4. Buat akun admin keuangan / operator / kepala sekolah.\n");
