import "server-only";
import { endpointKirim, interpretasiWaha, keChatId } from "./waha-parse";

export type SendResult = { ok: true; dryRun: boolean } | { ok: false; error: string };

/**
 * Kirim WhatsApp lewat WAHA (https://waha.devlike.pro) — WhatsApp HTTP API
 * yang di-hosting sendiri.
 *
 * Env:
 *   WA_GATEWAY_URL   = URL dasar instance WAHA, mis. https://waha.contoh.com
 *   WA_GATEWAY_TOKEN = nilai header X-Api-Key
 *   WA_SESSION       = nama sesi WAHA (opsional, default "default")
 *
 * Bila WA_GATEWAY_URL/TOKEN belum diset (dev lokal), jalan mode DRY-RUN:
 * pesan hanya dicetak ke log dan alur tetap bisa diuji tanpa WAHA asli.
 *
 * Berbeda dari Fonnte, WAHA memakai kode HTTP yang benar (422 = sesi belum
 * WORKING, 401 = X-Api-Key salah), tetapi kita tetap membaca body untuk
 * pesan galat yang bermanfaat — lihat `waha-parse.ts`.
 */
export async function sendWhatsApp(
  phone: string,
  body: string,
): Promise<SendResult> {
  const url = process.env.WA_GATEWAY_URL;
  const token = process.env.WA_GATEWAY_TOKEN;
  const session = process.env.WA_SESSION || "default";

  if (!url || !token) {
    console.info(`[WA dry-run] → ${phone}: ${body.slice(0, 120)}`);
    return { ok: true, dryRun: true };
  }

  try {
    const res = await fetch(endpointKirim(url), {
      method: "POST",
      headers: {
        "X-Api-Key": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ session, chatId: keChatId(phone), text: body }),
      signal: AbortSignal.timeout(15_000),
    });

    const hasil = interpretasiWaha(res.status, await res.text());
    return hasil.ok
      ? { ok: true, dryRun: false }
      : { ok: false, error: hasil.error };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Gagal menghubungi WAHA",
    };
  }
}
