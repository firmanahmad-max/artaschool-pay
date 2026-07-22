import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Antrean verifikasi: daftar pembayaran + siswa/kelas/wali, ter-filter. */
export async function getVerificationQueue(filter: {
  status?: string;
  cari?: string;
}) {
  const supabase = createClient();
  let query = supabase
    .from("payments")
    .select(
      "id, amount, method, status, created_at, sender_name, guardians(full_name), students!inner(nis, full_name, class_enrollments(classes(label, academic_years(is_active))))",
    )
    .order("created_at", { ascending: true })
    .limit(200);

  query = query.eq("status", filter.status || "pending");
  if (filter.cari) {
    query = query.ilike("students.full_name", `%${filter.cari}%`);
  }

  const { data } = await query;
  return (data ?? []).map((p) => ({
    id: p.id,
    amount: p.amount,
    method: p.method,
    status: p.status,
    created_at: p.created_at,
    sender_name: p.sender_name,
    guardianName: p.guardians?.full_name ?? "Input admin",
    studentName: p.students?.full_name ?? "—",
    nis: p.students?.nis ?? "",
    classLabel:
      p.students?.class_enrollments.find((e) => e.classes?.academic_years?.is_active)
        ?.classes?.label ?? "—",
  }));
}

export type OpenBill = {
  id: string;
  label: string;
  remaining: number;
  requested: boolean;
};

/** Detail pembayaran utk panel verifikasi + tagihan terbuka + riwayat siswa. */
export async function getPaymentDetail(paymentId: string) {
  const supabase = createClient();

  const { data: p } = await supabase
    .from("payments")
    .select(
      "id, amount, method, status, bank_name, sender_name, transferred_at, created_at, proof_path, proof_sha256, requested_bill_ids, review_note, student_id, school_id, guardians(full_name, phone), students(nis, full_name, class_enrollments(classes(label, academic_years(is_active))))",
    )
    .eq("id", paymentId)
    .maybeSingle();
  if (!p) return null;

  // Bukti ganda: pembayaran lain dengan hash identik (v2 — tanpa AI)
  let duplicate: { id: string; studentName: string; status: string } | null = null;
  if (p.proof_sha256) {
    const { data: dup } = await supabase
      .from("payments")
      .select("id, status, students(full_name)")
      .eq("school_id", p.school_id)
      .eq("proof_sha256", p.proof_sha256)
      .neq("id", p.id)
      .limit(1)
      .maybeSingle();
    if (dup) {
      duplicate = {
        id: dup.id,
        studentName: dup.students?.full_name ?? "—",
        status: dup.status,
      };
    }
  }

  const requestedIds = new Set(p.requested_bill_ids ?? []);

  const { data: bills } = await supabase
    .from("bills")
    .select("id, amount, amount_paid, status, period, due_date, payment_types(name)")
    .eq("student_id", p.student_id)
    .in("status", ["unpaid", "partial"])
    .order("period", { ascending: true, nullsFirst: false })
    .order("due_date", { ascending: true, nullsFirst: false });

  const openBills: OpenBill[] = (bills ?? []).map((b) => ({
    id: b.id,
    label: `${b.payment_types?.name ?? "—"}${b.period ? " " + b.period.slice(0, 7) : ""}`,
    remaining: b.amount - b.amount_paid,
    requested: requestedIds.has(b.id),
  }));

  // Riwayat pembayaran siswa (konteks utk admin — PRD §7.2)
  const { data: history } = await supabase
    .from("payments")
    .select("id, amount, status, created_at, review_note")
    .eq("student_id", p.student_id)
    .neq("id", paymentId)
    .order("created_at", { ascending: false })
    .limit(5);

  // Signed URL 5 menit utk bukti (setelah requireAdmin di page) — PRD §6.3
  let proofUrl: string | null = null;
  if (p.proof_path) {
    const admin = createAdminClient();
    const { data: signed } = await admin.storage
      .from("payment-proofs")
      .createSignedUrl(p.proof_path, 300);
    proofUrl = signed?.signedUrl ?? null;
  }

  return {
    id: p.id,
    amount: p.amount,
    method: p.method,
    status: p.status,
    bank_name: p.bank_name,
    sender_name: p.sender_name,
    transferred_at: p.transferred_at,
    created_at: p.created_at,
    review_note: p.review_note,
    proofUrl,
    duplicate,
    isPdf: p.proof_path?.endsWith(".pdf") ?? false,
    guardianName: p.guardians?.full_name ?? "Input admin",
    guardianPhone: p.guardians?.phone ?? "",
    studentName: p.students?.full_name ?? "—",
    nis: p.students?.nis ?? "",
    classLabel:
      p.students?.class_enrollments.find((e) => e.classes?.academic_years?.is_active)
        ?.classes?.label ?? "—",
    openBills,
    history: history ?? [],
  };
}

/**
 * Usulan alokasi otomatis: tagihan yang DIPILIH orang tua dulu, lalu tagihan
 * tertua lainnya, hingga nominal habis (PRD §7.2 poin 3).
 */
export function proposeAllocations(amount: number, openBills: OpenBill[]) {
  const ordered = [
    ...openBills.filter((b) => b.requested),
    ...openBills.filter((b) => !b.requested),
  ];
  let rest = amount;
  const proposal: Record<string, number> = {};
  for (const bill of ordered) {
    if (rest <= 0) break;
    const take = Math.min(rest, bill.remaining);
    proposal[bill.id] = take;
    rest -= take;
  }
  return { proposal, leftover: rest };
}
