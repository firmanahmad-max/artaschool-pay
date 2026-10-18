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
import {
  activateGuardianAccount,
  loginParentPin,
} from "@/modules/auth/aktivasi-actions";

type Mode = "pin" | "aktivasi" | "otp";

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

function PhoneField({
  phone,
  setPhone,
}: {
  phone: string;
  setPhone: (v: string) => void;
}) {
  return (
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
  );
}

function PinField({
  id,
  name,
  label,
  autoComplete,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type="password"
        inputMode="numeric"
        pattern="\d{6}"
        maxLength={6}
        autoComplete={autoComplete}
        placeholder="••••••"
        required
        className="text-center text-lg tracking-[0.5em]"
      />
    </div>
  );
}

function LinkButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-center text-sm text-primary underline-offset-4 hover:underline"
    >
      {children}
    </button>
  );
}

/**
 * Masuk wali. Utama: nomor HP + PIN (tanpa gateway). Aktivasi: kode dari
 * sekolah → buat PIN (juga dipakai untuk "lupa PIN"). OTP WhatsApp hanya
 * ditawarkan bila server punya gateway (`otpTersedia`).
 */
export function ParentLoginForm({
  otpTersedia,
  awal = "pin",
}: {
  otpTersedia: boolean;
  awal?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(awal);
  const [phone, setPhone] = useState("");
  const [pinState, pinAction] = useFormState(loginParentPin, null);
  const [aktivasiState, aktivasiAction] = useFormState(activateGuardianAccount, null);
  const [requestState, requestAction] = useFormState(requestParentOtp, null);
  const [verifyState, verifyAction] = useFormState(verifyParentOtp, null);
  const otpSent = requestState?.ok === true;

  const judul =
    mode === "aktivasi" ? "Aktivasi Akun Wali" : "Masuk Orang Tua / Wali";
  const keterangan =
    mode === "pin"
      ? "Masuk dengan nomor HP yang terdaftar di sekolah dan PIN Anda."
      : mode === "aktivasi"
        ? "Masukkan kode aktivasi dari sekolah, lalu buat PIN 6 angka. Juga dipakai bila lupa PIN."
        : otpSent
          ? `Kode verifikasi dikirim ke WhatsApp ${phone}.`
          : "Kode verifikasi dikirim via WhatsApp ke nomor terdaftar.";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{judul}</CardTitle>
        <CardDescription>{keterangan}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {mode === "pin" && (
          <form action={pinAction} className="space-y-4">
            <PhoneField phone={phone} setPhone={setPhone} />
            <PinField id="pin" name="pin" label="PIN (6 angka)" autoComplete="current-password" />
            <ErrorText result={pinState} />
            <SubmitButton>Masuk</SubmitButton>
          </form>
        )}

        {mode === "aktivasi" && (
          <form action={aktivasiAction} className="space-y-4">
            <PhoneField phone={phone} setPhone={setPhone} />
            <div className="space-y-2">
              <Label htmlFor="kode">Kode aktivasi</Label>
              <Input
                id="kode"
                name="kode"
                autoComplete="one-time-code"
                autoCapitalize="characters"
                placeholder="ABCD-EFGH"
                maxLength={9}
                required
                className="text-center font-mono text-lg uppercase tracking-widest"
              />
            </div>
            <PinField id="pin" name="pin" label="Buat PIN (6 angka)" autoComplete="new-password" />
            <PinField id="pin_ulang" name="pin_ulang" label="Ulangi PIN" autoComplete="new-password" />
            <p className="text-xs text-muted-foreground">
              Hindari PIN mudah ditebak seperti 123456 atau 111111.
            </p>
            <ErrorText result={aktivasiState} />
            <SubmitButton>Aktifkan &amp; Masuk</SubmitButton>
          </form>
        )}

        {mode === "otp" &&
          (!otpSent ? (
            <form action={requestAction} className="space-y-4">
              <PhoneField phone={phone} setPhone={setPhone} />
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
          ))}

        <div className="space-y-2 border-t border-border pt-3">
          {mode !== "pin" && (
            <LinkButton onClick={() => setMode("pin")}>Masuk dengan PIN</LinkButton>
          )}
          {mode !== "aktivasi" && (
            <LinkButton onClick={() => setMode("aktivasi")}>
              Belum punya PIN / lupa PIN? Aktivasi akun
            </LinkButton>
          )}
          {otpTersedia && mode !== "otp" && (
            <LinkButton onClick={() => setMode("otp")}>
              Masuk dengan kode WhatsApp
            </LinkButton>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
