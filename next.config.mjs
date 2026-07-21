const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const isDev = process.env.NODE_ENV === "development";

/**
 * CSP ketat (PRD §6.4). Catatan:
 * - Next.js App Router menyuntikkan skrip hidrasi inline, sehingga
 *   'unsafe-inline' pada script-src masih diperlukan tanpa nonce middleware.
 *   Ini dicatat sebagai utang teknis v2 (pindah ke nonce per-request).
 * - connect-src dibuka ke Supabase (REST, Auth, Storage, Realtime).
 * - img-src menyertakan blob: untuk pratinjau bukti hasil kompresi klien.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:" + (supabaseUrl ? ` ${supabaseUrl}` : ""),
  "font-src 'self' data:",
  `connect-src 'self'${supabaseUrl ? ` ${supabaseUrl} ${supabaseUrl.replace(/^http/, "ws")}` : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
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
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
