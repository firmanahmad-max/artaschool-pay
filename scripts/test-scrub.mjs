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
const { samarkanTeks, samarkanObjek, saringEventSentry } = await import(
  "file://" + file.replace(/\\/g, "/")
);

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

const total = lulus + gagal.length;
console.log(`\n=== ${lulus}/${total} lulus ===`);
if (gagal.length) {
  console.error("\nADA KEBOCORAN:");
  for (const g of gagal) console.error(`  ${g.nama}: ${JSON.stringify(g.hasil).slice(0, 160)}`);
  process.exit(1);
}
console.log("Tidak ada data pribadi yang lolos ke laporan error.\n");
