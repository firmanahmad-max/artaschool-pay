import { ArrowLeft, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { removeGuardianLink, setStudentActive } from "@/modules/students/actions";
import { getActiveYear, getClasses, getStudent } from "@/modules/students/queries";
import { AddGuardianForm, EditStudentForm } from "./edit-forms";

export const metadata: Metadata = { title: "Ubah Siswa" };

export default async function EditSiswaPage({
  params,
}: {
  params: { id: string };
}) {
  const [student, activeYear] = await Promise.all([
    getStudent(params.id),
    getActiveYear(),
  ]);
  if (!student) notFound();
  const classes = activeYear ? await getClasses(activeYear.id) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/siswa"
          className="text-muted-foreground hover:text-foreground"
          aria-label="Kembali ke daftar siswa"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <h1 className="text-xl font-semibold">{student.full_name}</h1>
        {!student.is_active && (
          <span className="rounded-full bg-border px-2.5 py-0.5 text-xs text-muted-foreground">
            Nonaktif
          </span>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data siswa</CardTitle>
        </CardHeader>
        <CardContent>
          <EditStudentForm
            student={student}
            classes={classes.map(({ id, label }) => ({ id, label }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Wali terhubung</CardTitle>
          <CardDescription>
            Nomor HP wali adalah kunci login OTP aplikasi orang tua.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {student.guardians.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada wali tertaut.</p>
          ) : (
            <ul className="space-y-2">
              {student.guardians.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span>
                    <span className="font-medium">{g.name}</span>{" "}
                    <span className="text-muted-foreground">
                      · {g.phone} · {g.relation}
                    </span>
                  </span>
                  <form action={removeGuardianLink}>
                    <input type="hidden" name="student_id" value={student.id} />
                    <input type="hidden" name="guardian_id" value={g.id} />
                    <button
                      type="submit"
                      aria-label={`Lepas tautan ${g.name}`}
                      className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <AddGuardianForm studentId={student.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Status siswa</CardTitle>
            <CardDescription>
              Siswa nonaktif tidak mendapat tagihan baru saat generate massal.
            </CardDescription>
          </div>
          <form action={setStudentActive}>
            <input type="hidden" name="id" value={student.id} />
            <input type="hidden" name="active" value={String(!student.is_active)} />
            <Button type="submit" variant="outline">
              {student.is_active ? "Nonaktifkan Siswa" : "Aktifkan Siswa"}
            </Button>
          </form>
        </CardHeader>
      </Card>
    </div>
  );
}
