"use client";

import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Mendaftarkan service worker + menampilkan indikator saat perangkat offline
 * (PRD §7.1 — PWA offline-aware).
 *
 * Catatan jujur soal antrean upload offline: Background Sync tidak didukung
 * Safari/iOS, sehingga "kirim otomatis saat online kembali" tidak bisa
 * diandalkan lintas perangkat. Alih-alih menjanjikan yang tak bisa ditepati,
 * kami menampilkan status koneksi dengan jelas agar orang tua tahu kapan
 * kiriman akan berhasil.
 */
export function PwaProvider() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // pendaftaran gagal tidak boleh mengganggu pemakaian aplikasi
      });
    }

    const perbarui = () => setOffline(!navigator.onLine);
    perbarui();
    window.addEventListener("online", perbarui);
    window.addEventListener("offline", perbarui);
    return () => {
      window.removeEventListener("online", perbarui);
      window.removeEventListener("offline", perbarui);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950"
    >
      <WifiOff className="h-4 w-4" aria-hidden />
      Tidak ada koneksi — data yang tampil mungkin belum terbaru
    </div>
  );
}
