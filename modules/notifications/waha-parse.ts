/**
 * Interpretasi respons WAHA (https://waha.devlike.pro) — fungsi MURNI (tanpa
 * jaringan / server-only) agar bisa diuji langsung di CI.
 *
 * Berbeda dari Fonnte, WAHA memakai KODE HTTP yang benar:
 *   2xx → terkirim
 *   401 → X-Api-Key salah
 *   422 → sesi belum siap (SCAN_QR_CODE / STOPPED) — perlu scan QR / start ulang
 *   5xx → gangguan server WAHA (self-hosted)
 * Namun body tetap dibaca untuk mengambil pesan galat yang bermanfaat.
 */
export type HasilWaha =
  | { ok: true }
  | { ok: false; error: string; ulangi: boolean };

/** Ambil pesan galat dari body WAHA (NestJS: { message, error, statusCode }). */
function pesanGalat(bodyTeks: string): string | null {
  try {
    const d = JSON.parse(bodyTeks) as { message?: unknown; error?: unknown };
    const m = d.message ?? d.error;
    if (Array.isArray(m)) return m.join("; ");
    if (typeof m === "string") return m;
  } catch {
    /* body bukan JSON */
  }
  return null;
}

export function interpretasiWaha(
  httpStatus: number,
  bodyTeks: string,
): HasilWaha {
  if (httpStatus >= 200 && httpStatus < 300) {
    return { ok: true };
  }

  const galat = pesanGalat(bodyTeks);

  if (httpStatus === 401 || httpStatus === 403) {
    return {
      ok: false,
      error: `X-Api-Key ditolak WAHA${galat ? `: ${galat}` : ""}`,
      // kunci salah tak membaik dengan diulang; tetap biarkan worker retry →
      // dead-letter agar tercatat, tidak menyerah pada gangguan sesaat mirip
      ulangi: true,
    };
  }

  if (httpStatus === 422) {
    return {
      ok: false,
      error: `Sesi WhatsApp belum siap${galat ? `: ${galat}` : " (perlu scan QR / start sesi)"}`,
      // sesi bisa pulih (reconnect) → layak diulang
      ulangi: true,
    };
  }

  if (httpStatus >= 500) {
    return { ok: false, error: `WAHA HTTP ${httpStatus}`, ulangi: true };
  }

  return {
    ok: false,
    error: `WAHA menolak (HTTP ${httpStatus})${galat ? `: ${galat}` : ""}`,
    ulangi: true,
  };
}

/** Nomor +62… → chatId WAHA "62…@c.us". */
export function keChatId(phone: string): string {
  const digit = phone.replace(/[^\d]/g, "");
  return `${digit}@c.us`;
}

/** URL dasar WAHA (mis. https://waha.contoh.com) → endpoint kirim teks. */
export function endpointKirim(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "") + "/api/sendText";
}
