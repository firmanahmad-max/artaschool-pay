/**
 * Uji kredensial gateway WhatsApp sungguhan — jalankan SETELAH mengisi
 * WA_GATEWAY_URL & WA_GATEWAY_TOKEN di .env.local.
 *
 *   node scripts/cek-wa-gateway.mjs "+62812xxxxxxxx"
 *
 * Argumen: nomor tujuan uji (biasanya nomor Anda sendiri). Skrip mengirim satu
 * pesan nyata dan menerjemahkan respons Fonnte menjadi diagnosa yang jelas.
 */
import { readFileSync, existsSync } from "node:fs";

if (existsSync(".env.local")) {
  for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const url = process.env.WA_GATEWAY_URL;
const token = process.env.WA_GATEWAY_TOKEN;
const tujuan = process.argv[2];

if (!url || !token) {
  console.error(
    "\nWA_GATEWAY_URL / WA_GATEWAY_TOKEN belum diisi di .env.local.\n" +
      "Isi dulu keduanya, lalu jalankan ulang.\n",
  );
  process.exit(1);
}
if (!tujuan || !/^\+?\d{8,15}$/.test(tujuan.replace(/[\s-]/g, ""))) {
  console.error('\nSertakan nomor tujuan uji, mis:\n  node scripts/cek-wa-gateway.mjs "+6281234567890"\n');
  process.exit(1);
}

const target = tujuan.replace(/[\s-]/g, "").replace(/^\+/, "");
console.log(`\nMengirim pesan uji ke ${target} lewat ${url} …\n`);

try {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      target,
      message:
        "Uji koneksi ArtaSchool Pay. Bila Anda menerima pesan ini, gateway WhatsApp sudah siap.",
    }).toString(),
    signal: AbortSignal.timeout(20_000),
  });

  const teks = await res.text();
  let data;
  try {
    data = JSON.parse(teks);
  } catch {
    console.error(`Respons bukan JSON (HTTP ${res.status}):\n${teks.slice(0, 300)}\n`);
    console.error("→ Periksa apakah WA_GATEWAY_URL benar (harus https://api.fonnte.com/send).");
    process.exit(1);
  }

  if (data.status === true) {
    console.log("✓ BERHASIL — pesan masuk antrean gateway.");
    console.log(`  detail : ${data.detail ?? "-"}`);
    console.log(`  id     : ${JSON.stringify(data.id ?? [])}`);
    console.log("\nCek ponsel tujuan. Bila pesan tiba, kredensial siap dipakai produksi.\n");
    process.exit(0);
  }

  console.error(`✗ DITOLAK gateway: ${data.reason ?? data.detail ?? "alasan tak diketahui"}\n`);
  const petunjuk = {
    "token invalid": "Token salah/kedaluwarsa. Salin ulang dari dashboard Fonnte → Device.",
    "invalid target": "Format nomor tujuan salah. Pakai 62… (tanpa + dan tanpa 0 di depan).",
    "insufficient quota": "Kuota/saldo Fonnte habis. Isi ulang di dashboard.",
  };
  const r = String(data.reason ?? "").toLowerCase();
  for (const [k, v] of Object.entries(petunjuk)) if (r.includes(k)) console.error("→ " + v + "\n");
  if (r.includes("disconnect") || r.includes("not connected")) {
    console.error("→ Nomor WhatsApp device belum tersambung. Scan ulang QR di dashboard Fonnte.\n");
  }
  process.exit(1);
} catch (e) {
  console.error(`✗ Gagal menghubungi gateway: ${e instanceof Error ? e.message : e}\n`);
  console.error("→ Periksa koneksi internet dan nilai WA_GATEWAY_URL.\n");
  process.exit(1);
}
