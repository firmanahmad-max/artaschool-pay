import "server-only";
import { createClient } from "@/lib/supabase/server";
import { waMode } from "./mode";

/**
 * Status yang perlu tindakan admin di Kotak Keluar:
 * - mode manual  : semua pesan WA yang belum terkirim (menunggu dikirim tangan);
 * - mode gateway : hanya yang gagal permanen (gateway sudah menyerah).
 */
function statusPerluTindakan(): string[] {
  return waMode() === "manual" ? ["queued", "failed", "dead"] : ["dead"];
}

export const TEMPLATE_LABEL: Record<string, string> = {
  "payment.approved": "Pembayaran disetujui",
  "payment.needs_revision": "Perlu revisi",
  "payment.rejected": "Pembayaran ditolak",
  announcement: "Pengumuman",
  "digest.daily": "Ringkasan harian",
};

export async function getKotakKeluar() {
  const supabase = createClient();
  const { data } = await supabase
    .from("notification_jobs")
    .select(
      "id, recipient_phone, template, body, status, last_error, created_at, guardians(full_name)",
    )
    .eq("channel", "wa")
    .in("status", statusPerluTindakan())
    .order("created_at", { ascending: true })
    .limit(200);

  return (data ?? []).map((j) => ({
    id: j.id,
    phone: j.recipient_phone,
    nama: j.guardians?.full_name ?? null,
    jenis: TEMPLATE_LABEL[j.template] ?? j.template,
    body: j.body,
    status: j.status,
    lastError: j.last_error,
    createdAt: j.created_at,
  }));
}

/** Jumlah pesan yang menunggu tindakan — untuk lencana di menu admin. */
export async function countKotakKeluar(): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from("notification_jobs")
    .select("id", { count: "exact", head: true })
    .eq("channel", "wa")
    .in("status", statusPerluTindakan());
  return count ?? 0;
}
