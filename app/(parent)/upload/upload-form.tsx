"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { compressImage } from "@/lib/image";
import { cn, formatRupiah } from "@/lib/utils";
import { submitPayment } from "@/modules/payments/actions";

type Bill = { id: string; label: string; remaining: number };
type Child = { id: string; full_name: string; classLabel: string; bills: Bill[] };
type BankAccount = { bank: string; no_rek: string; atas_nama: string };

type Revision = {
  paymentId: string;
  billIds: string[];
  amount: number;
  senderName: string;
};

export function UploadForm({
  students,
  bankAccounts,
  preselectedChildId,
  revision,
}: {
  students: Child[];
  bankAccounts: BankAccount[];
  preselectedChildId?: string;
  revision?: Revision;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const initialChild =
    students.find((c) => c.id === preselectedChildId)?.id ?? students[0]!.id;
  const [childId, setChildId] = useState(initialChild);
  // Mode revisi: prefill tagihan (yang masih terbuka), nominal, & pengirim
  const initialBills = new Set(
    (revision?.billIds ?? []).filter((id) =>
      students.find((c) => c.id === initialChild)?.bills.some((b) => b.id === id),
    ),
  );
  const [selectedBills, setSelectedBills] = useState<Set<string>>(initialBills);
  const [amount, setAmount] = useState(revision ? String(revision.amount) : "");
  const [amountEdited, setAmountEdited] = useState(!!revision);
  const [bankName, setBankName] = useState(
    bankAccounts[0] ? `${bankAccounts[0].bank} - ${bankAccounts[0].no_rek}` : "",
  );
  const [senderName, setSenderName] = useState(revision?.senderName ?? "");
  const [transferredAt, setTransferredAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const child = students.find((c) => c.id === childId)!;

  const selectedTotal = useMemo(
    () =>
      child.bills
        .filter((b) => selectedBills.has(b.id))
        .reduce((sum, b) => sum + b.remaining, 0),
    [child.bills, selectedBills],
  );

  function switchChild(id: string) {
    setChildId(id);
    setSelectedBills(new Set());
    setAmount("");
    setAmountEdited(false);
  }

  function toggleBill(id: string) {
    const next = new Set(selectedBills);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedBills(next);
    if (!amountEdited) {
      const total = child.bills
        .filter((b) => next.has(b.id))
        .reduce((sum, b) => sum + b.remaining, 0);
      setAmount(total > 0 ? String(total) : "");
    }
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const raw = e.target.files?.[0];
    if (!raw) return;
    if (raw.size > 10 * 1024 * 1024) {
      setError("Berkas terlalu besar (maks 10 MB sebelum kompresi).");
      return;
    }
    const compressed = await compressImage(raw);
    setFile(compressed);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(
      compressed.type.startsWith("image/") ? URL.createObjectURL(compressed) : null,
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (selectedBills.size === 0) {
      setError("Pilih minimal satu tagihan.");
      return;
    }
    if (!file) {
      setError("Lampirkan bukti transfer.");
      return;
    }
    const amountNum = Number(amount);
    if (!Number.isInteger(amountNum) || amountNum <= 0) {
      setError("Nominal harus bilangan bulat lebih dari 0.");
      return;
    }

    const fd = new FormData();
    fd.set("student_id", childId);
    fd.set("amount", String(amountNum));
    fd.set("method", "transfer");
    fd.set("bank_name", bankName);
    fd.set("sender_name", senderName);
    fd.set("transferred_at", transferredAt ? new Date(transferredAt).toISOString() : "");
    selectedBills.forEach((id) => fd.append("bill_ids", id));
    if (revision) fd.set("revision_of", revision.paymentId);
    fd.set("proof", file);

    startTransition(async () => {
      const res = await submitPayment(fd);
      if (res.ok) {
        setDone(true);
        setTimeout(() => router.push("/riwayat"), 1200);
      } else {
        setError(res.error);
      }
    });
  }

  if (done) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <p className="font-medium">Bukti pembayaran terkirim</p>
          <p className="text-sm text-muted-foreground">
            Menunggu verifikasi admin sekolah. Mengalihkan ke Riwayat…
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {students.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pilih anak</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={childId} onChange={(e) => switchChild(e.target.value)}>
              {students.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} — {c.classLabel}
                </option>
              ))}
            </Select>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tagihan yang dibayar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {child.bills.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Tidak ada tagihan berjalan untuk anak ini.
            </p>
          ) : (
            child.bills.map((b) => (
              <label
                key={b.id}
                className={cn(
                  "flex cursor-pointer items-center justify-between rounded-md border px-3 py-2.5 text-sm",
                  selectedBills.has(b.id)
                    ? "border-primary bg-primary/5"
                    : "border-border",
                )}
              >
                <span className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={selectedBills.has(b.id)}
                    onChange={() => toggleBill(b.id)}
                  />
                  {b.label}
                </span>
                <span className="font-medium">{formatRupiah(b.remaining)}</span>
              </label>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detail transfer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">
              Nominal dibayar{" "}
              {selectedTotal > 0 && (
                <span className="text-muted-foreground">
                  (total tagihan {formatRupiah(selectedTotal)})
                </span>
              )}
            </Label>
            <Input
              id="amount"
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setAmountEdited(true);
              }}
              placeholder="0"
              required
            />
          </div>

          {bankAccounts.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="bank">Bank tujuan</Label>
              <Select id="bank" value={bankName} onChange={(e) => setBankName(e.target.value)}>
                {bankAccounts.map((acc) => (
                  <option key={acc.no_rek} value={`${acc.bank} - ${acc.no_rek}`}>
                    {acc.bank} · {acc.no_rek} · a.n. {acc.atas_nama}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="sender">Nama pengirim</Label>
            <Input
              id="sender"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Nama di rekening pengirim"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tgl">Tanggal transfer</Label>
            <Input
              id="tgl"
              type="date"
              value={transferredAt}
              onChange={(e) => setTransferredAt(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="proof">Bukti transfer (foto/PDF)</Label>
            <Input
              id="proof"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={onFileChange}
              className="pt-1.5"
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </p>
            )}
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Pratinjau bukti"
                className="mt-2 max-h-64 rounded-md border border-border bg-white object-contain"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Mengirim…
          </>
        ) : (
          "Kirim Bukti Pembayaran"
        )}
      </Button>
    </form>
  );
}
