"use client";

import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatRupiah } from "@/lib/utils";
import { approvePayment, reviewPayment } from "@/modules/verification/actions";
import type { OpenBill } from "@/modules/verification/queries";

type Mode = "approve" | "rejected" | "needs_revision";

const MODES: { value: Mode; label: string; key: string; icon: typeof CheckCircle2 }[] = [
  { value: "approve", label: "Terima (A)", key: "a", icon: CheckCircle2 },
  { value: "rejected", label: "Tolak (R)", key: "r", icon: XCircle },
  { value: "needs_revision", label: "Revisi (V)", key: "v", icon: RotateCcw },
];

function SubmitButton({
  children,
  variant,
  disabled,
}: {
  children: React.ReactNode;
  variant?: "default" | "destructive" | "outline";
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending || disabled}>
      {pending ? "Memproses…" : children}
    </Button>
  );
}

export function VerifyForm({
  paymentId,
  amount,
  bills,
  proposal,
  leftover,
}: {
  paymentId: string;
  amount: number;
  bills: OpenBill[];
  proposal: Record<string, number>;
  leftover: number;
}) {
  const [mode, setMode] = useState<Mode>("approve");
  const [alloc, setAlloc] = useState<Record<string, string>>(() =>
    Object.fromEntries(bills.map((b) => [b.id, String(proposal[b.id] ?? 0)])),
  );
  const [approveState, approveAction] = useFormState(approvePayment, null);
  const [reviewState, reviewAction] = useFormState(reviewPayment, null);

  // Keyboard shortcut A/R/V (PRD §7.2) — abaikan saat mengetik di input
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const found = MODES.find((m) => m.key === e.key.toLowerCase());
      if (found) setMode(found.value);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const total = useMemo(
    () =>
      bills.reduce((sum, b) => {
        const v = Number(alloc[b.id]);
        return sum + (Number.isInteger(v) && v > 0 ? v : 0);
      }, 0),
    [bills, alloc],
  );
  const balanced = total === amount;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Aksi verifikasi</CardTitle>
        <CardDescription>
          Pintasan keyboard: A = Terima, R = Tolak, V = Perlu Revisi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div role="tablist" aria-label="Pilih aksi" className="flex gap-2">
          {MODES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium",
                mode === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>

        {mode === "approve" ? (
          <form action={approveAction} className="space-y-4">
            <input type="hidden" name="payment_id" value={paymentId} />
            <div className="space-y-2">
              {bills.length === 0 && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  Siswa tidak punya tagihan terbuka — pembayaran tidak bisa
                  dialokasikan. Tolak atau minta revisi.
                </p>
              )}
              {bills.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                >
                  <div className="text-sm">
                    <p className="font-medium">
                      {b.label}
                      {b.requested && (
                        <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          dipilih ortu
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Sisa tagihan {formatRupiah(b.remaining)}
                    </p>
                  </div>
                  <div className="w-36">
                    <Label htmlFor={`alloc_${b.id}`} className="sr-only">
                      Alokasi {b.label}
                    </Label>
                    <Input
                      id={`alloc_${b.id}`}
                      name={`alloc_${b.id}`}
                      type="number"
                      min="0"
                      step="1"
                      value={alloc[b.id] ?? "0"}
                      onChange={(e) =>
                        setAlloc((prev) => ({ ...prev, [b.id]: e.target.value }))
                      }
                      className="text-right"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div
              className={cn(
                "rounded-md px-3 py-2 text-sm",
                balanced
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
              )}
            >
              Total alokasi {formatRupiah(total)} dari nominal{" "}
              {formatRupiah(amount)}
              {!balanced && " — harus sama persis sebelum bisa disetujui"}
              {leftover > 0 &&
                balanced === false &&
                ` (usulan otomatis menyisakan ${formatRupiah(leftover)} karena tagihan terbuka tidak cukup)`}
            </div>

            {approveState && !approveState.ok && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {approveState.error}
              </p>
            )}
            <SubmitButton disabled={!balanced || bills.length === 0}>
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Setujui &amp; Eksekusi Alokasi
            </SubmitButton>
          </form>
        ) : (
          <form action={reviewAction} className="space-y-4">
            <input type="hidden" name="payment_id" value={paymentId} />
            <input type="hidden" name="action" value={mode} />
            <div className="space-y-2">
              <Label htmlFor="note">
                Catatan untuk orang tua (wajib)
                {mode === "needs_revision" &&
                  " — jelaskan apa yang salah dan cara memperbaikinya"}
              </Label>
              <textarea
                id="note"
                name="note"
                required
                rows={3}
                className="flex w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder={
                  mode === "rejected"
                    ? "Mis. bukti transfer tidak terbaca / bukan transaksi ke rekening sekolah"
                    : "Mis. nominal di bukti (Rp 300.000) tidak sama dengan yang diisi"
                }
              />
            </div>
            {reviewState && !reviewState.ok && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {reviewState.error}
              </p>
            )}
            <SubmitButton variant="destructive">
              {mode === "rejected" ? (
                <>
                  <XCircle className="h-4 w-4" aria-hidden />
                  Tolak Pembayaran
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  Minta Revisi
                </>
              )}
            </SubmitButton>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
