"use client";

import { ShieldCheck, ShieldOff } from "lucide-react";
import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  confirmMfaEnrollment,
  startMfaEnrollment,
  unenrollMfa,
  type EnrollData,
} from "@/modules/auth/mfa";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Memverifikasi…" : "Aktifkan 2FA"}
    </Button>
  );
}

export function MfaEnroll({ wajib }: { wajib: boolean }) {
  const [enroll, setEnroll] = useState<EnrollData | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [state, action] = useFormState(confirmMfaEnrollment, null);

  if (state?.ok) {
    return (
      <div className="space-y-3 text-center">
        <ShieldCheck
          className="mx-auto h-12 w-12 text-emerald-600 dark:text-emerald-400"
          aria-hidden
        />
        <p className="font-medium">2FA aktif</p>
        <p className="text-sm text-muted-foreground">{state.message}</p>
        <Button onClick={() => (window.location.href = "/admin")}>
          Lanjut ke Dashboard
        </Button>
      </div>
    );
  }

  if (!enroll) {
    return (
      <div className="space-y-4">
        {wajib && (
          <p className="rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            Peran Anda memegang data keuangan, sehingga 2FA wajib diaktifkan
            sebelum bisa membuka dashboard.
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Siapkan aplikasi authenticator (Google Authenticator, Authy, atau
          sejenisnya) di ponsel Anda, lalu tekan tombol di bawah untuk
          menampilkan QR code.
        </p>
        {startError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {startError}
          </p>
        )}
        <Button
          className="w-full"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setStartError(null);
              const res = await startMfaEnrollment();
              if (res.ok) setEnroll(res.data);
              else setStartError(res.error);
            })
          }
        >
          {isPending ? "Menyiapkan…" : "Mulai Aktifkan 2FA"}
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="factor_id" value={enroll.factorId} />

      <div className="space-y-2">
        <p className="text-sm font-medium">1. Pindai QR ini</p>
        {/* QR dari Supabase berupa SVG data-URI; latar putih agar terbaca di dark mode */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={enroll.qrSvg}
          alt="QR code pendaftaran 2FA"
          className="mx-auto h-48 w-48 rounded-md border border-border bg-white p-2"
        />
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Tidak bisa memindai?</summary>
          <p className="mt-1 break-all">
            Masukkan kode ini manual:{" "}
            <code className="font-mono">{enroll.secret}</code>
          </p>
        </details>
      </div>

      <div className="space-y-2">
        <Label htmlFor="code">2. Masukkan 6 angka dari aplikasi</Label>
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

      <ConfirmButton />
    </form>
  );
}

export function MfaActive({ factorId }: { factorId: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
        <ShieldCheck className="h-4 w-4" aria-hidden />
        2FA aktif untuk akun ini.
      </div>
      <form action={unenrollMfa}>
        <input type="hidden" name="factor_id" value={factorId} />
        <Button type="submit" variant="outline" className="w-full">
          <ShieldOff className="h-4 w-4" aria-hidden />
          Nonaktifkan 2FA (ganti perangkat)
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Menonaktifkan akan meminta Anda mendaftar ulang saat berikutnya membuka
        dashboard, karena peran Anda mewajibkan 2FA.
      </p>
    </div>
  );
}
