"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { addGuardianLink, updateStudent } from "@/modules/students/actions";

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Menyimpan…" : children}
    </Button>
  );
}

function ActionState({ state }: { state: { ok: boolean; error?: string } | null }) {
  if (!state) return null;
  if (state.ok) {
    return <p className="text-sm text-emerald-700 dark:text-emerald-300">Tersimpan.</p>;
  }
  return (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
      {state.error}
    </p>
  );
}

export function EditStudentForm({
  student,
  classes,
}: {
  student: { id: string; nis: string; full_name: string; activeClassId: string };
  classes: { id: string; label: string }[];
}) {
  const [state, action] = useFormState(updateStudent, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="student_id" value={student.id} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="nis">NIS</Label>
          <Input id="nis" name="nis" defaultValue={student.nis} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="full_name">Nama lengkap</Label>
          <Input id="full_name" name="full_name" defaultValue={student.full_name} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="class_id">Kelas</Label>
          <Select id="class_id" name="class_id" defaultValue={student.activeClassId} required>
            <option value="" disabled>
              Pilih kelas…
            </option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton>Simpan Perubahan</SubmitButton>
        <ActionState state={state} />
      </div>
    </form>
  );
}

export function AddGuardianForm({ studentId }: { studentId: string }) {
  const [state, action] = useFormState(addGuardianLink, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="student_id" value={studentId} />
      <div className="space-y-2">
        <Label htmlFor="guardian_name">Nama wali</Label>
        <Input id="guardian_name" name="guardian_name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="guardian_phone">No HP</Label>
        <Input id="guardian_phone" name="guardian_phone" type="tel" placeholder="0812xxxxxxx" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="relation">Relasi</Label>
        <Select id="relation" name="relation" defaultValue="wali" className="w-28">
          <option value="ayah">Ayah</option>
          <option value="ibu">Ibu</option>
          <option value="wali">Wali</option>
        </Select>
      </div>
      <SubmitButton>Tautkan Wali</SubmitButton>
      <ActionState state={state} />
    </form>
  );
}
