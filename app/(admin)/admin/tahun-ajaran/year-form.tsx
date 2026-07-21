"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAcademicYear } from "@/modules/students/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Menyimpan…" : "Tambah Tahun Ajaran"}
    </Button>
  );
}

export function YearForm() {
  const [state, action] = useFormState(createAcademicYear, null);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
      <div className="space-y-2">
        <Label htmlFor="name">Nama</Label>
        <Input id="name" name="name" placeholder="2027/2028" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="starts_on">Mulai</Label>
        <Input id="starts_on" name="starts_on" type="date" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ends_on">Selesai</Label>
        <Input id="ends_on" name="ends_on" type="date" />
      </div>
      <SubmitButton />
      {state && !state.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 sm:col-span-4">
          {state.error}
        </p>
      )}
    </form>
  );
}
