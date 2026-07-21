import { ArrowRight, Megaphone, Upload } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BillStatusBadge } from "@/components/ui/bill-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, type PaymentStatus } from "@/components/ui/status-badge";
import { cn, formatRupiah, formatTanggal } from "@/lib/utils";
import { requireGuardian } from "@/modules/auth/guards";
import { getChildrenWithBills, getLatestAnnouncements } from "@/modules/payments/queries";

export const metadata: Metadata = { title: "Beranda" };

const PAYMENT_STATUSES: PaymentStatus[] = [
  "pending",
  "approved",
  "rejected",
  "needs_revision",
];

export default async function BerandaPage() {
  const guardian = await requireGuardian();
  const [children, announcements] = await Promise.all([
    getChildrenWithBills(guardian.id),
    getLatestAnnouncements(3),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Halo,</p>
        <h1 className="text-xl font-semibold">{guardian.full_name}</h1>
      </div>

      {children.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Belum ada anak terhubung</CardTitle>
            <CardDescription>
              Hubungi pihak sekolah untuk menautkan data anak dengan nomor HP Anda.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {children.map((child) => (
        <Card key={child.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base">{child.full_name}</CardTitle>
                <CardDescription>
                  Kelas {child.classLabel} · NIS {child.nis}
                </CardDescription>
              </div>
              {child.lastPayment && (
                <StatusBadge
                  status={
                    (PAYMENT_STATUSES.includes(child.lastPayment.status as PaymentStatus)
                      ? child.lastPayment.status
                      : "pending") as PaymentStatus
                  }
                />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-background p-3">
              <p className="text-xs text-muted-foreground">Total tagihan berjalan</p>
              <p className="text-2xl font-semibold">
                {formatRupiah(child.totalOutstanding)}
              </p>
            </div>

            {child.bills.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Tidak ada tagihan berjalan. 🎉
              </p>
            ) : (
              <ul className="space-y-2">
                {child.bills.slice(0, 4).map((bill) => (
                  <li
                    key={bill.id}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="font-medium">{bill.typeName}</span>
                      {bill.period && (
                        <span className="text-muted-foreground">
                          {" "}
                          · {formatTanggal(bill.period).replace(/^\d+ /, "")}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{formatRupiah(bill.remaining)}</span>
                      <BillStatusBadge status={bill.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <Link
              href={`/upload?anak=${child.id}`}
              className={cn(buttonVariants({ size: "lg" }), "w-full")}
            >
              <Upload className="h-4 w-4" aria-hidden />
              Upload Pembayaran
            </Link>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-4 w-4" aria-hidden />
            Pengumuman
          </CardTitle>
          <Link
            href="/pengumuman"
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Semua <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </CardHeader>
        <CardContent>
          {announcements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada pengumuman.</p>
          ) : (
            <ul className="space-y-3">
              {announcements.map((a) => (
                <li key={a.id}>
                  <p className="text-sm font-medium">{a.title}</p>
                  {a.body && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{a.body}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
