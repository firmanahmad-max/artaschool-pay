/**
 * Uji fungsi murni kredensial wali (npm run test:auth):
 * teks masa berlaku OTP, validasi PIN, kode aktivasi.
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { transpileModule, ModuleKind } from "typescript";

const ts = readFileSync("modules/auth/kredensial.ts", "utf8");
const js = transpileModule(ts, { compilerOptions: { module: ModuleKind.ESNext } }).outputText;
const file = join(mkdtempSync(join(tmpdir(), "kred-")), "k.mjs");
writeFileSync(file, js);
const k = await import("file://" + file.replace(/\\/g, "/"));

let lulus = 0;
const gagal = [];
function cek(nama, kondisi, detail = "") {
  if (kondisi) { lulus++; console.log(`  OK    ${nama}`); }
  else { gagal.push(nama); console.log(`  GAGAL ${nama} ${detail}`); }
}

console.log("\n=== Uji kredensial wali ===\n");

console.log("[OTP] masa berlaku");
cek("env kosong → default Supabase 60 dtk", k.masaBerlakuOtpDetik(undefined) === 60);
cek("env 300 → 300", k.masaBerlakuOtpDetik("300") === 300);
cek("env sampah → default", k.masaBerlakuOtpDetik("lima") === 60);
cek("env terlalu kecil → default", k.masaBerlakuOtpDetik("5") === 60);
cek("60 → '1 menit'", k.teksDurasi(60) === "1 menit");
cek("300 → '5 menit'", k.teksDurasi(300) === "5 menit");
cek("45 → '45 detik'", k.teksDurasi(45) === "45 detik");
cek("90 → '1 menit 30 detik'", k.teksDurasi(90) === "1 menit 30 detik");
const pesan = k.pesanOtp("123456", 60);
cek("pesan memuat kode", pesan.includes("*123456*"));
cek("pesan TIDAK lagi menjanjikan 5 menit secara mati", !pesan.includes("5 menit"));
cek("pesan menyebut durasi sebenarnya", pesan.includes("Berlaku 1 menit"));

console.log("\n[PIN] validasi");
cek("PIN wajar diterima", k.validasiPin("482913") === null);
cek("bukan 6 angka ditolak", k.validasiPin("12345") !== null && k.validasiPin("12a456") !== null);
cek("angka sama semua ditolak (000000)", k.validasiPin("000000") !== null);
cek("berurutan naik ditolak (123456)", k.validasiPin("123456") !== null);
cek("berurutan turun ditolak (654321)", k.validasiPin("654321") !== null);
cek("berurutan berputar ditolak (890123)", k.validasiPin("890123") !== null);
cek("pola 121212 ditolak", k.validasiPin("121212") !== null);
cek("pola 123123 ditolak", k.validasiPin("123123") !== null);
cek("pola 112233 ditolak", k.validasiPin("112233") !== null);
cek("PIN mirip pola tapi acak diterima (135792)", k.validasiPin("135792") === null);

console.log("\n[Kode aktivasi]");
cek("normalisasi 'abcd-efgh ' → ABCDEFGH", k.normalisasiKode("abcd-efgh ") === "ABCDEFGH");
cek("kode alfabet aman valid", k.kodeAktivasiValid("K7QM3XPA"));
cek("huruf ambigu (O) ditolak", !k.kodeAktivasiValid("K7QMOXPA"));
cek("angka ambigu (1) ditolak", !k.kodeAktivasiValid("K7QM1XPA"));
cek("panjang salah ditolak", !k.kodeAktivasiValid("K7QM3XP"));
const sql = readFileSync("supabase/migrations/019_guardian_activation.sql", "utf8");
const alfabetSql = sql.match(/v_alfabet\s+constant text := '([^']+)'/)?.[1];
cek("alfabet TS == alfabet SQL migration 019", alfabetSql === k.ALFABET_KODE,
  `(SQL=${alfabetSql})`);
cek("alfabet 31 karakter tanpa I L O 0 1",
  k.ALFABET_KODE.length === 31 && !/[ILO01]/.test(k.ALFABET_KODE));
cek("format ABCD-EFGH", k.formatKode("K7QM3XPA") === "K7QM-3XPA");
cek("urlAktivasi tanpa garis miring ganda",
  k.urlAktivasi("https://pay.sekolah.id/") === "https://pay.sekolah.id/login?aktivasi=1");
const pesanA = k.pesanAktivasi({ nama: "Made", kode: "K7QM3XPA", urlAktivasi: "https://x.id/login?aktivasi=1" });
cek("pesan aktivasi memuat kode terformat", pesanA.includes("*K7QM-3XPA*"));
cek("pesan aktivasi memuat tautan aktivasi", pesanA.includes("https://x.id/login?aktivasi=1"));

console.log(`\n=== ${lulus}/${lulus + gagal.length} lulus ===`);
if (gagal.length) process.exit(1);
