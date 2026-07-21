import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatTanggal } from "@/lib/utils";
import { activateAcademicYear } from "@/modules/students/actions";
import { getAcademicYears } from "@/modules/students/queries";
import { YearForm } from "./year-form";

export const metadata: Metadata = { title: "Tahun Ajaran" };

export default async function TahunAjaranPage() {
  const years = await getAcademicYears();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Tahun Ajaran</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tambah tahun ajaran</CardTitle>
          <CardDescription>
            Wizard naik kelas otomatis saat aktivasi hadir di v2 (PRD §9).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <YearForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar tahun ajaran</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {years.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Belum ada tahun ajaran.
                  </TableCell>
                </TableRow>
              )}
              {years.map((y) => (
                <TableRow key={y.id}>
                  <TableCell className="font-medium">{y.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {y.starts_on ? formatTanggal(y.starts_on) : "—"} s.d.{" "}
                    {y.ends_on ? formatTanggal(y.ends_on) : "—"}
                  </TableCell>
                  <TableCell>
                    {y.is_active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                        Aktif
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Nonaktif</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {!y.is_active && (
                      <form action={activateAcademicYear} className="inline">
                        <input type="hidden" name="id" value={y.id} />
                        <Button type="submit" variant="outline" size="sm">
                          Aktifkan
                        </Button>
                      </form>
                    )}
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
