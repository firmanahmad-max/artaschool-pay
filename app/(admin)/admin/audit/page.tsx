import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatTanggal } from "@/lib/utils";
import { requireAdmin } from "@/modules/auth/guards";
import { getAuditLogs } from "@/modules/reports/queries";

export const metadata: Metadata = { title: "Audit Log" };

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin_keuangan: "Admin Keuangan",
  operator: "Operator",
  kepala_sekolah: "Kepala Sekolah",
  viewer: "Viewer",
  guardian: "Orang Tua",
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: { aksi?: string; from?: string; to?: string };
}) {
  // RBAC PRD §6.5: audit log hanya super_admin & kepala sekolah
  await requireAdmin(["super_admin", "kepala_sekolah"]);
  const logs = await getAuditLogs({
    action: searchParams.aksi,
    from: searchParams.from,
    to: searchParams.to,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Audit Log</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat aktivitas ({logs.length})</CardTitle>
          <CardDescription>
            Append-only — tidak bisa diubah atau dihapus, dijaga trigger database.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label htmlFor="aksi" className="text-xs text-muted-foreground">
                Aksi (mis. payment)
              </label>
              <Input id="aksi" name="aksi" defaultValue={searchParams.aksi ?? ""} className="w-48" />
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
            <Button type="submit" variant="outline">
              Terapkan
            </Button>
          </form>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Aktor</TableHead>
                <TableHead>Aksi</TableHead>
                <TableHead>Entitas</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Tidak ada catatan sesuai filter.
                  </TableCell>
                </TableRow>
              )}
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {l.created_at ? formatTanggal(l.created_at) : "—"}
                  </TableCell>
                  <TableCell>{ROLE_LABEL[l.actor_role ?? ""] ?? l.actor_role ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{l.action}</TableCell>
                  <TableCell className="text-muted-foreground">{l.entity ?? "—"}</TableCell>
                  <TableCell className="max-w-md">
                    <p className="line-clamp-2 font-mono text-xs text-muted-foreground">
                      {l.after ? JSON.stringify(l.after) : "—"}
                    </p>
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
