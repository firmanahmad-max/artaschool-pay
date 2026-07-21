import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type BankAccount = { bank: string; no_rek: string; atas_nama: string };

/** Anak-anak wali + tagihan berjalan (unpaid/partial) + status pembayaran terakhir. */
export async function getChildrenWithBills(guardianId: string) {
  const supabase = createClient();

  const { data: links } = await supabase
    .from("guardian_students")
    .select(
      "relation, students(id, nis, full_name, is_active, class_enrollments(classes(label, academic_years(is_active))))",
    )
    .eq("guardian_id", guardianId);

  const children = (links ?? [])
    .map((l) => l.students)
    .filter((s): s is NonNullable<typeof s> => !!s);

  const result = [];
  for (const child of children) {
    const { data: bills } = await supabase
      .from("bills")
      .select("id, amount, amount_paid, status, period, due_date, payment_types(name)")
      .eq("student_id", child.id)
      .in("status", ["unpaid", "partial"])
      .order("due_date", { ascending: true, nullsFirst: false });

    const { data: lastPayment } = await supabase
      .from("payments")
      .select("id, status, amount, created_at")
      .eq("student_id", child.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const activeClass = child.class_enrollments.find(
      (e) => e.classes?.academic_years?.is_active,
    );

    result.push({
      id: child.id,
      nis: child.nis,
      full_name: child.full_name,
      classLabel: activeClass?.classes?.label ?? "—",
      bills: (bills ?? []).map((b) => ({
        id: b.id,
        typeName: b.payment_types?.name ?? "—",
        period: b.period,
        amount: b.amount,
        remaining: b.amount - b.amount_paid,
        status: b.status,
        due_date: b.due_date,
      })),
      totalOutstanding: (bills ?? []).reduce(
        (sum, b) => sum + (b.amount - b.amount_paid),
        0,
      ),
      lastPayment: lastPayment
        ? {
            status: lastPayment.status,
            amount: lastPayment.amount,
            created_at: lastPayment.created_at,
          }
        : null,
    });
  }
  return result;
}

export async function getSchoolBankAccounts(): Promise<BankAccount[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("schools")
    .select("bank_accounts")
    .limit(1)
    .maybeSingle();
  const accounts = data?.bank_accounts;
  return Array.isArray(accounts) ? (accounts as unknown as BankAccount[]) : [];
}

export async function getLatestAnnouncements(limit = 3) {
  const supabase = createClient();
  const { data } = await supabase
    .from("announcements")
    .select("id, title, body, publish_at")
    .order("publish_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  return data ?? [];
}

/**
 * Detail pembayaran utk orang tua: info + alokasi + timeline + bukti.
 * RLS `parent_read_own` membatasi ke pembayaran anak sendiri — hasil null
 * berarti bukan miliknya (atau tidak ada).
 */
export async function getParentPaymentDetail(paymentId: string) {
  const supabase = createClient();
  const { data: p } = await supabase
    .from("payments")
    .select(
      "id, amount, status, method, bank_name, sender_name, transferred_at, created_at, reviewed_at, review_note, proof_path, revision_of, students(full_name, nis), payment_allocations(amount, bills(period, payment_types(name)))",
    )
    .eq("id", paymentId)
    .maybeSingle();
  if (!p) return null;

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
    status: p.status,
    method: p.method,
    bank_name: p.bank_name,
    sender_name: p.sender_name,
    transferred_at: p.transferred_at,
    created_at: p.created_at,
    reviewed_at: p.reviewed_at,
    review_note: p.review_note,
    revision_of: p.revision_of,
    proofUrl,
    isPdf: p.proof_path?.endsWith(".pdf") ?? false,
    studentName: p.students?.full_name ?? "—",
    nis: p.students?.nis ?? "",
    allocations: p.payment_allocations.map((a) => ({
      amount: a.amount,
      label: `${a.bills?.payment_types?.name ?? "—"}${
        a.bills?.period ? " " + a.bills.period.slice(0, 7) : ""
      }`,
    })),
  };
}

/** Data pembayaran needs_revision utk prefill form "Kirim Ulang". */
export async function getPaymentForResubmit(paymentId: string) {
  const supabase = createClient();
  const { data: p } = await supabase
    .from("payments")
    .select("id, student_id, amount, sender_name, requested_bill_ids, status")
    .eq("id", paymentId)
    .eq("status", "needs_revision")
    .maybeSingle();
  if (!p) return null;
  return {
    id: p.id,
    student_id: p.student_id,
    amount: p.amount,
    sender_name: p.sender_name,
    requested_bill_ids: p.requested_bill_ids ?? [],
  };
}

/** Riwayat pembayaran anak-anak wali (untuk halaman Riwayat, Sprint 7). */
export async function getPaymentHistory(guardianId: string) {
  const supabase = createClient();
  const { data: links } = await supabase
    .from("guardian_students")
    .select("student_id")
    .eq("guardian_id", guardianId);
  const studentIds = (links ?? []).map((l) => l.student_id);
  if (studentIds.length === 0) return [];

  const { data } = await supabase
    .from("payments")
    .select("id, amount, status, method, created_at, review_note, students(full_name)")
    .in("student_id", studentIds)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []).map((p) => ({
    id: p.id,
    amount: p.amount,
    status: p.status,
    method: p.method,
    created_at: p.created_at,
    review_note: p.review_note,
    studentName: p.students?.full_name ?? "—",
  }));
}
