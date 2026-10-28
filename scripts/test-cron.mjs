/**
 * Uji otorisasi endpoint terjadwal (npm run test:cron).
 *
 * Alasan: Vercel Cron memanggil GET + `Authorization: Bearer <CRON_SECRET>`,
 * sedangkan route lama hanya menerima POST + `x-cron-secret` → di produksi
 * worker notifikasi & digest TIDAK PERNAH jalan, tanpa ada yang sadar.
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { transpileModule, ModuleKind } from "typescript";

const ts = readFileSync("lib/cron-auth.ts", "utf8");
const js = transpileModule(ts, { compilerOptions: { module: ModuleKind.ESNext } }).outputText;
const file = join(mkdtempSync(join(tmpdir(), "cron-")), "c.mjs");
writeFileSync(file, js);
const { periksaCron } = await import("file://" + file.replace(/\\/g, "/"));

let lulus = 0;
const gagal = [];
function cek(nama, kondisi, detail = "") {
  if (kondisi) { lulus++; console.log(`  OK    ${nama}`); }
  else { gagal.push(nama); console.log(`  GAGAL ${nama} ${detail}`); }
}
const S = "rahasia-cron-uji-0123456789";
const h = (authorization = null, xCronSecret = null) => ({ authorization, xCronSecret });

console.log("\n=== Uji otorisasi cron ===\n");

console.log("[Vercel Cron] Authorization: Bearer");
cek("Bearer benar diterima", periksaCron(h(`Bearer ${S}`), S) === "ok");
cek("skema 'bearer' huruf kecil diterima", periksaCron(h(`bearer ${S}`), S) === "ok");
cek("Bearer salah ditolak", periksaCron(h("Bearer salah"), S) === "ditolak");
cek("tanpa awalan Bearer ditolak", periksaCron(h(S), S) === "ditolak");
cek("Basic auth ditolak", periksaCron(h(`Basic ${S}`), S) === "ditolak");
cek("Bearer kosong ditolak", periksaCron(h("Bearer "), S) === "ditolak");

console.log("\n[penjadwal lain] x-cron-secret");
cek("x-cron-secret benar diterima", periksaCron(h(null, S), S) === "ok");
cek("x-cron-secret salah ditolak", periksaCron(h(null, "salah"), S) === "ditolak");
cek("awalan rahasia saja ditolak", periksaCron(h(null, S.slice(0, -1)), S) === "ditolak");
cek("rahasia + ekor ditolak", periksaCron(h(null, S + "x"), S) === "ditolak");

console.log("\n[kombinasi & konfigurasi]");
cek("tanpa header ditolak", periksaCron(h(), S) === "ditolak");
cek("satu header benar cukup (lainnya salah)", periksaCron(h("Bearer salah", S), S) === "ok");
cek("CRON_SECRET kosong → belum-dikonfigurasi (fail-closed)",
  periksaCron(h(`Bearer ${S}`), undefined) === "belum-dikonfigurasi");
cek("CRON_SECRET string kosong → belum-dikonfigurasi",
  periksaCron(h("Bearer "), "") === "belum-dikonfigurasi");

const src = readFileSync("lib/cron-auth.ts", "utf8");
cek("perbandingan waktu-konstan (timingSafeEqual), bukan ===/!==",
  src.includes("timingSafeEqual") && !/===\s*secret|secret\s*===|!==\s*secret/.test(src));

for (const r of ["notifications", "digest"]) {
  const route = readFileSync(`app/api/jobs/${r}/route.ts`, "utf8");
  cek(`/api/jobs/${r} meng-export GET (dipakai Vercel Cron)`, /export const GET\b|export async function GET\b/.test(route));
  cek(`/api/jobs/${r} memakai tolakBilaBukanCron`, route.includes("tolakBilaBukanCron(request)"));
}

console.log(`\n=== Hasil: ${lulus}/${lulus + gagal.length} lulus ===\n`);
if (gagal.length) process.exit(1);
