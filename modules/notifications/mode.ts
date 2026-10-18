import "server-only";

/**
 * Cara pesan WhatsApp keluar dari sistem.
 *
 * - "gateway": dikirim otomatis lewat WAHA (WA_GATEWAY_URL + TOKEN terisi).
 * - "manual" : TIDAK ada gateway. Pesan menunggu di Kotak Keluar WA; admin
 *              mengirimnya sendiri lewat tautan wa.me. Login wali memakai
 *              kode aktivasi + PIN (OTP WA tidak tersedia).
 * - "dry-run": khusus pengembangan — pesan hanya dicetak ke log.
 *
 * Bisa dipaksa lewat env WA_MODE. Tanpa itu: ada gateway → "gateway";
 * produksi tanpa gateway → "manual" (BUKAN dry-run: dry-run diam-diam
 * menandai pesan "terkirim" dan mencetak OTP ke log server).
 */
export type WaMode = "gateway" | "manual" | "dry-run";

export function waMode(): WaMode {
  const paksa = process.env.WA_MODE;
  if (paksa === "gateway" || paksa === "manual" || paksa === "dry-run") {
    return paksa;
  }
  if (process.env.WA_GATEWAY_URL && process.env.WA_GATEWAY_TOKEN) {
    return "gateway";
  }
  return process.env.NODE_ENV === "production" ? "manual" : "dry-run";
}

/** Login dengan kode OTP WhatsApp hanya mungkin bila ada yang mengirim OTP. */
export function otpWaTersedia(): boolean {
  return waMode() !== "manual";
}
