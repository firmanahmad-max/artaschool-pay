"use client";

import { Download, Upload } from "lucide-react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  createClass,
  createStudent,
  importStudents,
} from "@/modules/students/actions";

type ClassOption = { id: string; label: string };

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Memproses…" : children}
    </Button>
  );
}

function ActionError({ state }: { state: { ok: boolean; error?: string } | null }) {
  if (!state || state.ok) return null;
  return (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
      {state.error}
    </p>
  );
}

export function ClassForm() {
  const [state, action] = useFormState(createClass, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-2">
        <Label htmlFor="grade">Tingkat</Label>
        <Select id="grade" name="grade" defaultValue="1" className="w-24">
          {[1, 2, 3, 4, 5, 6].map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="label">Label</Label>
        <Input id="label" name="label" placeholder="1B" required className="w-28" />
      </div>
      <SubmitButton>Tambah Kelas</SubmitButton>
      <ActionError state={state} />
    </form>
  );
}

export function StudentForm({ classes }: { classes: ClassOption[] }) {
  const [state, action] = useFormState(createStudent, null);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="nis">NIS</Label>
          <Input id="nis" name="nis" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="full_name">Nama lengkap</Label>
          <Input id="full_name" name="full_name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="class_id">Kelas</Label>
          <Select id="class_id" name="class_id" required defaultValue="">
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
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="guardian_name">Nama wali (opsional)</Label>
          <Input id="guardian_name" name="guardian_name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="guardian_phone">No HP wali</Label>
          <Input id="guardian_phone" name="guardian_phone" type="tel" placeholder="0812xxxxxxx" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="relation">Relasi</Label>
          <Select id="relation" name="relation" defaultValue="wali">
            <option value="ayah">Ayah</option>
            <option value="ibu">Ibu</option>
            <option value="wali">Wali</option>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton>Tambah Siswa</SubmitButton>
        <ActionError state={state} />
      </div>
    </form>
  );
}

export function ImportForm() {
  const [state, action] = useFormState(importStudents, null);

  function downloadErrorReport() {
    if (!state?.ok || state.errors.length === 0) return;
    const lines = [
      "Baris;Masalah",
      ...state.errors.map((e) => `${e.row};"${e.message.replace(/"/g, '""')}"`),
    ];
    const blob = new Blob(["﻿" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "laporan-error-import.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="file">Berkas .xlsx</Label>
          <Input
            id="file"
            name="file"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
            className="w-72 pt-1.5"
          />
        </div>
        <SubmitButton>
          <Upload className="h-4 w-4" aria-hidden />
          Import
        </SubmitButton>
        <Button
          variant="outline"
          type="button"
          onClick={() => (window.location.href = "/admin/siswa/template")}
        >
          <Download className="h-4 w-4" aria-hidden />
          Unduh Template
        </Button>
      </form>

      {state && !state.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <div className="space-y-2 text-sm">
          <p>
            <span className="font-medium text-emerald-700 dark:text-emerald-300">
              {state.inserted} siswa berhasil diimport.
            </span>{" "}
            {state.errors.length > 0 && (
              <span className="text-red-600 dark:text-red-400">
                {state.errors.length} baris bermasalah.
              </span>
            )}
          </p>
          {state.errors.length > 0 && (
            <>
              <ul className="list-inside list-disc text-muted-foreground">
                {state.errors.slice(0, 5).map((e) => (
                  <li key={`${e.row}-${e.message}`}>
                    Baris {e.row}: {e.message}
                  </li>
                ))}
                {state.errors.length > 5 && <li>… dan lainnya</li>}
              </ul>
              <Button type="button" variant="outline" size="sm" onClick={downloadErrorReport}>
                <Download className="h-4 w-4" aria-hidden />
                Unduh Laporan Error (CSV)
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
