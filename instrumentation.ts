/**
 * Titik masuk instrumentasi Next.js — memuat konfigurasi Sentry sesuai
 * runtime. Keduanya no-op bila SENTRY_DSN kosong.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export { captureRequestError as onRequestError } from "@sentry/nextjs";
