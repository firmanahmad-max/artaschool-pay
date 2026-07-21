import { Eye } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge, type PaymentStatus } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatRupiah, formatTanggal } from "@/lib/utils";
import { getVerificationQueue } from "@/modules/verification/queries";

export const metadata: Metadata = { title: "Antrean Verifikasi" };

const STATUS_OPTIONS = [
  { value: "pending", label: "Menunggu" },
  { value: "approved", label: "Disetujui" },
  { value: "rejected", label: "Ditolak" },
  { value: "needs_revision", label: "Perlu Revisi" },
];

const OK_MESSAGE: Record<string, string> = {
  approved: "Pembayaran disetujui dan alokasi dieksekusi.",
  rejected: "Pembayaran ditolak — orang tua mendapat catatan.",
  needs_revision: "Permintaan revisi terkirim ke orang tua.",
};

export default async function VerifikasiPage({
  searchParams,
}: {
  searchParams: { status?: string; cari?: string; ok?: string };
}) {
  const status = searchParams.status || "pending";
  const rows = await getVerificationQueue({ status, cari: searchParams.cari });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Antrean Verifikasi</h1>

      {searchParams.ok && OK_MESSAGE[searchParams.ok] && (
        <p className="rounded-md bg-emerald-100 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          {OK_MESSAGE[searchParams.ok]}
        </p>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            {STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status} (
            {rows.length})
          </CardTitle>
          <form method="get" className="flex items-end gap-2">
            <Select name="status" defaultValue={status} className="w-40">
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Input
              name="cari"
              defaultValue={searchParams.cari ?? ""}
              placeholder="Cari nama siswa…"
              className="w-48"
            />
            <Button type="submit" variant="outline">
              Terapkan
            </Button>
          </form>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Masuk</TableHead>
                <TableHead>Siswa</TableHead>
                <TableHead>Kelas</TableHead>
                <TableHead>Pengirim</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Antrean kosong — tidak ada pembayaran berstatus ini.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground">
                    {r.created_at ? formatTanggal(r.created_at) : "—"}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{r.studentName}</span>{" "}
                    <span className="text-xs text-muted-foreground">({r.nis})</span>
                  </TableCell>
                  <TableCell>{r.classLabel}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.guardianName}
                    {r.sender_name ? ` · ${r.sender_name}` : ""}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatRupiah(r.amount)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status as PaymentStatus} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/admin/verifikasi/${r.id}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      <Eye className="h-4 w-4" aria-hidden />
                      Periksa
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
