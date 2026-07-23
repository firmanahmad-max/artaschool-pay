import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: next-themes menyetel class="dark" sebelum hydration
    <html lang="id" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
