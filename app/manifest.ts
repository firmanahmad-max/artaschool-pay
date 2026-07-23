import type { MetadataRoute } from "next";

/**
 * Web App Manifest — membuat PWA orang tua bisa dipasang ke layar utama
 * (PRD §7.1). `start_url` langsung ke /beranda: pengguna yang membuka dari
 * ikon layar utama tidak perlu melewati halaman perantara.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ArtaSchool Pay",
    short_name: "ArtaSchool",
    description:
      "Kirim bukti pembayaran sekolah dan pantau tagihan anak Anda dengan mudah.",
    lang: "id-ID",
    start_url: "/beranda",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Selaras token --background/--primary tema terang (PRD §7.4)
    background_color: "#f7f7fb",
    theme_color: "#4f46e5",
    categories: ["education", "finance"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Upload Pembayaran",
        short_name: "Upload",
        url: "/upload",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Riwayat",
        short_name: "Riwayat",
        url: "/riwayat",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
