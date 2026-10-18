"use client";

import { Check, CircleSlash, Copy, MessageCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markSentManually, skipNotification } from "@/modules/notifications/actions";

export type OutboxItem = {
  id: number;
  phone: string;
  nama: string | null;
  jenis: string;
  body: string;
  status: string;
  lastError: string | null;
  waktu: string;
  tautan: string;
};

/**
 * Satu pesan di Kotak Keluar: buka WhatsApp dengan pesan siap kirim, lalu
 * tandai terkirim. Tombol "Tandai terkirim" menonjol setelah tautan dibuka
 * agar admin tak lupa menutup siklusnya.
 */
export function OutboxRow({ item }: { item: OutboxItem }) {
  const [dibuka, setDibuka] = useState(false);
  const [tersalin, setTersalin] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function jalankan(aksi: (id: number) => Promise<{ ok: boolean; error?: string }>) {
    setGalat(null);
    startTransition(async () => {
      const hasil = await aksi(item.id);
      if (!hasil.ok) setGalat(hasil.error ?? "Gagal memproses pesan.");
    });
  }

  return (
    <li
      className={`space-y-3 rounded-md border p-4 ${
        dibuka ? "border-emerald-400 dark:border-emerald-700" : "border-border"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm">
          <span className="font-medium">{item.nama ?? "Kepala sekolah / admin"}</span>{" "}
          <span className="font-mono text-xs text-muted-foreground">{item.phone}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {item.jenis} · {item.waktu}
        </p>
      </div>

      <p className="whitespace-pre-line rounded-md bg-background p-3 text-sm">{item.body}</p>

      {item.status === "dead" && item.lastError && (
        <p className="text-xs text-red-600 dark:text-red-400">
          Gateway gagal: {item.lastError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <a
          href={item.tautan}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setDibuka(true)}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          Buka WhatsApp
        </a>
        <Button
          type="button"
          size="sm"
          variant={dibuka ? "default" : "outline"}
          disabled={pending}
          onClick={() => jalankan(markSentManually)}
        >
          <Check className="h-4 w-4" aria-hidden />
          Tandai terkirim
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={async () => {
            await navigator.clipboard.writeText(item.body);
            setTersalin(true);
          }}
        >
          <Copy className="h-4 w-4" aria-hidden />
          {tersalin ? "Tersalin" : "Salin"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            if (confirm("Lewati pesan ini? Pesan tidak akan dikirim.")) {
              jalankan(skipNotification);
            }
          }}
          className="text-muted-foreground"
        >
          <CircleSlash className="h-4 w-4" aria-hidden />
          Lewati
        </Button>
      </div>

      {galat && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {galat}
        </p>
      )}
    </li>
  );
}
