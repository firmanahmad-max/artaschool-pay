import "server-only";
import { createClient } from "@/lib/supabase/server";

const STATUS_LABEL: Record<string, string> = {
  unpaid: "Belum Bayar",
  partial: "Sebagian",
  paid: "Lunas",
  waived: "Dibebaskan",
  cancelled: "Dibatalkan",
};

export function billStatusLabel(status: string) {
  return STATUS_LABEL[status] ?? status;
}

export async function getPaymentTypes() {
  const supabase = createClient();
  const { data } = await supabase
    .from("payment_types")
    .select("id, name, default_amount, is_recurring, is_active")
    .order("name");
  return data ?? [];
}

export type BillFilter = {
  status?: string;
  classId?: string;
  paymentTypeId?: string;
};

/** Daftar tagihan tahun ajaran aktif + info siswa/kelas, dengan filter opsional. */
export async function getBills(filter: BillFilter = {}) {
  const supabase = createClient();
  let query = supabase
    .from("bills")
    .select(
      "id, period, amount, amount_paid, status, due_date, payment_types(name), students!inner(id, nis, full_name, class_enrollments(classes!inner(id, label, academic_years!inner(is_active))))",
    )
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(500);

  if (filter.status) query = query.eq("status", filter.status);
  if (filter.paymentTypeId) query = query.eq("payment_type_id", filter.paymentTypeId);

  const { data } = await query;
  let rows = (data ?? []).map((b) => {
    const activeEnrollment = b.students?.class_enrollments.find(
      (e) => e.classes?.academic_years?.is_active,
    );
    return {
      id: b.id,
      period: b.period,
      amount: b.amount,
      amount_paid: b.amount_paid,
      remaining: b.amount - b.amount_paid,
      status: b.status,
      due_date: b.due_date,
      typeName: b.payment_types?.name ?? "—",
      studentName: b.students?.full_name ?? "—",
      nis: b.students?.nis ?? "",
      classId: activeEnrollment?.classes?.id ?? "",
      classLabel: activeEnrollment?.classes?.label ?? "—",
    };
  });

  if (filter.classId) rows = rows.filter((r) => r.classId === filter.classId);
  return rows;
}

/** Rekap tunggakan per kelas (status unpaid/partial pada tahun ajaran aktif). */
export async function getArrearsByClass() {
  const bills = await getBills();
  const map = new Map<
    string,
    { classId: string; classLabel: string; count: number; total: number }
  >();
  for (const b of bills) {
    if (b.status !== "unpaid" && b.status !== "partial") continue;
    const key = b.classId || "—";
    const entry =
      map.get(key) ??
      { classId: b.classId, classLabel: b.classLabel, count: 0, total: 0 };
    entry.count += 1;
    entry.total += b.remaining;
    map.set(key, entry);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export async function getActiveStudentsForSelect() {
  const supabase = createClient();
  const { data } = await supabase
    .from("students")
    .select("id, nis, full_name")
    .eq("is_active", true)
    .order("full_name");
  return data ?? [];
}
