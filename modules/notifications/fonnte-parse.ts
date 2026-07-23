/**
 * Interpretasi respons Fonnte — fungsi MURNI (tanpa jaringan / server-only)
 * agar bisa diuji langsung di CI. Di sinilah inti perbaikan bug: Fonnte
 * membalas HTTP 200 bahkan saat gagal, jadi sukses ditentukan oleh field
 * `status` pada body, bukan kode HTTP.
 */
export type HasilFonnte =
  | { ok: true }
  | { ok: false; error: string; ulangi: boolean };

export function interpretasiFonnte(
  httpStatus: number,
  bodyTeks: string,
): HasilFonnte {
  // 5xx = gangguan transport → layak diulang worker
  if (httpStatus >= 500) {
    return { ok: false, error: `Gateway HTTP ${httpStatus}`, ulangi: true };
  }

  type RespFonnte = { status?: boolean; reason?: string; detail?: string };
  let data: RespFonnte | null = null;
  try {
    data = JSON.parse(bodyTeks) as RespFonnte;
  } catch {
    return {
      ok: false,
      error: `Respons gateway tak terbaca: ${bodyTeks.slice(0, 120)}`,
      ulangi: true,
    };
  }

  if (data?.status === true) return { ok: true };

  const alasan = data?.reason ?? data?.detail ?? "alasan tak diketahui";
  // Token invalid / kuota habis tidak akan membaik dengan diulang; tapi biarkan
  // worker mencoba beberapa kali lalu masuk dead-letter — lebih aman daripada
  // menyerah pada gangguan sesaat yang kebetulan berbunyi mirip.
  return { ok: false, error: `Gateway menolak: ${alasan}`, ulangi: true };
}
