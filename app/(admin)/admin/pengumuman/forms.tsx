"use client";

import { Check, Copy, Megaphone, Send } from "lucide-react";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  broadcastAnnouncement,
  createAnnouncement,
  type ActionResult,
} from "@/modules/announcements/actions";

type ClassOption = { id: string; label: string };

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Memproses…" : children}
    </Button>
  );
}

function Feedback({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return state.ok ? (
    <p className="text-sm text-emerald-700 dark:text-emerald-300">{state.message}</p>
  ) : (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
      {state.error}
    </p>
  );
}

export function AnnouncementForm({
  classes,
  manual,
}: {
  classes: ClassOption[];
  manual: boolean;
}) {
  const [state, action] = useFormState(createAnnouncement, null);
  const [scope, setScope] = useState<"all" | "class">("all");

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Judul</Label>
        <Input id="title" name="title" required maxLength={150} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="body">Isi</Label>
        <textarea
          id="body"
          name="body"
          rows={3}
          maxLength={2000}
          className="flex w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="scope">Audiens</Label>
          <Select
            id="scope"
            name="scope"
            value={scope}
            onChange={(e) => setScope(e.target.value as "all" | "class")}
          >
            <option value="all">Semua wali</option>
            <option value="class">Kelas tertentu</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="publish_at">Tayang mulai (opsional)</Label>
          <Input id="publish_at" name="publish_at" type="datetime-local" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expires_at">Berakhir (opsional)</Label>
          <Input id="expires_at" name="expires_at" type="datetime-local" />
        </div>
      </div>

      {scope === "class" && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Pilih kelas</legend>
          <div className="flex flex-wrap gap-3">
            {classes.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Belum ada kelas di tahun ajaran aktif.
              </p>
            )}
            {classes.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="class_ids" value={c.id} className="h-4 w-4" />
                {c.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="broadcast" className="h-4 w-4" />
        {manual
          ? "Masukkan juga ke Kotak Keluar WA (satu pesan per wali, dikirim manual)"
          : "Kirim juga sebagai broadcast WhatsApp (masuk antrean, ber-throttle)"}
      </label>

      <div className="flex items-center gap-3">
        <SubmitButton>
          <Megaphone className="h-4 w-4" aria-hidden />
          Simpan Pengumuman
        </SubmitButton>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function BroadcastButton({ id, manual }: { id: string; manual: boolean }) {
  const [state, action] = useFormState(broadcastAnnouncement, null);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="outline" size="sm">
        <Send className="h-4 w-4" aria-hidden />
        {manual ? "Ke Kotak Keluar" : "Broadcast WA"}
      </Button>
      {state && (
        <span
          className={
            state.ok
              ? "text-xs text-emerald-700 dark:text-emerald-300"
              : "text-xs text-red-600 dark:text-red-400"
          }
        >
          {state.ok ? state.message : state.error}
        </span>
      )}
    </form>
  );
}

/**
 * Salin teks pengumuman (format sama dgn broadcast) untuk ditempel ke Daftar
 * Siaran / grup WhatsApp — satu kali kirim ke banyak wali di mode manual.
 */
export function SalinTeksButton({ teks }: { teks: string }) {
  const [tersalin, setTersalin] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(teks);
        setTersalin(true);
      }}
    >
      {tersalin ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      {tersalin ? "Tersalin" : "Salin teks"}
    </Button>
  );
}
