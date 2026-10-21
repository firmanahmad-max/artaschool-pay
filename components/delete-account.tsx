"use client";

import { Trash2, TriangleAlert } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { AksiForm, useStatusAksi } from "@/components/ui/aksi-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteMyGuardianAccount,
  type ActionResult,
} from "@/modules/auth/actions";

function ConfirmButton() {
  const { pending } = useStatusAksi();
  return (
    <Button
      type="submit"
      variant="outline"
      size="sm"
      disabled={pending}
      className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
    >
      <Trash2 className="h-4 w-4" aria-hidden />
      {pending ? "Menghapus…" : "Hapus akun saya"}
    </Button>
  );
}

/**
 * Penghapusan akun wali (UU PDP §8). Dua langkah agar tak terpicu tak sengaja:
 * buka bagian bahaya → ketik HAPUS → kirim. Sebelum submit, cache service
 * worker dibersihkan (ponsel keluarga kerap dipakai bergantian).
 */
export function DeleteAccountSection() {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    deleteMyGuardianAccount,
    null,
  );
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        Hapus akun
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-red-200 bg-red-50/50 p-4 dark:border-red-900 dark:bg-red-950/30">
      <div className="flex gap-2 text-sm text-red-800 dark:text-red-300">
        <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden />
        <div className="space-y-1">
          <p className="font-medium">Tindakan ini permanen.</p>
          <p>
            Data pribadi Anda (nama, nomor HP, email) dan akses login akan
            dihapus. Riwayat pembayaran yang sudah tercatat tetap disimpan
            sekolah untuk kebutuhan pembukuan, tanpa identitas Anda.
          </p>
        </div>
      </div>

      <AksiForm
        action={action}
        onSubmit={() => {
          navigator.serviceWorker?.controller?.postMessage("bersihkan-cache");
        }}
        className="space-y-3"
      >
        <div className="space-y-2">
          <Label htmlFor="konfirmasi">
            Ketik <span className="font-mono font-semibold">HAPUS</span> untuk
            mengonfirmasi
          </Label>
          <Input
            id="konfirmasi"
            name="konfirmasi"
            autoComplete="off"
            placeholder="HAPUS"
            required
          />
        </div>

        {state && !state.ok && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <ConfirmButton />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
          >
            Batal
          </Button>
        </div>
      </AksiForm>
    </div>
  );
}
