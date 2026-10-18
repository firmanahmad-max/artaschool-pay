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
