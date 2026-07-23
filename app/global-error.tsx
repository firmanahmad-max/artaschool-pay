"use client";

import { useEffect } from "react";

/**
 * Penangkap terakhir bila render React gagal total. Tanpa ini pengguna
 * melihat layar kosong dan tidak ada laporan yang sampai ke Sentry.
 *
 * Sengaja memakai gaya sebaris (tanpa Tailwind): berkas ini menggantikan
 * seluruh dokumen termasuk <html>, sehingga stylesheet aplikasi belum tentu
 * termuat saat galat terjadi.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Dilaporkan lewat server (bukan SDK browser) agar bundel tetap ringan
    // untuk orang tua di jaringan 3G — lihat app/api/lapor-galat/route.ts.
    // Penyaringan UU PDP dilakukan di sisi server.
    void fetch("/api/lapor-galat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pesan: error.message,
        jejak: error.stack,
        jalur: typeof location !== "undefined" ? location.pathname : undefined,
      }),
      keepalive: true,
    }).catch(() => {
      // gagal melapor tidak boleh memperburuk keadaan pengguna
    });
  }, [error]);

  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#f7f7fb",
          color: "#0f172a",
        }}
      >
        <div style={{ maxWidth: "24rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600, margin: "0 0 0.5rem" }}>
            Terjadi gangguan
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#475569", margin: "0 0 1.25rem" }}>
            Maaf, halaman ini gagal dimuat. Laporan sudah kami terima. Silakan
            coba lagi — data pembayaran Anda tidak terpengaruh.
          </p>
          <button
            onClick={() => reset()}
            style={{
              cursor: "pointer",
              borderRadius: "0.5rem",
              border: "none",
              background: "#4f46e5",
              color: "#fff",
              padding: "0.625rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            Coba Lagi
          </button>
        </div>
      </body>
    </html>
  );
}
