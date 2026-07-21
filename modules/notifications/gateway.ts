import "server-only";

export type SendResult = { ok: true; dryRun: boolean } | { ok: false; error: string };

/**
 * Kirim WhatsApp lewat gateway (Fonnte/Wablas).
 * Bila WA_GATEWAY_URL/TOKEN belum diset (dev lokal), jalan mode DRY-RUN:
 * job tetap ditandai terkirim agar alur bisa diuji tanpa gateway asli.
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

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      // Format Fonnte: { target, message }
      body: JSON.stringify({ target: phone.replace(/^\+/, ""), message: body }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return { ok: false, error: `Gateway HTTP ${res.status}` };
    }
    return { ok: true, dryRun: false };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal mengirim" };
  }
}
