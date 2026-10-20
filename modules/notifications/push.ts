import "server-only";
import webpush from "web-push";
import type { IsiPush } from "./push-content";

/**
 * Kirim Web Push (VAPID). Env:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY — pasangan kunci
 *     (buat: `npx web-push generate-vapid-keys`)
 *   VAPID_SUBJECT — mailto: kontak pengelola (wajib menurut standar VAPID)
 * Tanpa kunci, push mati total: tombol aktivasi di aplikasi tersembunyi.
 */
export function pushAktif(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT
  );
}

let siap = false;
function siapkan() {
  if (siap) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  siap = true;
}

export type Langganan = { endpoint: string; p256dh: string; auth: string };

export type HasilPush =
  | { endpoint: string; ok: true }
  | { endpoint: string; ok: false; kedaluwarsa: boolean; error: string };

/**
 * Galat jaringan Node kerap ber-`message` kosong — mis. AggregateError saat
 * semua alamat (IPv6 & IPv4) menolak koneksi. Ambil kode dari dalamnya agar
 * kolom last_error tak kosong.
 */
function alasanGalat(e: unknown): string {
  const g = e as { message?: string; code?: string; errors?: { code?: string; message?: string }[] };
  return (
    g?.message ||
    g?.code ||
    g?.errors?.map((x) => x.code || x.message).filter(Boolean).join(", ") ||
    "Gagal kirim push"
  );
}

export async function kirimPush(langganan: Langganan[], isi: IsiPush): Promise<HasilPush[]> {
  siapkan();
  const muatan = JSON.stringify(isi);
  return Promise.all(
    langganan.map(async (s): Promise<HasilPush> => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          muatan,
          { TTL: 60 * 60 * 24, timeout: 15_000 },
        );
        return { endpoint: s.endpoint, ok: true };
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        return {
          endpoint: s.endpoint,
          ok: false,
          // 404/410 = langganan sudah dicabut browser → hapus dari DB
          kedaluwarsa: status === 404 || status === 410,
          error: status ? `HTTP ${status}` : alasanGalat(e),
        };
      }
    }),
  );
}
