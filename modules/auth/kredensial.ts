/**
 * Fungsi murni seputar kredensial wali (OTP, PIN, kode aktivasi).
 * Tanpa impor server — diuji langsung oleh `npm run test:auth`.
 */

/** Default masa berlaku OTP SMS di Supabase (GoTrue): 60 detik. */
const OTP_DEFAULT_DETIK = 60;

/**
 * Masa berlaku OTP yang SEBENARNYA, dari env `SMS_OTP_EXPIRY_SECONDS`.
 * Nilai ini harus sama dengan "SMS OTP Expiry" di dashboard Supabase — kalau
 * tidak, pesan ke wali menjanjikan durasi yang salah.
 */
export function masaBerlakuOtpDetik(raw?: string | null): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 30 || n > 86_400) return OTP_DEFAULT_DETIK;
  return n;
}

/** 60 → "1 menit", 300 → "5 menit", 45 → "45 detik", 90 → "1 menit 30 detik". */
export function teksDurasi(detik: number): string {
  if (detik < 60) return `${detik} detik`;
  const menit = Math.floor(detik / 60);
  const sisa = detik % 60;
  return sisa === 0 ? `${menit} menit` : `${menit} menit ${sisa} detik`;
}

export function pesanOtp(otp: string, detik: number): string {
  return (
    `Kode masuk ArtaSchool Pay Anda: *${otp}*\n` +
    `Berlaku ${teksDurasi(detik)}. Jangan bagikan kode ini kepada siapa pun.`
  );
}

// ── PIN ─────────────────────────────────────────────────────────────────────

/**
 * Validasi PIN 6 angka. Mengembalikan pesan galat, atau null bila layak.
 * PIN mudah ditebak ditolak — penyerang yang tahu nomor HP tinggal menebak
 * PIN, dan batas laju hanya memperlambat, tidak menghentikan.
 */
export function validasiPin(pin: string): string | null {
  if (!/^\d{6}$/.test(pin)) return "PIN harus tepat 6 angka.";
  if (/^(\d)\1{5}$/.test(pin)) {
    return "PIN terlalu mudah ditebak (angka sama semua).";
  }
  // Termasuk yang "berputar", mis. 890123.
  if ("0123456789012345".includes(pin) || "9876543210987654".includes(pin)) {
    return "PIN terlalu mudah ditebak (angka berurutan).";
  }
  if (
    /^(\d\d)\1\1$/.test(pin) || // 121212
    /^(\d{3})\1$/.test(pin) || // 123123
    /^(\d)\1(\d)\2(\d)\3$/.test(pin) // 112233
  ) {
    return "PIN terlalu mudah ditebak (pola berulang).";
  }
  return null;
}

// ── Kode aktivasi ───────────────────────────────────────────────────────────

/** Sama dengan alfabet di issue_activation_code (019): tanpa I, L, O, 0, 1. */
export const ALFABET_KODE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** "abcd-efgh " → "ABCDEFGH". */
export function normalisasiKode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function kodeAktivasiValid(kode: string): boolean {
  return /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$/.test(kode);
}

/** "ABCDEFGH" → "ABCD-EFGH" (lebih mudah dibaca & didiktekan). */
export function formatKode(kode: string): string {
  return `${kode.slice(0, 4)}-${kode.slice(4)}`;
}

/** URL dasar aplikasi (tanpa garis miring akhir) → tautan langsung ke form aktivasi. */
export function urlAktivasi(base: string): string {
  return `${base.replace(/\/+$/, "")}/login?aktivasi=1`;
}

export function pesanAktivasi(opsi: {
  nama: string;
  kode: string;
  urlAktivasi: string;
}): string {
  return (
    `Yth. Bapak/Ibu ${opsi.nama},\n\n` +
    `Berikut kode aktivasi aplikasi pembayaran sekolah (ArtaSchool Pay):\n` +
    `*${formatKode(opsi.kode)}*  (berlaku 7 hari, sekali pakai)\n\n` +
    `Cara memakai:\n` +
    `1. Buka ${opsi.urlAktivasi}\n` +
    `2. Masukkan nomor HP ini dan kode di atas, lalu buat PIN 6 angka.\n\n` +
    `Setelah itu cukup masuk dengan nomor HP + PIN. ` +
    `Jangan bagikan kode ini kepada siapa pun.`
  );
}
