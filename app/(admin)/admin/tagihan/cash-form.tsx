"use client";

import { Banknote } from "lucide-react";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { recordCashPayment } from "@/modules/billing/cash-actions";
import { formatRupiah } from "@/lib/utils";

type Bill = { id: string; label: string; remaining: number };

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      <Banknote className="h-4 w-4" aria-hidden />
      {pending ? "Menyimpan…" : "Catat Pembayaran"}
    </Button>
  );
}

export function CashPaymentForm({
  studentId,
  studentName,
  bills,
}: {
  studentId: string;
  studentName: string;
  bills: Bill[];
}) {
  const [state, action] = useFormState(recordCashPayment, null);
  // Pra-isi penuh setiap tagihan; admin bisa mengurangi untuk bayar sebagian
  const [alloc, setAlloc] = useState<Record<string, string>>(() =>
    Object.fromEntries(bills.map((b) => [b.id, String(b.remaining)])),
  );

  const total = bills.reduce((sum, b) => {
    const v = Number(alloc[b.id]);
    return sum + (Number.isInteger(v) && v > 0 ? v : 0);
  }, 0);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="student_id" value={studentId} />

      {bills.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {studentName} tidak punya tagihan terbuka.
        </p>
      ) : (
        <div className="space-y-2">
          {bills.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
            >
              <div className="text-sm">
                <p className="font-medium">{b.label}</p>
                <p className="text-xs text-muted-foreground">
                  Sisa {formatRupiah(b.remaining)}
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
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="method">Metode</Label>
          <Select id="method" name="method" defaultValue="cash">
            <option value="cash">Tunai di sekolah</option>
            <option value="qris">QRIS</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="note">Keterangan (opsional)</Label>
          <Input id="note" name="note" placeholder="mis. diterima di TU oleh Ibu Ani" />
        </div>
      </div>

      <div className="rounded-md bg-background px-3 py-2 text-sm">
        Total dicatat: <span className="font-semibold">{formatRupiah(total)}</span>
      </div>

      {state && (
        <p
          role={state.ok ? undefined : "alert"}
          className={
            state.ok
              ? "text-sm text-emerald-700 dark:text-emerald-300"
              : "text-sm text-red-600 dark:text-red-400"
          }
        >
          {state.ok ? state.message : state.error}
        </p>
      )}

      <SubmitButton disabled={total <= 0} />
    </form>
  );
}
