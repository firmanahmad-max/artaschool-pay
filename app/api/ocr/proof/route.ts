import { NextResponse, type NextRequest } from "next/server";
import { requireGuardian } from "@/modules/auth/guards";
import { extractProofHints, isOcrEnabled } from "@/modules/payments/ocr";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Saran isian dari bukti transfer (OCR). Dipanggil form upload SETELAH berkas
 * dipilih; hasilnya hanya mengisi form — orang tua tetap bisa mengubahnya.
 * Bila OCR belum dikonfigurasi, mengembalikan `enabled: false` dan form tetap
 * bekerja manual seperti biasa.
 */
export async function POST(request: NextRequest) {
  await requireGuardian();

  if (!isOcrEnabled()) {
    return NextResponse.json({ enabled: false, hint: null });
  }

  const form = await request.formData();
  const file = form.get("proof");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ enabled: true, hint: null });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const hint = await extractProofHints(bytes, file.type || "image/jpeg");

  return NextResponse.json({ enabled: true, hint });
}
