import { RotateCcw } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge, type PaymentStatus } from "@/components/ui/status-badge";
import { cn, formatRupiah, formatTanggal } from "@/lib/utils";
import { requireGuardian } from "@/modules/auth/guards";
import { getPaymentHistory } from "@/modules/payments/queries";

export const metadata: Metadata = { title: "Riwayat" };

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Semua" },
  { value: "pending", label: "Menunggu" },
  { value: "approved", label: "Disetujui" },
  { value: "needs_revision", label: "Perlu Revisi" },
  { value: "rejected", label: "Ditolak" },
];

export default async function RiwayatPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const guardian = await requireGuardian();
  const all = await getPaymentHistory(guardian.id);
  const active = searchParams.status ?? "";
  const items = active ? all.filter((p) => p.status === active) : all;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Riwayat</h1>

      {/* Filter status — chip scrollable utk layar sempit */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/riwayat?status=${f.value}` : "/riwayat"}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm",
              active === f.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {items.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Belum ada riwayat pembayaran
            {active ? " untuk status ini" : ""}.
          </CardContent>
        </Card>
      )}

      <ul className="space-y-3">
        {items.map((p) => (
          <li key={p.id}>
            <Card>
              <CardContent className="space-y-3 p-4">
                <Link href={`/riwayat/${p.id}`} className="block space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{formatRupiah(p.amount)}</span>
                    <StatusBadge status={p.status as PaymentStatus} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {p.studentName} ·{" "}
                    {p.created_at ? formatTanggal(p.created_at) : "—"}
                  </p>
                </Link>

                {p.status === "needs_revision" && (
                  <div className="space-y-2 rounded-md bg-orange-100 p-3 dark:bg-orange-500/15">
                    <p className="text-sm text-orange-700 dark:text-orange-300">
                      <span className="font-medium">Catatan admin:</span>{" "}
                      {p.review_note ?? "—"}
                    </p>
                    <Link
                      href={`/upload?revisi=${p.id}`}
                      className={cn(buttonVariants({ size: "sm" }))}
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden />
                      Kirim Ulang
                    </Link>
                  </div>
                )}

                {p.status === "rejected" && p.review_note && (
                  <p className="rounded-md bg-red-100 p-3 text-sm text-red-700 dark:bg-red-500/15 dark:text-red-300">
                    <span className="font-medium">Alasan ditolak:</span>{" "}
                    {p.review_note}
                  </p>
                )}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
