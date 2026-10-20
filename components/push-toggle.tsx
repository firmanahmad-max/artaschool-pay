"use client";

import { Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { base64UrlKeUint8 } from "@/modules/notifications/push-content";
import {
  deletePushSubscription,
  savePushSubscription,
} from "@/modules/notifications/push-actions";

type Status =
  | "memeriksa"
  | "tidak-didukung"
  | "ios-perlu-pasang"
  | "ditolak"
  | "nonaktif"
  | "aktif"
  | "memproses";

function iPhoneAtauIPad(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function terpasangDiLayarUtama(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Aktifkan/matikan notifikasi aplikasi (Web Push) di perangkat ini.
 * iPhone/iPad hanya mendukung push untuk aplikasi yang dipasang ke Layar Utama.
 */
export function PushToggle({ publicKey }: { publicKey: string }) {
  const [status, setStatus] = useState<Status>("memeriksa");
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus(iPhoneAtauIPad() && !terpasangDiLayarUtama() ? "ios-perlu-pasang" : "tidak-didukung");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("ditolak");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        // Ponsel keluarga: klaim ulang perangkat ini untuk wali yang sedang masuk.
        await savePushSubscription(sub.toJSON() as Parameters<typeof savePushSubscription>[0]);
        setStatus("aktif");
      } else {
        setStatus("nonaktif");
      }
    })().catch(() => setStatus("tidak-didukung"));
  }, []);

  async function aktifkan() {
    setGalat(null);
    setStatus("memproses");
    try {
      const izin = await Notification.requestPermission();
      if (izin !== "granted") {
        setStatus(izin === "denied" ? "ditolak" : "nonaktif");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlKeUint8(publicKey),
      });
      const hasil = await savePushSubscription(
        sub.toJSON() as Parameters<typeof savePushSubscription>[0],
      );
      if (!hasil.ok) {
        await sub.unsubscribe();
        setGalat(hasil.error);
        setStatus("nonaktif");
        return;
      }
      setStatus("aktif");
    } catch {
      setGalat("Gagal mengaktifkan notifikasi di perangkat ini.");
      setStatus("nonaktif");
    }
  }

  async function matikan() {
    setGalat(null);
    setStatus("memproses");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("nonaktif");
    } catch {
      setGalat("Gagal mematikan notifikasi.");
      setStatus("aktif");
    }
  }

  if (status === "memeriksa") {
    return <p className="text-sm text-muted-foreground">Memeriksa perangkat…</p>;
  }
  if (status === "ios-perlu-pasang") {
    return (
      <p className="text-sm text-muted-foreground">
        Di iPhone/iPad, pasang aplikasi dulu: buka di Safari → tombol{" "}
        <strong>Bagikan</strong> → <strong>Tambah ke Layar Utama</strong>, lalu buka
        dari ikon tersebut dan kembali ke halaman ini.
      </p>
    );
  }
  if (status === "tidak-didukung") {
    return (
      <p className="text-sm text-muted-foreground">
        Browser ini belum mendukung notifikasi aplikasi. Coba Chrome di Android.
      </p>
    );
  }
  if (status === "ditolak") {
    return (
      <p className="text-sm text-muted-foreground">
        Notifikasi diblokir di pengaturan browser. Izinkan notifikasi untuk situs ini
        di pengaturan browser, lalu muat ulang halaman.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {status === "aktif" ? (
        <Button type="button" variant="outline" size="sm" onClick={matikan}>
          <BellOff className="h-4 w-4" aria-hidden />
          Matikan notifikasi di perangkat ini
        </Button>
      ) : (
        <Button type="button" size="sm" onClick={aktifkan} disabled={status === "memproses"}>
          <Bell className="h-4 w-4" aria-hidden />
          {status === "memproses" ? "Memproses…" : "Aktifkan notifikasi"}
        </Button>
      )}
      {status === "aktif" && (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">
          Notifikasi aktif di perangkat ini.
        </p>
      )}
      {galat && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {galat}
        </p>
      )}
    </div>
  );
}
