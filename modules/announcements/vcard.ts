/**
 * Ekspor kontak wali ke vCard 3.0 — diimpor ke ponsel sekolah agar bisa
 * membuat Daftar Siaran WhatsApp (pengumuman ke banyak wali tanpa gateway).
 * Fungsi murni; diuji `npm run test:gateway`.
 */

export type KontakWali = {
  nama: string;
  phone: string;
  /** mis. "Wali Putu Adi Wijaya (1A)" — membantu admin mengenali kontak. */
  keterangan?: string;
};

/** Escape nilai teks vCard (RFC 6350 §3.4): \ , ; dan baris baru. */
export function escapeVcard(nilai: string): string {
  return nilai
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function buatVcard(kontak: KontakWali[]): string {
  return kontak
    .map((k) => {
      const tampil = k.keterangan ? `${k.nama} — ${k.keterangan}` : k.nama;
      return [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `N:${escapeVcard(k.nama)};;;;`,
        `FN:${escapeVcard(tampil)}`,
        `TEL;TYPE=CELL:${k.phone.replace(/[^\d+]/g, "")}`,
        "END:VCARD",
      ].join("\r\n");
    })
    .join("\r\n")
    .concat(kontak.length ? "\r\n" : "");
}
