"use client";

import { Check, Copy, KeyRound, MessageCircle } from "lucide-react";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  issueActivationCodeAction,
  type KodeAktivasiResult,
} from "@/modules/auth/aktivasi-actions";

function TerbitkanButton({ aktif }: { aktif: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      <KeyRound className="h-4 w-4" aria-hidden />
      {pending ? "Membuat…" : aktif ? "Reset PIN" : "Kode aktivasi"}
    </Button>
  );
}

/**
 * Terbitkan kode aktivasi (atau reset PIN) untuk satu wali, lalu kirim lewat
 * tautan wa.me — admin yang menekan Kirim di WhatsApp. Kode hanya tampil sekali.
 */
export function AktivasiWali({
  guardianId,
  aktif,
}: {
  guardianId: string;
  aktif: boolean;
}) {
  const [state, action] = useFormState<KodeAktivasiResult | null, FormData>(
    issueActivationCodeAction,
    null,
  );
  const [tersalin, setTersalin] = useState(false);

  return (
    <div className="space-y-2">
      <form
        action={action}
        onSubmit={(e) => {
          if (
            aktif &&
            !confirm(
              "Wali ini sudah aktif. Kode baru dipakai untuk membuat PIN baru (reset). Lanjutkan?",
            )
          ) {
            e.preventDefault();
          }
          setTersalin(false);
        }}
      >
        <input type="hidden" name="guardian_id" value={guardianId} />
        <TerbitkanButton aktif={aktif} />
      </form>

      {state && !state.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      {state?.ok && (
        <div className="space-y-3 rounded-md border border-border bg-background p-3">
          <div>
            <p className="text-xs text-muted-foreground">
              Kode aktivasi untuk {state.nama} (berlaku 7 hari, sekali pakai):
            </p>
            <p className="font-mono text-2xl font-semibold tracking-widest">{state.kode}</p>
            <p className="text-xs text-muted-foreground">
              Kode hanya ditampilkan sekali. Bila hilang, terbitkan ulang — kode lama
              otomatis tidak berlaku.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={state.tautan}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-700 px-3 text-sm font-medium text-white hover:bg-emerald-800"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              Kirim via WhatsApp
            </a>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(state.pesan);
                setTersalin(true);
              }}
            >
              {tersalin ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
              {tersalin ? "Tersalin" : "Salin pesan"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
