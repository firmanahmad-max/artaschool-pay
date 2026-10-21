/**
 * Uji statistik perangkat anonim (npm run test:perangkat): pengurai UA kasar,
 * Do Not Track/GPC, dan batas sekali sehari.
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { transpileModule, ModuleKind } from "typescript";

const ts = readFileSync("lib/statistik-perangkat.ts", "utf8");
const js = transpileModule(ts, { compilerOptions: { module: ModuleKind.ESNext } }).outputText;
const file = join(mkdtempSync(join(tmpdir(), "perangkat-")), "p.mjs");
writeFileSync(file, js);
const p = await import("file://" + file.replace(/\\/g, "/"));

let lulus = 0;
const gagal = [];
function cek(nama, kondisi, detail = "") {
  if (kondisi) { lulus++; console.log(`  OK    ${nama}`); }
  else { gagal.push(nama); console.log(`  GAGAL ${nama} ${detail}`); }
}
const sama = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log("\n=== Uji statistik perangkat anonim ===\n");

const UA = {
  chromeAndroid: "Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.81 Mobile Safari/537.36",
  androidLama: "Mozilla/5.0 (Linux; Android 6.0; ASUS_Z00LD) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.5249.126 Mobile Safari/537.36",
  samsung: "Mozilla/5.0 (Linux; Android 12; SAMSUNG SM-A125F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36",
  iphone15: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1",
  chromeIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/119.0.6045.169 Mobile/15E148 Safari/604.1",
  waWebview: "Mozilla/5.0 (Linux; Android 11; RMX2185; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/118.0.0.0 Mobile Safari/537.36",
  fbApp: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 [FBAN/EMA;FBLC/id_ID;FBAV/400.0.0.0;]",
  firefoxWin: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0",
  edgeWin: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0",
  safariMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Safari/605.1.15",
};

console.log("Pengurai user-agent (kategori kasar):");
cek("Chrome Android 13", sama(p.kategoriPerangkat(UA.chromeAndroid), { browser: "chrome", versi: 129, os: "android", osVersi: 13 }));
cek("Android 6 / Chrome 106 (perangkat lama)", sama(p.kategoriPerangkat(UA.androidLama), { browser: "chrome", versi: 106, os: "android", osVersi: 6 }));
cek("Samsung Internet dibedakan dari Chrome", p.kategoriPerangkat(UA.samsung).browser === "samsung" && p.kategoriPerangkat(UA.samsung).versi === 23);
cek("iPhone iOS 15 → safari versi 15", sama(p.kategoriPerangkat(UA.iphone15), { browser: "safari", versi: 15, os: "ios", osVersi: 15 }));
cek("Chrome di iOS tetap dicatat mesin Safari/iOS 17", sama(p.kategoriPerangkat(UA.chromeIos), { browser: "safari", versi: 17, os: "ios", osVersi: 17 }));
cek("WebView Android (mis. tautan dari WA) → webview", p.kategoriPerangkat(UA.waWebview).browser === "webview" && p.kategoriPerangkat(UA.waWebview).versi === 118);
cek("Browser dalam aplikasi Facebook → webview", p.kategoriPerangkat(UA.fbApp).browser === "webview");
cek("Firefox Windows", sama(p.kategoriPerangkat(UA.firefoxWin), { browser: "firefox", versi: 130, os: "windows", osVersi: 0 }));
cek("Edge dibedakan dari Chrome", p.kategoriPerangkat(UA.edgeWin).browser === "edge");
cek("Safari macOS 16.3", sama(p.kategoriPerangkat(UA.safariMac), { browser: "safari", versi: 16, os: "macos", osVersi: 0 }));
cek("UA kosong/aneh → lain, angka 0", sama(p.kategoriPerangkat(""), { browser: "lain", versi: 0, os: "lain", osVersi: 0 }));
cek("versi absurd dibatasi (tak bisa jadi data liar)", p.kategoriPerangkat("Chrome/99999999 Android 12345").versi === 0);
const semua = Object.values(UA).map((u) => p.kategoriPerangkat(u));
cek("hasil hanya dari daftar tertutup", semua.every((h) =>
  p.BROWSER.includes(h.browser) && p.OS.includes(h.os) && Number.isInteger(h.versi) && Number.isInteger(h.osVersi)));
cek("hasil TIDAK memuat potongan UA (model perangkat dsb.)",
  !JSON.stringify(semua).match(/SM-A|ASUS|RMX|Mozilla|FBAN/));

console.log("\nPersetujuan & frekuensi:");
cek("Do Not Track = 1 → tidak lapor", p.bolehLapor({ doNotTrack: "1" }) === false);
cek("Global Privacy Control → tidak lapor", p.bolehLapor({ gpc: true }) === false);
cek("tanpa sinyal → boleh lapor", p.bolehLapor({ doNotTrack: null, gpc: false }) === true);
cek("sudah lapor hari ini → tidak lagi", p.perluLapor("2026-10-21", "2026-10-21") === false);
cek("hari berganti → lapor lagi", p.perluLapor("2026-10-20", "2026-10-21") === true);

console.log(`\n=== ${lulus}/${lulus + gagal.length} lulus ===`);
if (gagal.length) process.exit(1);
