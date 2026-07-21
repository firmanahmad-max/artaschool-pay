"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/modules/auth/guards";

export type ActionResult = { ok: true } | { ok: false; error: string };

const VERIFY_ROLES = ["super_admin", "admin_keuangan"];

/**
 * Terima pembayaran + alokasi final (state machine PRD §5).
 * Alokasi dibaca dari field `alloc_<billId>`; hanya nilai > 0 yang dikirim.
 * RPC `approve_payment` menegakkan: role, status pending, total = nominal.
 */
export async function approvePayment(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin(VERIFY_ROLES);
  const paymentId = String(formData.get("payment_id") ?? "");

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

  const supabase = createClient();
  const { error } = await supabase.rpc("approve_payment", {
    p_payment_id: paymentId,
    p_allocations: allocations,
  });
  if (error) {
    return { ok: false, error: error.message ?? "Gagal menyetujui pembayaran." };
  }

  revalidatePath("/admin/verifikasi");
  revalidatePath("/admin/tagihan");
  redirect("/admin/verifikasi?ok=approved");
}

/** Tolak / minta revisi — catatan wajib (ditegakkan RPC `review_payment`). */
export async function reviewPayment(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin(VERIFY_ROLES);
  const paymentId = String(formData.get("payment_id") ?? "");
  const action = String(formData.get("action") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (action !== "rejected" && action !== "needs_revision") {
    return { ok: false, error: "Aksi tidak dikenal." };
  }
  if (!note) {
    return { ok: false, error: "Catatan wajib diisi." };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("review_payment", {
    p_payment_id: paymentId,
    p_action: action,
    p_note: note,
  });
  if (error) {
    return { ok: false, error: error.message ?? "Gagal memproses review." };
  }

  revalidatePath("/admin/verifikasi");
  redirect(`/admin/verifikasi?ok=${action}`);
}
