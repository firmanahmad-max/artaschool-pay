import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    default: "ArtaSchool Pay",
    template: "%s · ArtaSchool Pay",
  },
  description:
    "Administrasi pembayaran sekolah yang cepat, transparan & modern.",
  manifest: "/manifest.webmanifest",
  // iOS belum sepenuhnya membaca manifest — butuh meta khusus agar bisa
  // dipasang ke layar utama dan tampil tanpa bilah browser.
  appleWebApp: {
    capable: true,
    title: "ArtaSchool",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Aman untuk ponsel berponi saat berjalan mode standalone
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Nonce CSP per-request dari middleware. Membaca header ini SENGAJA membuat
  // seluruh halaman dirender dinamis: halaman yang di-prerender statis tidak
  // bisa diberi nonce, sehingga SEMUA skripnya diblokir CSP dan React tak
  // pernah hidrasi (terbukti pada /privasi, /admin/login, /offline di build
  // produksi). Lihat nextjs.org/docs/app/guides/content-security-policy.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    // suppressHydrationWarning: next-themes menyetel class="dark" sebelum hydration
    <html lang="id" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  );
}
