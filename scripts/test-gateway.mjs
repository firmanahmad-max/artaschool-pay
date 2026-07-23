/**
 * Uji interpretasi respons Fonnte (npm run test:gateway).
 *
 * Skenario memakai bentuk respons NYATA dari dokumentasi Fonnte. Yang paling
 * penting: "status:false pada HTTP 200" harus dianggap GAGAL — inilah bug yang
 * bisa membuat notifikasi yang tak pernah sampai tercatat sebagai terkirim.
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { transpileModule, ModuleKind } from "typescript";

const ts = readFileSync("modules/notifications/fonnte-parse.ts", "utf8");
const js = transpileModule(ts, { compilerOptions: { module: ModuleKind.ESNext } }).outputText;
const file = join(mkdtempSync(join(tmpdir(), "fonnte-")), "p.mjs");
writeFileSync(file, js);
const { interpretasiFonnte } = await import("file://" + file.replace(/\\/g, "/"));

let lulus = 0;
const gagal = [];
function cek(nama, kondisi, detail = "") {
  if (kondisi) { lulus++; console.log(`  OK    ${nama}`); }
  else { gagal.push(nama); console.log(`  GAGAL ${nama} ${detail}`); }
}

console.log("\n=== Uji interpretasi respons Fonnte ===\n");

// Sukses: message in queue (respons nyata dari dokumentasi)
const sukses = interpretasiFonnte(200, JSON.stringify({
  detail: "success! message in queue", id: ["80367170"], process: "pending",
  requestid: 2937124, status: true, target: ["6282227097005"],
}));
cek("status:true → terkirim", sukses.ok === true);

// JEBAKAN UTAMA: HTTP 200 tapi status:false (token salah)
const tokenSalah = interpretasiFonnte(200, JSON.stringify({
  status: false, reason: "token invalid", requestid: 2937124,
}));
cek("HTTP 200 + status:false → GAGAL (bukan terkirim)", tokenSalah.ok === false);
cek("  alasan gagal diteruskan ke dead-letter", String(tokenSalah.error).includes("token invalid"));

// device terputus / kuota habis — juga status:false di HTTP 200
for (const alasan of ["device disconnected", "insufficient quota", "invalid target"]) {
  const r = interpretasiFonnte(200, JSON.stringify({ status: false, reason: alasan }));
  cek(`status:false (${alasan}) → GAGAL`, r.ok === false && String(r.error).includes(alasan));
}

// 5xx → gagal & layak diulang
const s5 = interpretasiFonnte(502, "Bad Gateway");
cek("HTTP 502 → gagal & ulangi", s5.ok === false && s5.ulangi === true);

// body bukan JSON → gagal, tidak menganggapnya sukses
const rusak = interpretasiFonnte(200, "<html>Maintenance</html>");
cek("body non-JSON → GAGAL (tidak dikira terkirim)", rusak.ok === false);

// pesan terjadwal juga sukses
const terjadwal = interpretasiFonnte(200, JSON.stringify({
  status: true, detail: "success! message will be sent on scheduled time",
}));
cek("pesan terjadwal → terkirim", terjadwal.ok === true);

console.log(`\n=== ${lulus}/${lulus + gagal.length} lulus ===`);
if (gagal.length) { console.error("GAGAL: " + gagal.join(", ")); process.exit(1); }
console.log("Interpretasi respons Fonnte benar.\n");
