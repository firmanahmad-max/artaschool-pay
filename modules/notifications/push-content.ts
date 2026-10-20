/**
 * Isi notifikasi push dari job antrean. Fungsi murni; diuji `npm run test:gateway`.
 * Teks dibatasi pendek — layar kunci ponsel memotong teks panjang.
 */

export type IsiPush = { title: string; body: string; url: string };

const JUDUL: Record<string, string> = {
  "payment.approved": "Pembayaran disetujui ✅",
  "payment.needs_revision": "Pembayaran perlu revisi",
  "payment.rejected": "Pembayaran ditolak",
  announcement: "Pengumuman sekolah",
};

const MAKS_BODY = 180;

/** Hanya path internal (/…) yang diizinkan — cegah tautan ke situs luar. */
function urlAman(url: string): string {
  return /^\/(?!\/)/.test(url) ? url : "/beranda";
}

export function isiPush(
  template: string,
  body: string,
  payload: Record<string, unknown> | null | undefined,
): IsiPush {
  const paymentId = typeof payload?.payment_id === "string" ? payload.payment_id : null;
  const url = template.startsWith("payment.")
    ? paymentId && /^[0-9a-f-]{36}$/i.test(paymentId)
      ? `/riwayat/${paymentId}`
      : "/riwayat"
    : template === "announcement"
      ? "/pengumuman"
      : "/beranda";

  // Teks pengumuman diawali "[Pengumuman] " untuk WA; di push, judul sudah cukup.
  const bersih = body.replace(/^\[Pengumuman\]\s*/, "");
  return {
    title: JUDUL[template] ?? "ArtaSchool Pay",
    body: bersih.length > MAKS_BODY ? `${bersih.slice(0, MAKS_BODY - 1)}…` : bersih,
    url: urlAman(url),
  };
}

/** Kunci publik VAPID (base64url) → Uint8Array untuk pushManager.subscribe. */
export function base64UrlKeUint8(base64Url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const b64 = (base64Url + pad).replace(/-/g, "+").replace(/_/g, "/");
  const biner = atob(b64);
  // Dibangun dari ArrayBuffer agar cocok dgn tipe BufferSource pushManager.subscribe.
  const hasil = new Uint8Array(new ArrayBuffer(biner.length));
  for (let i = 0; i < biner.length; i++) hasil[i] = biner.charCodeAt(i);
  return hasil;
}
