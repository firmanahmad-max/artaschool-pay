import "server-only";
import { createClient } from "@/lib/supabase/server";

type PaymentRow = {
  id: string;
  amount: number;
  status: string;
  method: string;
  created_at: string | null;
  reviewed_at: string | null;
  sender_name: string | null;
  studentName: string;
  nis: string;
  classId: string;
  classLabel: string;
};

/** Ambil pembayaran + info siswa/kelas aktif; dasar dashboard & laporan. */
async function fetchPayments(sinceIso?: string): Promise<PaymentRow[]> {
  const supabase = createClient();
  let query = supabase
    .from("payments")
    .select(
      "id, amount, status, method, created_at, reviewed_at, sender_name, students(nis, full_name, class_enrollments(classes(id, label, academic_years(is_active))))",
    )
    .order("created_at", { ascending: false })
    .limit(2000);
  if (sinceIso) query = query.gte("created_at", sinceIso);

  const { data } = await query;
  return (data ?? []).map((p) => {
    const active = p.students?.class_enrollments.find(
      (e) => e.classes?.academic_years?.is_active,
    );
    return {
      id: p.id,
      amount: p.amount,
      status: p.status,
      method: p.method,
      created_at: p.created_at,
      reviewed_at: p.reviewed_at,
      sender_name: p.sender_name,
      studentName: p.students?.full_name ?? "—",
      nis: p.students?.nis ?? "",
      classId: active?.classes?.id ?? "",
      classLabel: active?.classes?.label ?? "—",
    };
  });
}

/** Tunggakan per siswa (tagihan unpaid/partial tahun ajaran aktif). */
export async function getArrearsRows() {
  const supabase = createClient();
  const { data } = await supabase
    .from("bills")
    .select(
      "id, amount, amount_paid, status, period, due_date, payment_types(name), students!inner(nis, full_name, is_active, class_enrollments(classes(id, label, academic_years(is_active))))",
    )
    .in("status", ["unpaid", "partial"])
    .limit(2000);

  return (data ?? []).map((b) => {
    const active = b.students?.class_enrollments.find(
      (e) => e.classes?.academic_years?.is_active,
    );
    return {
      id: b.id,
      studentName: b.students?.full_name ?? "—",
      nis: b.students?.nis ?? "",
      classId: active?.classes?.id ?? "",
      classLabel: active?.classes?.label ?? "—",
      typeName: b.payment_types?.name ?? "—",
      period: b.period,
      due_date: b.due_date,
      amount: b.amount,
      paid: b.amount_paid,
      remaining: b.amount - b.amount_paid,
    };
  });
}

/** Ringkasan + data grafik untuk dashboard admin (PRD §7.2). */
export async function getDashboardData() {
  const supabase = createClient();
  const since = new Date();
  since.setDate(since.getDate() - 29);
  since.setHours(0, 0, 0, 0);

  const [payments, arrears, studentsRes] = await Promise.all([
    fetchPayments(since.toISOString()),
    getArrearsRows(),
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
  ]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const pendingCount = payments.filter((p) => p.status === "pending").length;
  const approvedThisMonth = payments
    .filter(
      (p) =>
        p.status === "approved" &&
        p.reviewed_at &&
        new Date(p.reviewed_at) >= monthStart,
    )
    .reduce((sum, p) => sum + p.amount, 0);

  // Grafik batang 30 hari: jumlah upload per tanggal
  const byDay = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    byDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const p of payments) {
    if (!p.created_at) continue;
    const key = p.created_at.slice(0, 10);
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  const daily = Array.from(byDay.entries()).map(([date, count]) => ({ date, count }));

  // Donut status
  const statusCounts = payments.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});

  // Tunggakan per kelas
  const arrearsMap = new Map<string, { classLabel: string; count: number; total: number }>();
  for (const a of arrears) {
    const key = a.classId || "—";
    const entry = arrearsMap.get(key) ?? {
      classLabel: a.classLabel,
      count: 0,
      total: 0,
    };
    entry.count += 1;
    entry.total += a.remaining;
    arrearsMap.set(key, entry);
  }
  const arrearsByClass = Array.from(arrearsMap.values()).sort(
    (a, b) => b.total - a.total,
  );

  return {
    pendingCount,
    approvedThisMonth,
    arrearsTotal: arrears.reduce((sum, a) => sum + a.remaining, 0),
    activeStudents: studentsRes.count ?? 0,
    daily,
    statusCounts,
    arrearsByClass,
  };
}

export type ReportFilter = {
  from?: string;
  to?: string;
  classId?: string;
  status?: string;
};

/** Laporan pembayaran ter-filter + ringkasan nominal. */
export async function getPaymentReport(filter: ReportFilter) {
  const all = await fetchPayments(filter.from ? new Date(filter.from).toISOString() : undefined);
  const toTime = filter.to ? new Date(`${filter.to}T23:59:59`).getTime() : null;

  const rows = all.filter((p) => {
    if (toTime && p.created_at && new Date(p.created_at).getTime() > toTime) return false;
    if (filter.classId && p.classId !== filter.classId) return false;
    if (filter.status && p.status !== filter.status) return false;
    return true;
  });

  return {
    rows,
    total: rows.reduce((sum, r) => sum + r.amount, 0),
    approvedTotal: rows
      .filter((r) => r.status === "approved")
      .reduce((sum, r) => sum + r.amount, 0),
  };
}

/** Audit log ter-filter (read-only; RLS membatasi ke super_admin & kepsek). */
export async function getAuditLogs(filter: {
  action?: string;
  from?: string;
  to?: string;
}) {
  const supabase = createClient();
  let query = supabase
    .from("audit_logs")
    .select("id, action, actor_role, entity, entity_id, after, created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  if (filter.action) query = query.ilike("action", `%${filter.action}%`);
  if (filter.from) query = query.gte("created_at", new Date(filter.from).toISOString());
  if (filter.to) {
    query = query.lte("created_at", new Date(`${filter.to}T23:59:59`).toISOString());
  }

  const { data } = await query;
  return data ?? [];
}
