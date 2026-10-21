/**
 * Uji penyaring data pribadi Sentry (PRD §8 / UU PDP).
 *
 *   npm run test:scrub
 *
 * Skenario diambil dari kebocoran yang benar-benar mungkin terjadi di aplikasi
 * ini: pesan galat RPC, path bukti transfer, signed URL, dan payload form.
 */
import { readFileSync } from "node:fs";
import { transpileModule, ModuleKind } from "typescript";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Transpile modul TS agar bisa diuji langsung tanpa build Next.js
const ts = readFileSync("lib/sentry-scrub.ts", "utf8");
const js = transpileModule(ts, { compilerOptions: { module: ModuleKind.ESNext } }).outputText;
const dir = mkdtempSync(join(tmpdir(), "scrub-"));
const file = join(dir, "scrub.mjs");
writeFileSync(file, js);
const { samarkanTeks, samarkanObjek, saringEventSentry, PENGUMPULAN_DATA_MINIMAL } =
  await import("file://" + file.replace(/\\/g, "/"));

let lulus = 0;
const gagal = [];

function cek(nama, hasil, tidakBolehMuat) {
  const bocor = tidakBolehMuat.filter((r) => String(hasil).includes(r));
  if (bocor.length === 0) {
    lulus++;
    console.log(`  OK    ${nama}`);
  } else {
    gagal.push({ nama, bocor, hasil });
    console.log(`  BOCOR ${nama} — masih memuat: ${bocor.join(", ")}`);
  }
}

console.log("\n=== Uji penyaring data pribadi ===\n");

console.log("Teks bebas (pesan galat):");
cek(
  "nomor HP wali di pesan galat",
  samarkanTeks("submit_payment gagal untuk wali +6281234567001"),
  ["+6281234567001", "6281234567001"],
);
cek(
  "nomor HP format 08",
  samarkanTeks("OTP gagal dikirim ke 081234567001"),
  ["081234567001"],
);
cek(
  "path bukti transfer",
  samarkanTeks(
    "upload gagal: 00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000031/3889ca9a-514d-45fd-b328-083c91623636.jpg",
  ),
  ["3889ca9a-514d-45fd-b328-083c91623636.jpg"],
);
cek(
  "token signed URL",
  samarkanTeks("GET /storage/v1/object/sign/payment-proofs/x.jpg?token=eyJhbGciOiJIUzI1NiJ9.abc"),
  ["eyJhbGciOiJIUzI1NiJ9.abc"],
);
cek(
  "email admin",
  samarkanTeks("login gagal untuk keuangan@pilot-uat.local"),
  ["keuangan@pilot-uat.local"],
);
cek(
  "service role key (JWT)",
  samarkanTeks("header: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.xyz"),
  ["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"],
);

console.log("\nObjek terstruktur (payload form / RPC):");
const payload = {
  student: { nis: "2026001", full_name: "Putu Adi Wijaya" },
  guardian: { phone: "+6281234567001" },
  payment: { amount: 850000, sender_name: "Made Wijaya", proof_path: "a/b/c.jpg" },
  catatan: "Transfer dari 081234567002 sebesar Rp 850.000",
};
const bersih = samarkanObjek(payload);
cek("NIS & nama siswa", JSON.stringify(bersih), ["2026001", "Putu Adi Wijaya"]);
cek("nomor HP di kunci phone", JSON.stringify(bersih), ["+6281234567001"]);
cek("nominal & nama pengirim", JSON.stringify(bersih), ["850000", "Made Wijaya"]);
cek("nomor HP di dalam teks bebas", JSON.stringify(bersih), ["081234567002"]);

console.log("\nEvent Sentry lengkap:");
const event = {
  message: "Gagal approve untuk +6281234567001",
  user: { id: "abc", email: "wali@contoh.com", ip_address: "1.2.3.4" },
  request: {
    url: "https://app/riwayat?token=rahasia123",
    cookies: { "sb-access-token": "eyJhbGciOi.abc" },
    headers: { authorization: "Bearer sk_live_12345678901" },
    data: { nis: "2026001" },
  },
  breadcrumbs: [{ message: "fetch /api/x?token=abc123def456" }],
};
const ev = saringEventSentry(event);
cek("identitas pengguna dibuang", JSON.stringify(ev), ["wali@contoh.com", "1.2.3.4"]);
cek("cookie & header dibuang", JSON.stringify(ev), ["sb-access-token", "Bearer sk_live"]);
cek("token di URL disamarkan", JSON.stringify(ev), ["rahasia123"]);
cek("token di breadcrumb disamarkan", JSON.stringify(ev), ["abc123def456"]);
cek("nomor HP di pesan", JSON.stringify(ev), ["+6281234567001"]);

console.log("\nTidak merusak informasi berguna:");
const berguna = samarkanTeks("Tagihan tidak ditemukan untuk periode 2026-09-01");
const infoUtuh = berguna.includes("Tagihan tidak ditemukan") && berguna.includes("2026-09-01");
if (infoUtuh) { lulus++; console.log("  OK    pesan diagnostik tetap terbaca"); }
else { gagal.push({ nama: "pesan diagnostik", hasil: berguna }); console.log("  GAGAL pesan diagnostik ikut tersamar: " + berguna); }

// Query string — kebocoran nyata yg ditemukan saat uji runtime Sentry v11:
// request.url & request.query_string membawa ?nama=…&nis=… ke Sentry.
console.log("\nQuery string di URL:");
const evQuery = saringEventSentry({
  request: {
    url: "https://pay.sekolah.id/admin/verifikasi?cari=Budi%20Santoso&status=pending",
    query_string: "cari=Budi%20Santoso&nis=2026001",
    env: { REMOTE_ADDR: "203.0.113.77" },
  },
  breadcrumbs: [{ category: "fetch", data: { url: "/admin/laporan?kelas=1A&dari=Siti%20Rahma" } }],
  transaction: "GET /admin/verifikasi?cari=Kadek%20Ayu",
});
cek("query di request.url disamarkan", JSON.stringify(evQuery), ["Budi", "Santoso", "pending"]);
cek("request.query_string dibuang", JSON.stringify(evQuery), ["2026001", "query_string"]);
cek("IP di request.env dibuang", JSON.stringify(evQuery), ["203.0.113.77"]);
cek("query di URL relatif breadcrumb disamarkan", JSON.stringify(evQuery), ["Siti", "Rahma"]);
cek("query di nama transaksi disamarkan", JSON.stringify(evQuery), ["Kadek"]);
const tetap = saringEventSentry({ request: { url: "https://pay.sekolah.id/admin/verifikasi" } });
cek("path tanpa query tetap utuh (konteks debug tak hilang)",
  JSON.stringify(tetap).includes("/admin/verifikasi") ? "ok" : "PATH-HILANG", ["PATH-HILANG"]);

// Lapis pertama: SDK tak boleh mengumpulkan data sejak awal. @sentry/nextjs v11
// menghapus `sendDefaultPii` dan default `dataCollection`-nya mengumpulkan
// cookie, header, query, body request (PIN/kode aktivasi) & variabel lokal.
console.log("\nKonfigurasi pengumpulan data Sentry (v11 dataCollection):");
cek("tak ada kategori data yang diaktifkan", JSON.stringify(PENGUMPULAN_DATA_MINIMAL), ["true"]);
cek("body request/response tak dikumpulkan", JSON.stringify(PENGUMPULAN_DATA_MINIMAL.httpBodies), ["incoming", "outgoing"]);
for (const kunci of ["userInfo", "cookies", "httpHeaders", "httpBodies", "urlQueryParams",
  "databaseQueryData", "stackFrameVariables"]) {
  cek(`kategori '${kunci}' disetel eksplisit (bukan default)`,
    kunci in PENGUMPULAN_DATA_MINIMAL ? "ada" : "HILANG", ["HILANG"]);
}
for (const berkas of ["sentry.server.config.ts", "sentry.edge.config.ts"]) {
  const isi = readFileSync(berkas, "utf8");
  cek(`${berkas} memakai dataCollection minimal`,
    isi.includes("dataCollection: PENGUMPULAN_DATA_MINIMAL") ? "ok" : "TIDAK-DIPAKAI", ["TIDAK-DIPAKAI"]);
  cek(`${berkas} menyaring transaksi juga`,
    isi.includes("beforeSendTransaction") ? "ok" : "TANPA-SARING", ["TANPA-SARING"]);
}
// SDK klien tak boleh ikut dibundel (rute orang tua <150 KB, PRD §8). Sejak
// v9+ SDK klien hanya disuntikkan bila berkas ini ada.
for (const berkas of ["instrumentation-client.ts", "instrumentation-client.js",
  "sentry.client.config.ts", "sentry.client.config.js"]) {
  let ada = false;
  try { readFileSync(berkas); ada = true; } catch {}
  cek(`tidak ada ${berkas}`, ada ? "ADA" : "tidak ada", ["ADA"]);
}

const total = lulus + gagal.length;
console.log(`\n=== ${lulus}/${total} lulus ===`);

if (gagal.length) {
  console.error("\nADA KEBOCORAN:");
  for (const g of gagal) console.error(`  ${g.nama}: ${JSON.stringify(g.hasil).slice(0, 160)}`);
  process.exit(1);
}
console.log("Tidak ada data pribadi yang lolos ke laporan error.\n");
