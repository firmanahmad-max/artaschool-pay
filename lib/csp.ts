/**
 * CSP berbasis nonce per-request (melunasi utang teknis Sprint 10).
 *
 * `'strict-dynamic'` membuat browser mempercayai skrip yang dimuat oleh skrip
 * ber-nonce, sehingga chunk Next.js tetap jalan tanpa `'unsafe-inline'`.
 * Browser lama yang tidak paham strict-dynamic akan jatuh ke `'self'`.
 *
 * style-src masih memerlukan `'unsafe-inline'`: Next.js menyuntikkan <style>
 * inline untuk CSS-in-JS dan optimasi font. Risikonya jauh lebih rendah
 * daripada script-src dan tidak bisa dihindari tanpa mematikan fitur tsb.
 */
/** Origin ingest Sentry, diturunkan dari DSN. Kosong bila Sentry mati. */
function originSentry(): string {
  // Klien tidak lagi mengirim langsung ke Sentry (lihat /api/lapor-galat),
  // jadi connect-src tidak perlu dibuka. Disisakan bila kelak diaktifkan.
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return "";
  try {
    return new URL(dsn).origin;
  } catch {
    return "";
  }
}

export function buildCsp(nonce: string, isDev: boolean): string {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseWs = supabase ? supabase.replace(/^http/, "ws") : "";
  const sentry = originSentry();

  return [
    "default-src 'self'",
    // 'unsafe-eval' hanya di dev — dibutuhkan React Refresh (HMR)
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${supabase ? ` ${supabase}` : ""}`,
    "font-src 'self' data:",
    `connect-src 'self'${supabase ? ` ${supabase} ${supabaseWs}` : ""}${sentry ? ` ${sentry}` : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}
