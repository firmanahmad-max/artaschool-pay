import { ArrowLeft, ArrowRight, GraduationCap, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/modules/auth/guards";
import { getAcademicYears, getActiveYear } from "@/modules/students/queries";
import { PromotionForm } from "./promotion-form";

export const metadata: Metadata = { title: "Wizard Naik Kelas" };

export default async function NaikKelasPage({
  searchParams,
}: {
  searchParams: { ke?: string };
}) {
  await requireAdmin(["super_admin", "operator"]);

  const [activeYear, years] = await Promise.all([
    getActiveYear(),
    getAcademicYears(),
  ]);
  if (!activeYear) notFound();

  const target = years.find((y) => y.id === searchParams.ke && y.id !== activeYear.id);

  const supabase = createClient();
  const { data: preview } = target
    ? await supabase.rpc("preview_promotion", {
        p_from_year: activeYear.id,
        p_to_year: target.id,
      })
    : { data: null };

  const rows = preview ?? [];
  const totalPromoted = rows
    .filter((r) => !r.graduates)
    .reduce((sum, r) => sum + Number(r.student_count), 0);
  const totalGraduates = rows
    .filter((r) => r.graduates)
    .reduce((sum, r) => sum + Number(r.student_count), 0);
  const newClasses = rows.filter((r) => !r.graduates && !r.to_class_exists).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/tahun-ajaran"
          className="text-muted-foreground hover:text-foreground"
          aria-label="Kembali ke tahun ajaran"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <h1 className="text-xl font-semibold">Wizard Naik Kelas</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pilih tahun ajaran tujuan</CardTitle>
          <CardDescription>
            Dari tahun aktif <span className="font-medium">{activeYear.name}</span> ke
            tahun ajaran berikutnya.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {years.filter((y) => y.id !== activeYear.id).length === 0 && (
              <p className="text-sm text-muted-foreground">
                Belum ada tahun ajaran lain. Buat dulu di halaman Tahun Ajaran.
              </p>
            )}
            {years
              .filter((y) => y.id !== activeYear.id)
              .map((y) => (
                <Link
                  key={y.id}
                  href={`/admin/tahun-ajaran/naik-kelas?ke=${y.id}`}
                  className={
                    "rounded-md border px-3 py-1.5 text-sm " +
                    (target?.id === y.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:text-foreground")
                  }
                >
                  {y.name}
                </Link>
              ))}
          </div>
        </CardContent>
      </Card>

      {target && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Pratinjau: {activeYear.name} → {target.name}
              </CardTitle>
              <CardDescription>
                {totalPromoted} siswa naik kelas · {newClasses} kelas baru akan
                dibuat otomatis
                {totalGraduates > 0 && ` · ${totalGraduates} siswa tingkat akhir lulus`}
                . Belum ada perubahan sampai Anda menekan tombol jalankan.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kelas sekarang</TableHead>
                    <TableHead className="text-right">Siswa aktif</TableHead>
                    <TableHead>Menjadi</TableHead>
                    <TableHead>Keterangan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Tidak ada kelas di tahun ajaran aktif.
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((r) => (
                    <TableRow key={r.from_class_id}>
                      <TableCell className="font-medium">{r.from_label}</TableCell>
                      <TableCell className="text-right">{Number(r.student_count)}</TableCell>
                      <TableCell>
                        {r.graduates ? (
                          <span className="inline-flex items-center gap-1.5 text-violet-700 dark:text-violet-300">
                            <GraduationCap className="h-4 w-4" aria-hidden />
                            Lulus
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                            <span className="font-medium">{r.to_label}</span>
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.graduates ? (
                          "Tidak didaftarkan ke tahun ajaran baru"
                        ) : r.to_class_exists ? (
                          "Kelas tujuan sudah ada"
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <Plus className="h-3.5 w-3.5" aria-hidden />
                            Kelas akan dibuat
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Jalankan</CardTitle>
              <CardDescription>
                Kenaikan kelas tidak mengaktifkan tahun ajaran tujuan. Aktifkan
                terpisah di halaman Tahun Ajaran setelah data siap.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PromotionForm
                fromYear={activeYear.id}
                toYear={target.id}
                hasGraduates={totalGraduates > 0}
                canRun={rows.length > 0}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
