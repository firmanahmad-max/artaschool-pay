"use client";

import { LogOut } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { logout } from "@/modules/auth/actions";
import { deletePushSubscription } from "@/modules/notifications/push-actions";

/** Cabut langganan push perangkat ini (maks. 3 detik agar keluar tak tertahan). */
async function cabutPush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const kerja = (async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager?.getSubscription();
    if (!sub) return;
    await deletePushSubscription(sub.endpoint);
    await sub.unsubscribe();
  })();
  await Promise.race([kerja.catch(() => {}), new Promise((r) => setTimeout(r, 3000))]);
}

/**
 * Tombol keluar. Sebelum menutup sesi, service worker diminta membuang cache
 * halaman — penting karena ponsel keluarga kerap dipakai bergantian dan
 * riwayat pembayaran anak tidak boleh tertinggal di perangkat. Untuk wali,
 * langganan notifikasi push perangkat ini juga dicabut, agar notifikasi
 * pembayaran tidak terus muncul untuk orang yang sudah keluar.
 */
export function LogoutButton({
  target,
  label = "Keluar",
}: {
  target: "parent" | "admin";
  label?: string;
}) {
  const logoutWithTarget = logout.bind(null, target);
  const siapKeluar = useRef(false);

  return (
    <form
      action={logoutWithTarget}
      onSubmit={(e) => {
        navigator.serviceWorker?.controller?.postMessage("bersihkan-cache");
        if (target !== "parent" || siapKeluar.current) return;
        // Tahan submit sebentar: cabut push SELAGI sesi masih ada (RPC butuh sesi).
        e.preventDefault();
        const form = e.currentTarget;
        cabutPush().finally(() => {
          siapKeluar.current = true;
          form.requestSubmit();
        });
      }}
    >
      <Button variant="outline" size="sm" type="submit">
        <LogOut className="h-4 w-4" aria-hidden />
        {label}
      </Button>
    </form>
  );
}
