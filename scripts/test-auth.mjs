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

console.log(`\n=== ${lulus}/${lulus + gagal.length} lulus ===`);
if (gagal.length) process.exit(1);
