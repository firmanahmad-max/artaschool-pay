"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { bolehLapor, kategoriPerangkat, perluLapor } from "@/lib/statistik-perangkat";

const KUNCI = "arta-statistik-perangkat";

/**
 * Deteksi fitur yang diwajibkan Tailwind 4 — jawaban langsung atas pertanyaan
 * "apakah tampilan akan rusak di perangkat ini?", bukan tebakan dari UA.
 */
function dukungTailwind4(): boolean {
  try {
    return (
      typeof CSS !== "undefined" &&
      CSS.supports("color", "color-mix(in srgb, red, blue)") &&
      CSS.supports("color", "oklch(0.5 0.1 200)") &&
      typeof (CSS as unknown as { registerProperty?: unknown }).registerProperty === "function"
    );
  } catch {
    return false;
  }
}

/**
 * Lapor statistik perangkat ANONIM, maksimal sekali sehari per perangkat,
 * setelah halaman tenang (tak mengganggu waktu muat). Dilewati bila browser
 * meminta Do Not Track / Global Privacy Control. Tidak ada identitas yang dikirim.
 */
export function StatistikPerangkat() {
  const pathname = usePathname();

  useEffect(() => {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (!bolehLapor({ doNotTrack: nav.doNotTrack, gpc: nav.globalPrivacyControl })) return;

    const hariIni = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD lokal
    try {
      if (!perluLapor(localStorage.getItem(KUNCI), hariIni)) return;
    } catch {
      return; // penyimpanan diblokir → tak bisa membatasi frekuensi, jangan lapor
    }

    const id = window.setTimeout(() => {
      const p = kategoriPerangkat(navigator.userAgent);
      fetch("/api/statistik-perangkat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          area: pathname.startsWith("/admin") ? "admin" : "wali",
          browser: p.browser,
          versi: p.versi,
          os: p.os,
          osVersi: p.osVersi,
          tw4: dukungTailwind4(),
        }),
      })
        .then((r) => {
          if (r.ok) localStorage.setItem(KUNCI, hariIni);
        })
        .catch(() => {});
    }, 4000);
    return () => window.clearTimeout(id);
    // Sekali per pemuatan aplikasi; pathname hanya untuk menandai area.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
