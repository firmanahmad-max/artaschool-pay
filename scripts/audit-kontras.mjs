/**
 * Audit kontras WCAG 2.1 AA (PRD §8; risiko yang ditandai PRD §2.2).
 *
 *   npm run audit:kontras
 *
 * Memeriksa setiap pasangan teks/latar yang benar-benar dipakai komponen, di
 * KEDUA tema. Badge dark-mode memakai latar transparan (mis. amber-500/15),
 * sehingga warnanya dikomposit dulu di atas --surface sebelum diukur.
 *
 * Ambang AA: 4.5:1 teks normal, 3:1 teks besar/bold >=18.66px.
 */

// Palet Tailwind yang dipakai (nilai default Tailwind v3)
const T = {
  "amber-100": "#fef3c7", "amber-300": "#fcd34d", "amber-500": "#f59e0b", "amber-700": "#b45309",
  "emerald-100": "#d1fae5", "emerald-300": "#6ee7b7", "emerald-500": "#10b981", "emerald-700": "#047857",
  "red-100": "#fee2e2", "red-300": "#fca5a5", "red-400": "#f87171", "red-500": "#ef4444",
  "red-600": "#dc2626", "red-700": "#b91c1c",
  "orange-100": "#ffedd5", "orange-300": "#fdba74", "orange-500": "#f97316", "orange-700": "#c2410c",
  "sky-100": "#e0f2fe", "sky-300": "#7dd3fc", "sky-500": "#0ea5e9", "sky-700": "#0369a1",
  "violet-100": "#ede9fe", "violet-300": "#c4b5fd", "violet-500": "#8b5cf6", "violet-700": "#6d28d9",
  "amber-950": "#451a03",
};

// Token tema (app/globals.css)
const TEMA = {
  terang: {
    background: "#f7f7fb", surface: "#ffffff", foreground: "#0f172a",
    // digelapkan dari #64748b (PRD §7.4) demi ambang AA — lihat globals.css
    "muted-foreground": "#475569", border: "#e2e8f0",
    primary: "#4f46e5", "primary-foreground": "#ffffff",
  },
  gelap: {
    background: "#0b0e1a", surface: "#151a2c", foreground: "#e2e8f0",
    "muted-foreground": "#94a3b8", border: "#293045",
    primary: "#818cf8", "primary-foreground": "#0b0e1a",
  },
};

const hex = (c) => {
  const h = c.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};

/** Komposit warna ber-alpha di atas latar (untuk kelas seperti amber-500/15). */
const komposit = (fg, alpha, bg) => {
  const a = hex(fg), b = hex(bg);
  return a.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)));
};

const luminansi = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const rasio = (fg, bg) => {
  const a = luminansi(Array.isArray(fg) ? fg : hex(fg));
  const b = luminansi(Array.isArray(bg) ? bg : hex(bg));
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
};

const gagal = [];
let diperiksa = 0;

function cek(label, tema, fg, bg, ambang = 4.5) {
  diperiksa++;
  const r = rasio(fg, bg);
  const lulus = r >= ambang;
  if (!lulus) gagal.push({ label, tema, rasio: r, ambang });
  const tanda = lulus ? "  OK  " : " GAGAL";
  console.log(`${tanda} ${r.toFixed(2).padStart(5)}:1  (min ${ambang})  ${tema.padEnd(6)} ${label}`);
}

console.log("\n=== Audit kontras WCAG AA ===\n");

// ── Badge status pembayaran (components/ui/status-badge.tsx) ────────────────
console.log("Badge status pembayaran (teks kecil → ambang 4.5):");
const badgePembayaran = [
  ["Menunggu", "amber-700", "amber-100", "amber-300", "amber-500"],
  ["Disetujui", "emerald-700", "emerald-100", "emerald-300", "emerald-500"],
  ["Ditolak", "red-700", "red-100", "red-300", "red-500"],
  ["Perlu Revisi", "orange-700", "orange-100", "orange-300", "orange-500"],
];
for (const [nama, fgT, bgT, fgG, bgG] of badgePembayaran) {
  cek(`badge ${nama}`, "terang", T[fgT], T[bgT]);
  cek(`badge ${nama}`, "gelap", T[fgG], komposit(T[bgG], 0.15, TEMA.gelap.surface));
}

// ── Badge status tagihan (components/ui/bill-status-badge.tsx) ──────────────
console.log("\nBadge status tagihan:");
const badgeTagihan = [
  ["Belum Bayar", "amber-700", "amber-100", "amber-300", "amber-500"],
  ["Sebagian", "sky-700", "sky-100", "sky-300", "sky-500"],
  ["Lunas", "emerald-700", "emerald-100", "emerald-300", "emerald-500"],
  ["Dibebaskan", "violet-700", "violet-100", "violet-300", "violet-500"],
];
for (const [nama, fgT, bgT, fgG, bgG] of badgeTagihan) {
  cek(`tagihan ${nama}`, "terang", T[fgT], T[bgT]);
  cek(`tagihan ${nama}`, "gelap", T[fgG], komposit(T[bgG], 0.15, TEMA.gelap.surface));
}
// "Dibatalkan" memakai token border/muted-foreground
cek("tagihan Dibatalkan", "terang", TEMA.terang["muted-foreground"], TEMA.terang.border);
cek("tagihan Dibatalkan", "gelap", TEMA.gelap["muted-foreground"], TEMA.gelap.border);

// ── Teks & tombol utama ─────────────────────────────────────────────────────
console.log("\nTeks dan tombol:");
for (const [nama, tokens] of Object.entries(TEMA)) {
  cek("teks utama di surface", nama, tokens.foreground, tokens.surface);
  cek("teks utama di background", nama, tokens.foreground, tokens.background);
  cek("teks sekunder di surface", nama, tokens["muted-foreground"], tokens.surface);
  cek("teks sekunder di background", nama, tokens["muted-foreground"], tokens.background);
  cek("tombol primary", nama, tokens["primary-foreground"], tokens.primary);
  cek("tautan/primary di surface", nama, tokens.primary, tokens.surface);
}

// ── Pesan galat & indikator ─────────────────────────────────────────────────
console.log("\nPesan galat & indikator:");
cek("teks galat", "terang", T["red-600"], TEMA.terang.surface);
cek("teks galat", "gelap", T["red-400"], TEMA.gelap.surface);
cek("banner offline", "terang", T["amber-950"], T["amber-500"]);

console.log(`\n=== ${diperiksa - gagal.length}/${diperiksa} lulus ===`);
if (gagal.length) {
  console.error("\nDI BAWAH AMBANG AA:");
  for (const g of gagal) {
    console.error(`  ${g.tema.padEnd(6)} ${g.label} — ${g.rasio.toFixed(2)}:1 (butuh ${g.ambang})`);
  }
  process.exit(1);
}
console.log("Semua pasangan warna memenuhi WCAG AA.\n");
