/**
 * Tautan click-to-chat WhatsApp (https://wa.me) — untuk mode semi-otomatis:
 * sistem menyiapkan pesan, admin yang menekan Kirim di aplikasi WhatsApp.
 * Fungsi murni; diuji `npm run test:gateway`.
 */

/** "+62 812-3456" / "0812…" / "62812…" → "62812…" (hanya angka, kode negara). */
export function nomorWa(phone: string): string {
  const angka = phone.replace(/\D/g, "");
  if (angka.startsWith("0")) return `62${angka.slice(1)}`;
  return angka;
}

export function tautanWa(phone: string, teks: string): string {
  return `https://wa.me/${nomorWa(phone)}?text=${encodeURIComponent(teks)}`;
}
