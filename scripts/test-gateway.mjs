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

// vCard kontak wali (Daftar Siaran WA di mode manual)
const vc = readFileSync("modules/announcements/vcard.ts", "utf8");
const vcFile = join(mkdtempSync(join(tmpdir(), "vcard-")), "v.mjs");
writeFileSync(vcFile, transpileModule(vc, { compilerOptions: { module: ModuleKind.ESNext } }).outputText);
const { buatVcard, escapeVcard } = await import("file://" + vcFile.replace(/\\/g, "/"));

console.log("\nvCard kontak wali:");
const kartu = buatVcard([
  { nama: "Made Wijaya", phone: "+62 812-3456-7001", keterangan: "Wali Putu (1A), Kadek (4A)" },
  { nama: "Fatimah; Bin Ali", phone: "+6281234567002" },
]);
cek("2 kartu", (kartu.match(/BEGIN:VCARD/g) ?? []).length === 2);
cek("VERSION 3.0", kartu.includes("VERSION:3.0"));
cek("nomor dibersihkan (+ dan angka saja)", kartu.includes("TEL;TYPE=CELL:+6281234567001"));
cek("koma di keterangan di-escape", kartu.includes("Putu (1A)\\, Kadek (4A)"));
cek("titik koma di nama di-escape (tak merusak field N)", kartu.includes("N:Fatimah\\; Bin Ali;;;;"));
cek("baris CRLF sesuai standar", kartu.includes("\r\nEND:VCARD"));
cek("daftar kosong → string kosong", buatVcard([]) === "");
cek("escape backslash & baris baru", escapeVcard("a\\b\nc") === "a\\\\b\\nc");

// Isi notifikasi push (Web Push)
const pc = readFileSync("modules/notifications/push-content.ts", "utf8");
const pcFile = join(mkdtempSync(join(tmpdir(), "push-")), "p.mjs");
writeFileSync(pcFile, transpileModule(pc, { compilerOptions: { module: ModuleKind.ESNext } }).outputText);
const { isiPush, base64UrlKeUint8 } = await import("file://" + pcFile.replace(/\\/g, "/"));

console.log("\nIsi notifikasi push:");
const uuid = "e9ed2c90-6029-40a3-a3df-107aa83817de";
const p1 = isiPush("payment.approved", "Pembayaran Rp 350.000 telah DISETUJUI.", { payment_id: uuid });
cek("judul disetujui", p1.title.startsWith("Pembayaran disetujui"));
cek("tautan ke detail riwayat", p1.url === `/riwayat/${uuid}`);
const p2 = isiPush("payment.needs_revision", "x", { payment_id: "../../admin" });
cek("payment_id bukan UUID → /riwayat (tak bisa disusupi path)", p2.url === "/riwayat");
const p3 = isiPush("announcement", "[Pengumuman] Libur\nMulai 20 Des", {});
cek("pengumuman → /pengumuman", p3.url === "/pengumuman");
cek("awalan [Pengumuman] dibuang", p3.body.startsWith("Libur"));
const p4 = isiPush("lain.lain", "a".repeat(400), null);
cek("template tak dikenal → judul umum + /beranda", p4.title === "ArtaSchool Pay" && p4.url === "/beranda");
cek("teks panjang dipotong ≤180 + …", p4.body.length === 180 && p4.body.endsWith("…"));
const wp = (await import("web-push")).default;
const kunci = wp.generateVAPIDKeys();
const u8 = base64UrlKeUint8(kunci.publicKey);
cek("kunci VAPID → 65 byte titik P-256 tak terkompresi", u8.length === 65 && u8[0] === 0x04);

console.log(`\n=== ${lulus}/${lulus + gagal.length} lulus ===`);
if (gagal.length) { console.error("GAGAL: " + gagal.join(", ")); process.exit(1); }
console.log("Interpretasi respons WAHA benar.\n");
