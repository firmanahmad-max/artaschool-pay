"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/modules/auth/guards";

export type CashResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const CASH_ROLES = ["super_admin", "admin_keuangan", "operator"];

/**
 * Catat pembayaran tunai/QRIS yang diterima langsung di sekolah (K5).
 * Langsung approved — admin adalah pihak yang menerima uangnya.
 */
export async function recordCashPayment(
  _prev: CashResult | null,
  formData: FormData,
): Promise<CashResult> {
  await requireAdmin(CASH_ROLES);

  const studentId = String(formData.get("student_id") ?? "");
  const method = String(formData.get("method") ?? "cash");
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!studentId) return { ok: false, error: "Pilih siswa terlebih dahulu." };
  if (method !== "cash" && method !== "qris") {
    return { ok: false, error: "Metode harus Tunai atau QRIS." };
  }

  const allocations: { bill_id: string; amount: number }[] = [];
  formData.forEach((value, key) => {
    if (!key.startsWith("alloc_")) return;
    const amount = Number(value);
    if (Number.isInteger(amount) && amount > 0) {
      allocations.push({ bill_id: key.slice("alloc_".length), amount });
    }
  });
  if (allocations.length === 0) {
    return { ok: false, error: "Isi minimal satu alokasi tagihan." };
  }
  const total = allocations.reduce((s, a) => s + a.amount, 0);

  const supabase = createClient();
  const { error } = await supabase.rpc("record_cash_payment", {
    p_student_id: studentId,
    p_amount: total,
    p_allocations: allocations,
    p_method: method,
    p_note: note ?? undefined,
  });
  if (error) {
    return { ok: false, error: error.message ?? "Gagal mencatat pembayaran." };
  }

  revalidatePath("/admin/tagihan");
  revalidatePath("/admin/verifikasi");
  revalidatePath("/admin");
  return {
    ok: true,
    message: `Pembayaran ${method === "cash" ? "tunai" : "QRIS"} tercatat & tagihan diperbarui.`,
  };
}
