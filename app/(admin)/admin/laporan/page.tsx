import { Download } from "lucide-react";
import type { Metadata } from "next";
import { PrintButton } from "@/components/print-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge, type PaymentStatus } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatRupiah, formatTanggal } from "@/lib/utils";
import { getActiveYear, getClasses } from "@/modules/students/queries";
import { getArrearsRows, getPaymentReport } from "@/modules/reports/queries";

export const metadata: Metadata = { title: "Laporan" };

const STATUS_OPTIONS = [
  { value: "", label: "Semua status" },
  { value: "pending", label: "Menunggu" },
  { value: "approved", label: "Disetujui" },
  { value: "rejected", label: "Ditolak" },
  { value: "needs_revision", label: "Perlu Revisi" },
];

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: {
    jenis?: string;
    from?: string;
    to?: string;
    kelas?: string;
    status?: string;
  };
}) {
  const jenis = searchParams.jenis === "tunggakan" ? "tunggakan" : "pembayaran";
  const activeYear = await getActiveYear();
  const classes = activeYear ? await getClasses(activeYear.id) : [];

  const filter = {
    from: searchParams.from,
    to: searchParams.to,
    classId: searchParams.kelas,
    status: searchParams.status,
  };

  const report = jenis === "pembayaran" ? await getPaymentReport(filter) : null;
  const arrearsAll = jenis === "tunggakan" ? await getArrearsRows() : [];
  const arrears = filter.classId
    ? arrearsAll.filter((a) => a.classId === filter.classId)
    : arrearsAll;
  const arrearsTotal = arrears.reduce((s, a) => s + a.remaining, 0);

  const exportQuery = new URLSearchParams({
    jenis,
    ...(filter.from ? { from: filter.from } : {}),
    ...(filter.to ? { to: filter.to } : {}),
    ...(filter.classId ? { kelas: filter.classId } : {}),
    ...(filter.status ? { status: filter.status } : {}),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Laporan</h1>
        <div className="flex gap-2 print:hidden">
          <a
            href={`/admin/laporan/export?${exportQuery.toString()}&format=xlsx`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Download className="h-4 w-4" aria-hidden />
            XLSX
          </a>
          <a
            href={`/admin/laporan/export?${exportQuery.toString()}&format=csv`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Download className="h-4 w-4" aria-hidden />
            CSV
          </a>
        </div>
      </div>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="text-base">Filter</CardTitle>
          <CardDescription>
            PDF: gunakan Cetak browser (Ctrl/Cmd+P) — halaman sudah ber-gaya cetak.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label htmlFor="jenis" className="text-xs text-muted-foreground">
                Jenis laporan
              </label>
              <Select id="jenis" name="jenis" defaultValue={jenis} className="w-44">
                <option value="pembayaran">Pembayaran</option>
                <option value="tunggakan">Tunggakan</option>
              </Select>
            </div>
            <div className="space-y-1">
              <label htmlFor="from" className="text-xs text-muted-foreground">
                Dari
              </label>
              <Input id="from" name="from" type="date" defaultValue={searchParams.from ?? ""} />
            </div>
            <div className="space-y-1">
              <label htmlFor="to" className="text-xs text-muted-foreground">
                Sampai
              </label>
              <Input id="to" name="to" type="date" defaultValue={searchParams.to ?? ""} />
            </div>
            <div className="space-y-1">
              <label htmlFor="kelas" className="text-xs text-muted-foreground">
                Kelas
              </label>
              <Select id="kelas" name="kelas" defaultValue={searchParams.kelas ?? ""} className="w-32">
                <option value="">Semua kelas</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
            {jenis === "pembayaran" && (
              <div className="space-y-1">
                <label htmlFor="status" className="text-xs text-muted-foreground">
                  Status
                </label>
                <Select id="status" name="status" defaultValue={searchParams.status ?? ""} className="w-40">
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <Button type="submit" variant="outline">
              Terapkan
            </Button>
            <PrintButton />
          </form>
        </CardContent>
      </Card>

      {jenis === "pembayaran" && report && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Pembayaran ({report.rows.length})
            </CardTitle>
            <CardDescription>
              Total tercatat {formatRupiah(report.total)} · disetujui{" "}
              <span className="font-medium text-emerald-700 dark:text-emerald-300">
                {formatRupiah(report.approvedTotal)}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Siswa</TableHead>
                  <TableHead>Kelas</TableHead>
                  <TableHead>Metode</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Tidak ada data sesuai filter.
                    </TableCell>
                  </TableRow>
                )}
                {report.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-muted-foreground">
                      {r.created_at ? formatTanggal(r.created_at) : "—"}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{r.studentName}</span>{" "}
                      <span className="text-xs text-muted-foreground">({r.nis})</span>
                    </TableCell>
                    <TableCell>{r.classLabel}</TableCell>
                    <TableCell>{r.method}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatRupiah(r.amount)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status as PaymentStatus} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {jenis === "tunggakan" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tunggakan ({arrears.length})</CardTitle>
            <CardDescription>Total {formatRupiah(arrearsTotal)}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Siswa</TableHead>
                  <TableHead>Kelas</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead className="text-right">Tagihan</TableHead>
                  <TableHead className="text-right">Sisa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {arrears.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Tidak ada tunggakan.
                    </TableCell>
                  </TableRow>
                )}
                {arrears.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <span className="font-medium">{a.studentName}</span>{" "}
                      <span className="text-xs text-muted-foreground">({a.nis})</span>
                    </TableCell>
                    <TableCell>{a.classLabel}</TableCell>
                    <TableCell>{a.typeName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.period ? a.period.slice(0, 7) : "—"}
                    </TableCell>
                    <TableCell className="text-right">{formatRupiah(a.amount)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatRupiah(a.remaining)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
