"use client";

import { ArrowRight, GraduationCap } from "lucide-react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { runPromotion } from "@/modules/students/promotion";

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      <ArrowRight className="h-4 w-4" aria-hidden />
      {pending ? "Memproses…" : "Jalankan Kenaikan Kelas"}
    </Button>
  );
}

export function PromotionForm({
  fromYear,
  toYear,
  hasGraduates,
  canRun,
}: {
  fromYear: string;
  toYear: string;
  hasGraduates: boolean;
  canRun: boolean;
}) {
  const [state, action] = useFormState(runPromotion, null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="from_year" value={fromYear} />
      <input type="hidden" name="to_year" value={toYear} />

      {hasGraduates && (
        <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
          <input
            type="checkbox"
            name="deactivate_graduates"
            defaultChecked
            className="mt-0.5 h-4 w-4"
          />
          <span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <GraduationCap className="h-4 w-4" aria-hidden />
              Nonaktifkan siswa tingkat akhir (lulus)
            </span>
            <span className="mt-0.5 block text-muted-foreground">
              Siswa lulus tidak didaftarkan ke kelas baru. Menonaktifkan mereka
              mencegah tagihan baru terbit, sementara riwayat pembayaran tetap
              utuh untuk pembukuan.
            </span>
          </span>
        </label>
      )}

      {state && (
        <p
          role={state.ok ? undefined : "alert"}
          className={
            state.ok
              ? "rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
              : "text-sm text-red-600 dark:text-red-400"
          }
        >
          {state.ok ? state.message : state.error}
        </p>
      )}

      <SubmitButton disabled={!canRun} />
      <p className="text-xs text-muted-foreground">
        Aman dijalankan ulang — siswa yang sudah terdaftar di kelas tujuan tidak
        akan diduplikasi.
      </p>
    </form>
  );
}
