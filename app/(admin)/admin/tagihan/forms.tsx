"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  createIndividualBill,
  createPaymentType,
  generateBills,
  waiveBill,
} from "@/modules/billing/actions";

type PaymentType = {
  id: string;
  name: string;
  default_amount: number | null;
  is_recurring: boolean | null;
};
type StudentOption = { id: string; nis: string; full_name: string };

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Memproses…" : children}
    </Button>
  );
}

function Feedback({ state }: { state: { ok: boolean; error?: string; message?: string } | null }) {
  if (!state) return null;
  if (state.ok) {
    return (
      <p className="text-sm text-emerald-700 dark:text-emerald-300">
        {state.message ?? "Berhasil."}
      </p>
    );
  }
  return (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
      {state.error}
    </p>
  );
}

export function PaymentTypeForm() {
  const [state, action] = useFormState(createPaymentType, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-2">
        <Label htmlFor="name">Nama</Label>
        <Input id="name" name="name" placeholder="SPP" required className="w-40" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="default_amount">Nominal default (Rp)</Label>
        <Input
          id="default_amount"
          name="default_amount"
          type="number"
          min="0"
          step="1"
          placeholder="350000"
          required
          className="w-40"
        />
      </div>
      <label className="flex items-center gap-2 pb-2.5 text-sm">
        <input type="checkbox" name="is_recurring" className="h-4 w-4" />
        Berulang (bulanan)
      </label>
      <SubmitButton>Tambah Jenis</SubmitButton>
      <Feedback state={state} />
    </form>
  );
}

export function GenerateBillsForm({ types }: { types: PaymentType[] }) {
  const [state, action] = useFormState(generateBills, null);
  const [selectedId, setSelectedId] = useState(types[0]?.id ?? "");
  const selected = types.find((t) => t.id === selectedId);
  const recurring = selected?.is_recurring ?? false;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="is_recurring" value={String(recurring)} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="gen_type">Jenis pembayaran</Label>
          <Select
            id="gen_type"
            name="payment_type_id"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            required
          >
            {types.length === 0 && <option value="">— belum ada —</option>}
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.is_recurring ? " (bulanan)" : ""}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="gen_month">
            Periode {recurring ? "(wajib)" : "(non-aktif untuk jenis ini)"}
          </Label>
          <Input id="gen_month" name="month" type="month" disabled={!recurring} required={recurring} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gen_due">Jatuh tempo (opsional)</Label>
          <Input id="gen_due" name="due_date" type="date" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton>Generate untuk Semua Siswa Aktif</SubmitButton>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function IndividualBillForm({
  types,
  students,
}: {
  types: PaymentType[];
  students: StudentOption[];
}) {
  const [state, action] = useFormState(createIndividualBill, null);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ind_student">Siswa</Label>
          <Select id="ind_student" name="student_id" required defaultValue="">
            <option value="" disabled>
              Pilih siswa…
            </option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name} ({s.nis})
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ind_type">Jenis pembayaran</Label>
          <Select id="ind_type" name="payment_type_id" required defaultValue="">
            <option value="" disabled>
              Pilih jenis…
            </option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ind_amount">Nominal (Rp)</Label>
          <Input id="ind_amount" name="amount" type="number" min="1" step="1" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ind_due">Jatuh tempo (opsional)</Label>
          <Input id="ind_due" name="due_date" type="date" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton>Buat Tagihan Individual</SubmitButton>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function WaiveBillForm({ billId }: { billId: string }) {
  const [state, action] = useFormState(waiveBill, null);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Bebaskan
      </Button>
    );
  }
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="bill_id" value={billId} />
      <Input name="note" placeholder="Alasan (wajib)" required className="h-9 w-44" autoFocus />
      <Button type="submit" size="sm" variant="outline">
        Simpan
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Batal
      </Button>
      {state && !state.ok && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {state.error}
        </span>
      )}
    </form>
  );
}
