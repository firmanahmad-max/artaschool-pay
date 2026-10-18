"use client";

import { KeyRound } from "lucide-react";
import { useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/modules/auth/actions";
import { changeMyPin } from "@/modules/auth/aktivasi-actions";

function SimpanButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <KeyRound className="h-4 w-4" aria-hidden />
      {pending ? "Menyimpan…" : label}
    </Button>
  );
}

function Pin({ id, label, auto }: { id: string; label: string; auto: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type="password"
        inputMode="numeric"
        pattern="\d{6}"
        maxLength={6}
        autoComplete={auto}
        required
        className="max-w-[12rem] text-center tracking-[0.5em]"
      />
    </div>
  );
}

/** Buat PIN (wali yang dulu masuk lewat OTP) atau ubah PIN (wajib PIN lama). */
export function PinForm({ punyaPin }: { punyaPin: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useFormState<ActionResult | null, FormData>(
    async (prev, data) => {
      const hasil = await changeMyPin(prev, data);
      if (hasil.ok) formRef.current?.reset();
      return hasil;
    },
    null,
  );

  return (
    <form ref={formRef} action={action} className="space-y-4">
      {punyaPin && <Pin id="pin_lama" label="PIN lama" auto="current-password" />}
      <Pin id="pin_baru" label="PIN baru (6 angka)" auto="new-password" />
      <Pin id="pin_ulang" label="Ulangi PIN baru" auto="new-password" />
      <div className="flex items-center gap-3">
        <SimpanButton label={punyaPin ? "Ubah PIN" : "Buat PIN"} />
        {state && (
          <span
            role={state.ok ? "status" : "alert"}
            className={
              state.ok
                ? "text-sm text-emerald-700 dark:text-emerald-300"
                : "text-sm text-red-600 dark:text-red-400"
            }
          >
            {state.ok ? state.message : state.error}
          </span>
        )}
      </div>
    </form>
  );
}
