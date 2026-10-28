import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Otorisasi endpoint terjadwal (/api/jobs/*) dengan `CRON_SECRET`.
 *
 * Dua bentuk header diterima:
 *  - `Authorization: Bearer <CRON_SECRET>` — dikirim otomatis oleh Vercel
 *    Cron (memakai GET);
 *  - `x-cron-secret: <CRON_SECRET>` — penjadwal lain (pg_cron/pg_net di
 *    Supabase, cron-job.org) dan uji manual `curl`.
 *
 * Fungsi murni agar bisa diuji tanpa server (npm run test:cron).
 */
export type HasilCron = "ok" | "belum-dikonfigurasi" | "ditolak";

/** Bandingkan waktu-konstan; hash dulu agar panjang selalu sama. */
function sama(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function periksaCron(
  header: { authorization: string | null; xCronSecret: string | null },
  secret: string | undefined,
): HasilCron {
  if (!secret) return "belum-dikonfigurasi";

  const bearer = header.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const kandidat = [bearer, header.xCronSecret?.trim()].filter(
    (x): x is string => !!x,
  );
  return kandidat.some((k) => sama(k, secret)) ? "ok" : "ditolak";
}
