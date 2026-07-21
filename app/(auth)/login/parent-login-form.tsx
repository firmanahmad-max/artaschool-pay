"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  requestParentOtp,
  verifyParentOtp,
  type ActionResult,
} from "@/modules/auth/actions";

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Memproses…" : children}
    </Button>
  );
}

function ErrorText({ result }: { result: ActionResult | null }) {
  if (!result || result.ok) return null;
  return (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
      {result.error}
    </p>
  );
}

/** Alur 2 langkah: kirim OTP ke nomor terdaftar → verifikasi 6 digit. */
export function ParentLoginForm() {
  const [phone, setPhone] = useState("");
  const [requestState, requestAction] = useFormState(requestParentOtp, null);
  const [verifyState, verifyAction] = useFormState(verifyParentOtp, null);
  const otpSent = requestState?.ok === true;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Masuk Orang Tua / Wali</CardTitle>
        <CardDescription>
          {otpSent
            ? `Kode verifikasi dikirim ke WhatsApp ${phone}.`
            : "Gunakan nomor HP yang terdaftar di sekolah. Kode verifikasi dikirim via WhatsApp."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!otpSent ? (
          <form action={requestAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Nomor HP</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                placeholder="0812xxxxxxx"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <ErrorText result={requestState} />
            <SubmitButton>Kirim Kode OTP</SubmitButton>
          </form>
        ) : (
          <form action={verifyAction} className="space-y-4">
            <input type="hidden" name="phone" value={phone} />
            <div className="space-y-2">
              <Label htmlFor="token">Kode OTP (6 angka)</Label>
              <Input
                id="token"
                name="token"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                placeholder="••••••"
                required
                autoFocus
                className="text-center text-lg tracking-[0.5em]"
              />
            </div>
            <ErrorText result={verifyState} />
            <SubmitButton>Masuk</SubmitButton>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
