/**
 * Uji interpretasi respons WAHA (npm run test:gateway).
 *
 * WAHA memakai kode HTTP yang benar — berbeda dari Fonnte yang selalu 200.
 * Yang diuji: 2xx→terkirim, 422→sesi belum siap, 401→api-key salah, 5xx→ulangi,
 * plus konversi nomor → chatId.
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { transpileModule, ModuleKind } from "typescript";

const ts = readFileSync("modules/notifications/waha-parse.ts", "utf8");
const js = transpileModule(ts, { compilerOptions: { module: ModuleKind.ESNext } }).outputText;
const file = join(mkdtempSync(join(tmpdir(), "waha-")), "p.mjs");
writeFileSync(file, js);
const { interpretasiWaha, keChatId, endpointKirim } = await import(
  "file://" + file.replace(/\\/g, "/")
);

let lulus = 0;
const gagal = [];
function cek(nama, kondisi, detail = "") {
  if (kondisi) { lulus++; console.log(`  OK    ${nama}`); }
  else { gagal.push(nama); console.log(`  GAGAL ${nama} ${detail}`); }
}

console.log("\n=== Uji interpretasi respons WAHA ===\n");

// Sukses: 201 Created dengan objek pesan
const sukses = interpretasiWaha(201, JSON.stringify({ id: "true_628..@c.us_3EB0", _data: {} }));
cek("HTTP 201 → terkirim", sukses.ok === true);

const sukses200 = interpretasiWaha(200, JSON.stringify({ id: "abc" }));
cek("HTTP 200 → terkirim", sukses200.ok === true);

// 422: sesi belum WORKING (respons NestJS nyata WAHA)
const sesi = interpretasiWaha(422, JSON.stringify({
  statusCode: 422,
  message: "Session status is not as expected. Try again later or restart the session. Status: STOPPED. Expected: WORKING",
  error: "Unprocessable Entity",
}));
cek("HTTP 422 → GAGAL (sesi belum siap)", sesi.ok === false);
cek("  pesan sesi diteruskan", String(sesi.error).includes("WORKING"));
cek("  422 layak diulang (sesi bisa pulih)", sesi.ulangi === true);

// 401: X-Api-Key salah
const auth = interpretasiWaha(401, JSON.stringify({ statusCode: 401, message: "Unauthorized" }));
cek("HTTP 401 → GAGAL (api-key)", auth.ok === false && String(auth.error).includes("X-Api-Key"));

// message berupa array (validasi NestJS)
const validasi = interpretasiWaha(400, JSON.stringify({
  statusCode: 400, message: ["chatId must be a string", "text should not be empty"], error: "Bad Request",
}));
cek("HTTP 400 array message digabung", validasi.ok === false && String(validasi.error).includes("chatId must be a string"));

// 5xx → ulangi
const s5 = interpretasiWaha(502, "Bad Gateway");
cek("HTTP 502 → gagal & ulangi", s5.ok === false && s5.ulangi === true);

// body non-JSON pada error tetap ditangani
const nonjson = interpretasiWaha(404, "Cannot POST /api/sendText");
cek("HTTP 404 body non-JSON → gagal", nonjson.ok === false);

console.log("\nKonversi nomor & endpoint:");
cek('+6281234567890 → 6281234567890@c.us', keChatId("+6281234567890") === "6281234567890@c.us");
cek("spasi/strip dibersihkan", keChatId("+62 812-3456-7890") === "6281234567890@c.us");
cek("URL dasar → /api/sendText", endpointKirim("https://waha.contoh.com") === "https://waha.contoh.com/api/sendText");
cek("trailing slash dirapikan", endpointKirim("https://waha.contoh.com/") === "https://waha.contoh.com/api/sendText");

// Tautan wa.me untuk mode semi-otomatis (Kotak Keluar WA, kode aktivasi)
const wl = readFileSync("modules/notifications/wa-link.ts", "utf8");
const wlFile = join(mkdtempSync(join(tmpdir(), "walink-")), "w.mjs");
writeFileSync(wlFile, transpileModule(wl, { compilerOptions: { module: ModuleKind.ESNext } }).outputText);
const { nomorWa, tautanWa } = await import("file://" + wlFile.replace(/\\/g, "/"));

console.log("\nTautan wa.me (mode manual):");
cek("+62 812-3456 → 628123456", nomorWa("+62 812-3456") === "628123456");
cek("0812… → 62812…", nomorWa("081234567001") === "6281234567001");
cek("62812… tetap", nomorWa("6281234567001") === "6281234567001");
const link = tautanWa("+6281234567001", "Halo & salam\nBaris 2: Rp 350.000");
cek("format https://wa.me/<nomor>?text=", link.startsWith("https://wa.me/6281234567001?text="));
cek("teks ter-encode (& dan baris baru aman)",
  link.includes("Halo%20%26%20salam%0ABaris%202") &&
  decodeURIComponent(link.split("text=")[1]) === "Halo & salam\nBaris 2: Rp 350.000");

console.log(`\n=== ${lulus}/${lulus + gagal.length} lulus ===`);
if (gagal.length) { console.error("GAGAL: " + gagal.join(", ")); process.exit(1); }
console.log("Interpretasi respons WAHA benar.\n");
