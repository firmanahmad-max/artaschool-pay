"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/modules/auth/guards";
import {
  generateBillsSchema,
  individualBillSchema,
  paymentTypeSchema,
  waiveBillSchema,
} from "./schemas";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const FINANCE_ROLES = ["super_admin", "admin_keuangan"];

function firstIssue(e: { issues: { message: string }[] }) {
  return e.issues[0]?.message ?? "Input tidak valid";
}

// ── Jenis Pembayaran ─────────────────────────────────────────────────────────

export async function createPaymentType(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin(FINANCE_ROLES);
  const parsed = paymentTypeSchema.safeParse({
    name: formData.get("name"),
    default_amount: formData.get("default_amount"),
    is_recurring: formData.get("is_recurring") === "on",
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("payment_types")
    .insert({ ...parsed.data, school_id: admin.school_id })
    .select("id")
    .single();
  if (error) return { ok: false, error: "Gagal menyimpan jenis pembayaran." };

  await supabase.rpc("log_audit", {
    p_action: "payment_type.created",
    p_entity: "payment_type",
    p_entity_id: data.id,
    p_after: parsed.data,
  });
  revalidatePath("/admin/tagihan");
  return { ok: true };
}

export async function setPaymentTypeActive(formData: FormData): Promise<void> {
  await requireAdmin(FINANCE_ROLES);
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  const supabase = createClient();
  await supabase.from("payment_types").update({ is_active: active }).eq("id", id);
  await supabase.rpc("log_audit", {
    p_action: active ? "payment_type.activated" : "payment_type.deactivated",
    p_entity: "payment_type",
    p_entity_id: id,
  });
  revalidatePath("/admin/tagihan");
}

// ── Generate massal ──────────────────────────────────────────────────────────

export async function generateBills(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin(FINANCE_ROLES);
  const parsed = generateBillsSchema.safeParse({
    payment_type_id: formData.get("payment_type_id"),
    is_recurring: formData.get("is_recurring") === "true",
    month: formData.get("month") ?? "",
    due_date: formData.get("due_date") ?? "",
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const period = parsed.data.month ? `${parsed.data.month}-01` : undefined;
  const supabase = createClient();
  const { data, error } = await supabase.rpc("generate_bills", {
    p_payment_type_id: parsed.data.payment_type_id,
    p_period: period,
    p_due_date: parsed.data.due_date ?? undefined,
  });
  if (error) {
    return { ok: false, error: error.message ?? "Gagal membuat tagihan." };
  }

  revalidatePath("/admin/tagihan");
  const count = typeof data === "number" ? data : 0;
  return {
    ok: true,
    message:
      count === 0
        ? "Tidak ada tagihan baru (semua siswa sudah punya tagihan untuk periode ini)."
        : `${count} tagihan berhasil dibuat.`,
  };
}

export async function createIndividualBill(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin(FINANCE_ROLES);
  const parsed = individualBillSchema.safeParse({
    student_id: formData.get("student_id"),
    payment_type_id: formData.get("payment_type_id"),
    amount: formData.get("amount"),
    month: formData.get("month") ?? "",
    due_date: formData.get("due_date") ?? "",
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = createClient();
  const { data: year } = await supabase
    .from("academic_years")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  if (!year) return { ok: false, error: "Belum ada tahun ajaran aktif." };

  const { data: bill, error } = await supabase
    .from("bills")
    .insert({
      school_id: admin.school_id,
      student_id: parsed.data.student_id,
      payment_type_id: parsed.data.payment_type_id,
      academic_year_id: year.id,
      period: parsed.data.period ?? null,
      amount: parsed.data.amount,
      due_date: parsed.data.due_date ?? null,
    })
    .select("id")
    .single();
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "Tagihan untuk siswa, jenis, dan periode itu sudah ada."
          : "Gagal membuat tagihan.",
    };
  }

  await supabase.rpc("log_audit", {
    p_action: "bill.created",
    p_entity: "bill",
    p_entity_id: bill.id,
    p_after: { amount: parsed.data.amount },
  });
  revalidatePath("/admin/tagihan");
  return { ok: true, message: "Tagihan individual dibuat." };
}

// ── Pembebasan / batal ───────────────────────────────────────────────────────

export async function waiveBill(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin(FINANCE_ROLES);
  const parsed = waiveBillSchema.safeParse({
    bill_id: formData.get("bill_id"),
    note: formData.get("note"),
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = createClient();
  const { error } = await supabase.rpc("waive_bill", {
    p_bill_id: parsed.data.bill_id,
    p_note: parsed.data.note,
  });
  if (error) return { ok: false, error: error.message ?? "Gagal membebaskan tagihan." };

  revalidatePath("/admin/tagihan");
  return { ok: true, message: "Tagihan dibebaskan." };
}

export async function unwaiveBill(formData: FormData): Promise<void> {
  await requireAdmin(FINANCE_ROLES);
  const id = String(formData.get("bill_id") ?? "");
  const supabase = createClient();
  await supabase.rpc("unwaive_bill", { p_bill_id: id });
  revalidatePath("/admin/tagihan");
}
