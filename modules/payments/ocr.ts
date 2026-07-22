import "server-only";

/**
 * OCR bukti transfer (PRD §9 v2) — mengisi otomatis nominal/bank/tanggal
 * sehingga orang tua tidak perlu mengetik ulang.
 *
 * Adapter, bukan integrasi keras: tanpa `OCR_API_URL`/`OCR_API_KEY`, fungsi
 * mengembalikan `null` dan form tetap manual — persis pola gateway WA. Ini
 * membuat OCR bisa dinyalakan belakangan tanpa menyentuh kode alur upload.
 *
 * PENTING: hasil OCR HANYA saran untuk mengisi form. Angka yang mengikat
 * tetap yang dikonfirmasi orang tua lalu diverifikasi admin — OCR tidak
 * pernah menjadi sumber kebenaran nominal.
 */
export type OcrHint = {
  amount?: number;
  bankName?: string;
  transferredAt?: string; // ISO date (YYYY-MM-DD)
  senderName?: string;
  confidence?: number;
};

export function isOcrEnabled(): boolean {
  return Boolean(process.env.OCR_API_URL && process.env.OCR_API_KEY);
}

/** Ubah "Rp 1.250.000" / "1,250,000.00" menjadi 1250000 (integer rupiah). */
export function parseRupiah(raw: string): number | undefined {
  const digits = raw.replace(/[^\d.,]/g, "");
  if (!digits) return undefined;
  // Buang pemisah ribuan (titik ID / koma EN) dan desimal di belakang
  const normalized = digits.replace(/[.,](?=\d{3}\b)/g, "").replace(/[.,]\d{1,2}$/, "");
  const n = Number(normalized.replace(/[.,]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

/**
 * Kirim berkas bukti ke layanan OCR. Selalu "best effort": kegagalan apa pun
 * mengembalikan null agar upload tidak pernah terhambat oleh OCR.
 */
export async function extractProofHints(
  bytes: Uint8Array,
  mime: string,
): Promise<OcrHint | null> {
  if (!isOcrEnabled()) return null;

  try {
    const form = new FormData();
    form.append("file", new Blob([bytes as unknown as BlobPart], { type: mime }), "proof");

    const res = await fetch(process.env.OCR_API_URL!, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OCR_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;

    const json = (await res.json()) as Record<string, unknown>;
    const hint: OcrHint = {};

    if (typeof json.amount === "number") hint.amount = Math.round(json.amount);
    else if (typeof json.amount === "string") hint.amount = parseRupiah(json.amount);

    if (typeof json.bank === "string") hint.bankName = json.bank.trim();
    if (typeof json.sender_name === "string") hint.senderName = json.sender_name.trim();
    if (typeof json.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(json.date)) {
      hint.transferredAt = json.date.slice(0, 10);
    }
    if (typeof json.confidence === "number") hint.confidence = json.confidence;

    return Object.keys(hint).length > 0 ? hint : null;
  } catch {
    return null; // OCR tidak pernah menggagalkan upload
  }
}
