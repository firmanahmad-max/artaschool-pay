import "server-only";
import { interpretasiFonnte } from "./fonnte-parse";

export type SendResult = { ok: true; dryRun: boolean } | { ok: false; error: string };

/**
 * Kirim WhatsApp lewat gateway Fonnte (https://api.fonnte.com/send).
 *
 * Bila WA_GATEWAY_URL/TOKEN belum diset (dev lokal), jalan mode DRY-RUN:
 * pesan hanya dicetak ke log dan alur tetap bisa diuji tanpa gateway asli.
 *
 * DUA HAL PENTING soal API Fonnte, yang sempat salah di versi awal:
 * 1. Body dikirim sebagai FORM (x-www-form-urlencoded), BUKAN JSON.
 * 2. Fonnte selalu membalas HTTP 200 — sukses/gagal ada di field `status`
 *    pada body JSON. Token salah / device terputus / kuota habis tetap
 *    HTTP 200 dengan `status:false`. Karena itu kita WAJIB membaca body;
 *    hanya mengecek `res.ok` akan mencatat kegagalan sebagai terkirim.
 */
export async function sendWhatsApp(
  phone: string,
  body: string,
): Promise<SendResult> {
  const url = process.env.WA_GATEWAY_URL;
  const token = process.env.WA_GATEWAY_TOKEN;

  if (!url || !token) {
    console.info(`[WA dry-run] → ${phone}: ${body.slice(0, 120)}`);
    return { ok: true, dryRun: true };
  }

  // Fonnte: target tanpa "+", biarkan awalan 62 (nomor kita sudah +62…)
  const target = phone.replace(/^\+/, "");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ target, message: body }).toString(),
      signal: AbortSignal.timeout(15_000),
    });

    const hasil = interpretasiFonnte(res.status, await res.text());
    return hasil.ok
      ? { ok: true, dryRun: false }
      : { ok: false, error: hasil.error };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Gagal menghubungi gateway",
    };
  }
}
