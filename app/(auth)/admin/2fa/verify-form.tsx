"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifyMfaLogin } from "@/modules/auth/mfa";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Memverifikasi…" : "Verifikasi"}
    </Button>
  );
}

export function MfaVerifyForm() {
  const [state, action] = useFormState(verifyMfaLogin, null);

  // Sesi sudah naik ke aal2 → muat ulang agar guard meloloskan
  if (state?.ok && typeof window !== "undefined") {
    window.location.href = "/admin";
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="code">Kode dari aplikasi authenticator</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
          autoComplete="one-time-code"
          placeholder="••••••"
          className="text-center text-lg tracking-[0.5em]"
        />
      </div>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <SubmitButton />
    </form>
  );
}
