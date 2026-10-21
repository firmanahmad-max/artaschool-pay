"use client";

import { Save } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { AksiForm, useStatusAksi } from "@/components/ui/aksi-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateMyGuardianProfile,
  type ActionResult,
} from "@/modules/auth/actions";

function SaveButton() {
  const { pending } = useStatusAksi();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <Save className="h-4 w-4" aria-hidden />
      {pending ? "Menyimpan…" : "Simpan"}
    </Button>
  );
}

/** Sunting nama & email wali. Nomor HP ditampilkan read-only. */
export function EditProfileForm({
  fullName,
  email,
  phone,
}: {
  fullName: string;
  email: string | null;
  phone: string;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    updateMyGuardianProfile,
    null,
  );

  return (
    <AksiForm action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="full_name">Nama</Label>
        <Input
          id="full_name"
          name="full_name"
          defaultValue={fullName}
          required
          maxLength={100}
          autoComplete="name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email (opsional)</Label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={email ?? ""}
          maxLength={150}
          autoComplete="email"
          placeholder="nama@contoh.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Nomor HP</Label>
        <Input id="phone" value={phone} disabled readOnly />
        <p className="text-xs text-muted-foreground">
          Nomor HP adalah kunci login Anda. Untuk mengubahnya, hubungi pihak
          sekolah.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <SaveButton />
        {state && (
          <span
            role={state.ok ? "status" : "alert"}
            className={
              state.ok
                ? "text-sm text-emerald-700 dark:text-emerald-300"
                : "text-sm text-red-600 dark:text-red-400"
            }
          >
            {state.ok ? state.message : state.error}
          </span>
        )}
      </div>
    </AksiForm>
  );
}
