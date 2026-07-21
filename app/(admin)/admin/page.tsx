import { ClipboardCheck, TrendingDown, Users, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BarChart30, StatusDonut } from "@/components/ui/charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRupiah } from "@/lib/utils";
import { getDashboardData } from "@/modules/reports/queries";

export const metadata: Metadata = { title: "Dashboard Admin" };

export default async function AdminDashboardPage() {
  const d = await getDashboardData();

  const cards = [
    {
      title: "Menunggu Verifikasi",
      value: String(d.pendingCount),
      note: "Antrean bukti transfer masuk",
      icon: ClipboardCheck,
      href: "/admin/verifikasi",
    },
    {
      title: "Disetujui Bulan Ini",
      value: formatRupiah(d.approvedThisMonth),
      note: "Total pembayaran terverifikasi",
      icon: Wallet,
      href: "/admin/laporan",
    },
    {
      title: "Tunggakan",
      value: formatRupiah(d.arrearsTotal),
      note: "Tagihan belum lunas",
      icon: TrendingDown,
      href: "/admin/tagihan",
    },
    {
      title: "Siswa Aktif",
      value: String(d.activeStudents),
      note: "Tahun ajaran berjalan",
      icon: Users,
      href: "/admin/siswa",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ title, value, note, icon: Icon, href }) => (
          <Link key={title} href={href}>
            <Card className="h-full transition-colors hover:border-primary">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardDescription>{title}</CardDescription>
                  <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                </div>
                <CardTitle className="text-2xl">{value}</CardTitle>
                <CardDescription>{note}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload 30 hari terakhir</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart30 data={d.daily} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status pembayaran (30 hari)</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusDonut counts={d.statusCounts} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tunggakan per kelas</CardTitle>
          <CardDescription>
            Dimungkinkan oleh model tagihan — total {formatRupiah(d.arrearsTotal)}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {d.arrearsByClass.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada tunggakan. 🎉</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {d.arrearsByClass.map((a) => (
                <div
                  key={a.classLabel}
                  className="rounded-lg border border-border bg-background px-4 py-3"
                >
                  <p className="text-sm font-medium">{a.classLabel}</p>
                  <p className="text-lg font-semibold">{formatRupiah(a.total)}</p>
                  <p className="text-xs text-muted-foreground">{a.count} tagihan</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
