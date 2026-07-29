/**
 * Uji instance WAHA sungguhan — jalankan SETELAH mengisi WA_GATEWAY_URL &
 * WA_GATEWAY_TOKEN (dan opsional WA_SESSION) di .env.local.
 *
 *   node scripts/cek-wa-gateway.mjs "+62812xxxxxxxx"
 *
 * 1. Cek status sesi WAHA (masalah tersering: sesi belum di-scan / STOPPED).
 * 2. Bila WORKING, kirim satu pesan uji nyata ke nomor tujuan.
 * Respons diterjemahkan menjadi diagnosa yang jelas.
 */
import { readFileSync, existsSync } from "node:fs";

if (existsSync(".env.local")) {
  for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const base = (process.env.WA_GATEWAY_URL || "").replace(/\/+$/, "");
const token = process.env.WA_GATEWAY_TOKEN;
const session = process.env.WA_SESSION || "default";
const tujuan = process.argv[2];

if (!base || !token) {
  console.error(
    "\nWA_GATEWAY_URL / WA_GATEWAY_TOKEN belum diisi di .env.local.\n" +
      "  WA_GATEWAY_URL   = URL instance WAHA (mis. https://waha.contoh.com)\n" +
      "  WA_GATEWAY_TOKEN = nilai X-Api-Key\n",
  );
  process.exit(1);
}
if (!tujuan || !/^\+?\d{8,15}$/.test(tujuan.replace(/[\s-]/g, ""))) {
  console.error('\nSertakan nomor tujuan uji, mis:\n  node scripts/cek-wa-gateway.mjs "+6281234567890"\n');
  process.exit(1);
}

const H = { "X-Api-Key": token, "Content-Type": "application/json" };
const chatId = tujuan.replace(/[\s-]/g, "").replace(/^\+/, "") + "@c.us";

// ── 1. Status sesi ──────────────────────────────────────────────────────────
console.log(`\n[1] Memeriksa sesi "${session}" di ${base} …`);
let statusSesi;
try {
  const r = await fetch(`${base}/api/sessions/${session}`, { headers: H, signal: AbortSignal.timeout(15000) });
  if (r.status === 401 || r.status === 403) {
    console.error("  ✗ X-Api-Key ditolak. Periksa WA_GATEWAY_TOKEN.\n");
    process.exit(1);
  }
  if (r.status === 404) {
    console.error(`  ✗ Sesi "${session}" tidak ada. Buat & start dulu di dashboard WAHA,\n    atau set WA_SESSION ke nama sesi yang benar.\n`);
    process.exit(1);
  }
  const d = await r.json().catch(() => ({}));
  statusSesi = d.status;
  console.log(`  status sesi: ${statusSesi ?? "(tak diketahui)"}`);
  if (statusSesi && statusSesi !== "WORKING") {
    console.error(
      `  ✗ Sesi belum siap (butuh WORKING).\n` +
        (statusSesi === "SCAN_QR_CODE"
          ? "    → Buka dashboard WAHA dan scan QR dengan WhatsApp nomor gateway.\n"
          : statusSesi === "STOPPED"
            ? "    → Start sesi di dashboard WAHA, lalu scan QR bila diminta.\n"
            : "    → Tunggu sesi tersambung, atau start ulang di dashboard WAHA.\n"),
    );
    process.exit(1);
  }
} catch (e) {
  console.error(`  ✗ Gagal menghubungi WAHA: ${e instanceof Error ? e.message : e}`);
  console.error("    → Periksa WA_GATEWAY_URL dan apakah server WAHA berjalan.\n");
  process.exit(1);
}

// ── 2. Kirim pesan uji ──────────────────────────────────────────────────────
console.log(`\n[2] Mengirim pesan uji ke ${chatId} …`);
try {
  const r = await fetch(`${base}/api/sendText`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({
      session,
      chatId,
      text: "Uji koneksi ArtaSchool Pay. Bila Anda menerima pesan ini, gateway WhatsApp sudah siap.",
    }),
    signal: AbortSignal.timeout(20000),
  });
  const teks = await r.text();
  if (r.status >= 200 && r.status < 300) {
    console.log("  ✓ BERHASIL — WAHA menerima pesan.");
    console.log("\nCek ponsel tujuan. Bila pesan tiba, kredensial siap dipakai produksi.\n");
    process.exit(0);
  }
  let pesan = teks;
  try { const d = JSON.parse(teks); pesan = Array.isArray(d.message) ? d.message.join("; ") : (d.message ?? d.error ?? teks); } catch { /* biarkan */ }
  console.error(`  ✗ DITOLAK (HTTP ${r.status}): ${String(pesan).slice(0, 200)}\n`);
  if (r.status === 422) console.error("    → Sesi tidak lagi WORKING. Scan ulang QR di dashboard WAHA.\n");
  process.exit(1);
} catch (e) {
  console.error(`  ✗ Gagal mengirim: ${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
}
