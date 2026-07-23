import { withSentryConfig } from "@sentry/nextjs";

/**
 * Header keamanan statis. CSP TIDAK di sini — dibangun per-request dengan
 * nonce di `middleware.ts` (lihat `lib/csp.ts`), karena nonce harus berbeda
 * setiap request dan tidak bisa ditulis di config statis.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // dibutuhkan instrumentation.ts di Next.js 14
    instrumentationHook: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// Tanpa SENTRY_DSN, Sentry tidak diinisialisasi (lihat sentry.*.config.ts).
// Pembungkus tetap dipasang agar build konsisten di kedua keadaan.
const unggahSourceMap = Boolean(process.env.SENTRY_AUTH_TOKEN);

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: {
    // Tanpa token unggah, source map tidak ada gunanya — dan menyajikannya
    // ke publik membocorkan kode server aplikasi keuangan ini.
    disable: !unggahSourceMap,
    // Bila diunggah, hapus dari bundel agar tidak ikut tersaji.
    deleteSourcemapsAfterUpload: true,
  },
  disableLogger: true,
  // SDK Sentry sisi browser SENGAJA tidak dipakai: +62 KB pada tiap muatan
  // halaman membuat rute orang tua melewati ambang NFR PRD §8 (<150 KB gz,
  // LCP <2,5 dtk di 3G). Galat render dilaporkan lewat /api/lapor-galat.
  disableClientWebpackPlugin: true,
});
