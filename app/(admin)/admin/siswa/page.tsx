import { Download, Pencil, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteClass, setStudentActive } from "@/modules/students/actions";
import { getActiveYear, getClasses, getStudents } from "@/modules/students/queries";
import { ClassForm, ImportForm, StudentForm } from "./forms";

export const metadata: Metadata = { title: "Siswa & Kelas" };

export default async function SiswaPage() {
  const activeYear = await getActiveYear();
  const [classes, students] = await Promise.all([
    activeYear ? getClasses(activeYear.id) : Promise.resolve([]),
    getStudents(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Siswa &amp; Kelas</h1>
        <p className="text-sm text-muted-foreground">
          Tahun ajaran aktif: <span className="font-medium">{activeYear?.name ?? "—"}</span>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kelas ({classes.length})</CardTitle>
          <CardDescription>
            Kelas milik tahun ajaran aktif. Kelas hanya bisa dihapus bila belum
            memiliki siswa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {classes.length === 0 && (
              <p className="text-sm text-muted-foreground">Belum ada kelas.</p>
            )}
            {classes.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
              >
                <span className="font-medium">{c.label}</span>
                <span className="text-muted-foreground">{c.studentCount} siswa</span>
                {c.studentCount === 0 && (
                  <form action={deleteClass} className="inline-flex">
                    <input type="hidden" name="id" value={c.id} />
                    <button
                      type="submit"
                      aria-label={`Hapus kelas ${c.label}`}
                      className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </form>
                )}
              </span>
            ))}
          </div>
          <ClassForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tambah siswa</CardTitle>
          <CardDescription>
            Nomor HP wali yang didaftarkan di sini menjadi kunci login OTP orang
            tua (PRD §6.1).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StudentForm classes={classes.map(({ id, label }) => ({ id, label }))} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import dari Excel</CardTitle>
          <CardDescription>
            Kolom template: NIS, Nama Lengkap, Kelas, Nama Wali, No HP Wali,
            Relasi. Baris bermasalah dilaporkan dan bisa diunduh.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImportForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Daftar siswa ({students.length})</CardTitle>
          <a
            href="/admin/siswa/export"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Download className="h-4 w-4" aria-hidden />
            Export Excel
          </a>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NIS</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Kelas</TableHead>
                <TableHead>Wali</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Belum ada siswa. Tambahkan manual atau import dari Excel.
                  </TableCell>
                </TableRow>
              )}
              {students.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.nis}</TableCell>
                  <TableCell className="font-medium">{s.full_name}</TableCell>
                  <TableCell>{s.classLabel}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.guardians.length === 0
                      ? "—"
                      : s.guardians.map((g) => `${g.name} (${g.relation})`).join(", ")}
                  </TableCell>
                  <TableCell>
                    {s.is_active ? (
                      <span className="text-sm text-emerald-700 dark:text-emerald-300">Aktif</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Nonaktif</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-2">
                      <Link
                        href={`/admin/siswa/${s.id}`}
                        aria-label={`Ubah ${s.full_name}`}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </Link>
                      <form action={setStudentActive}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="active" value={String(!s.is_active)} />
                        <Button type="submit" variant="outline" size="sm">
                          {s.is_active ? "Nonaktifkan" : "Aktifkan"}
                        </Button>
                      </form>
                    </div>
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
