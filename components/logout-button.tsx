"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/modules/auth/actions";

/**
 * Tombol keluar. Sebelum menutup sesi, service worker diminta membuang cache
 * halaman — penting karena ponsel keluarga kerap dipakai bergantian dan
 * riwayat pembayaran anak tidak boleh tertinggal di perangkat.
 */
export function LogoutButton({
  target,
  label = "Keluar",
}: {
  target: "parent" | "admin";
  label?: string;
}) {
  const logoutWithTarget = logout.bind(null, target);

  return (
    <form
      action={logoutWithTarget}
      onSubmit={() => {
        navigator.serviceWorker?.controller?.postMessage("bersihkan-cache");
      }}
    >
      <Button variant="outline" size="sm" type="submit">
        <LogOut className="h-4 w-4" aria-hidden />
        {label}
      </Button>
    </form>
  );
}
