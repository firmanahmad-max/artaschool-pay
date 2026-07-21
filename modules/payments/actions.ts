"use server";

import { createHash, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireGuardian } from "@/modules/auth/guards";

export type SubmitResult =
  | { ok: true; paymentId: string }
  | { ok: false; error: string };

const MAX_BYTES = 5 * 1024 * 1024;

/** Deteksi tipe berkas dari magic bytes (bukan sekadar ekstensi) — PRD §6.3. */
function detectType(buf: Uint8Array): { mime: string; ext: string } | null {
  const b = buf;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { mime: "image/png", ext: "png" };
  }
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) {
    return { mime: "application/pdf", ext: "pdf" };
  }
  return null;
}

export async function submitPayment(formData: FormData): Promise<SubmitResult> {
  const guardian = await requireGuardian();

  const studentId = String(formData.get("student_id") ?? "");
  const amountRaw = String(formData.get("amount") ?? "");
  const method = String(formData.get("method") ?? "transfer");
  const bankName = String(formData.get("bank_name") ?? "").trim() || null;
  const senderName = String(formData.get("sender_name") ?? "").trim() || null;
  const transferredAt = String(formData.get("transferred_at") ?? "").trim() || null;
  const billIds = formData.getAll("bill_ids").map(String).filter(Boolean);
  const revisionOf = String(formData.get("revision_of") ?? "").trim() || null;
  const file = formData.get("proof");

  if (!studentId) return { ok: false, error: "Pilih anak terlebih dahulu." };

  // Rate limit upload: 10 per jam per akun wali (PRD §6.4)
  const limiter = createAdminClient();
  const { data: allowed } = await limiter.rpc("check_rate_limit", {
    p_bucket: `upload:${guardian.id}`,
    p_max: 10,
    p_window_seconds: 3600,
  });
  if (allowed === false) {
    return {
      ok: false,
      error:
        "Terlalu banyak unggahan dalam satu jam. Coba lagi nanti atau hubungi sekolah.",
    };
  }

  const amount = Number(amountRaw);
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, error: "Nominal harus bilangan bulat lebih dari 0." };
  }
  if (billIds.length === 0) {
    return { ok: false, error: "Pilih minimal satu tagihan yang dibayar." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Lampirkan bukti transfer." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Ukuran berkas maksimal 5 MB." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectType(bytes);
  if (!detected) {
    return {
      ok: false,
      error: "Berkas harus berupa foto (JPG/PNG/WebP) atau PDF yang valid.",
    };
  }

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const paymentId = randomUUID();
  const path = `${guardian.school_id}/${studentId}/${paymentId}.${detected.ext}`;

  // Upload dengan service-role ke bucket privat (bypass RLS storage).
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from("payment-proofs")
    .upload(path, bytes, { contentType: detected.mime, upsert: false });
  if (uploadError) {
    return { ok: false, error: "Gagal mengunggah bukti. Coba lagi." };
  }

  // Insert payment via sesi wali (auth.uid() terisi) → RPC validasi kepemilikan.
  const supabase = createClient();
  const { error: rpcError } = await supabase.rpc("submit_payment", {
    p_payment_id: paymentId,
    p_student_id: studentId,
    p_amount: amount,
    p_proof_path: path,
    p_bill_ids: billIds,
    p_method: method,
    p_bank_name: bankName ?? undefined,
    p_sender_name: senderName ?? undefined,
    p_transferred_at: transferredAt ?? undefined,
    p_proof_sha256: sha256,
    p_revision_of: revisionOf ?? undefined,
  });
  if (rpcError) {
    // Rollback berkas yatim bila insert gagal
    await admin.storage.from("payment-proofs").remove([path]);
    return { ok: false, error: rpcError.message ?? "Gagal menyimpan pembayaran." };
  }

  return { ok: true, paymentId };
}

/** Signed URL 5 menit untuk melihat bukti (setelah cek otorisasi) — PRD §6.3. */
export async function getProofSignedUrl(
  paymentId: string,
): Promise<string | null> {
  const guardian = await requireGuardian();
  const supabase = createClient();

  // RLS memastikan wali hanya melihat pembayaran anaknya
  const { data: payment } = await supabase
    .from("payments")
    .select("proof_path, student_id")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment?.proof_path) return null;

  // Konfirmasi anak milik wali ini (defense in depth)
  const { data: link } = await supabase
    .from("guardian_students")
    .select("student_id")
    .eq("guardian_id", guardian.id)
    .eq("student_id", payment.student_id)
    .maybeSingle();
  if (!link) return null;

  const admin = createAdminClient();
  const { data } = await admin.storage
    .from("payment-proofs")
    .createSignedUrl(payment.proof_path, 300);
  return data?.signedUrl ?? null;
}
