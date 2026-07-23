import * as Sentry from "@sentry/nextjs";
import { saringEventSentry } from "@/lib/sentry-scrub";

/**
 * Monitoring sisi server (PRD §3.2). Tanpa `SENTRY_DSN` seluruh blok ini
 * dilewati — aplikasi berjalan normal tanpa mengirim apa pun.
 */
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    // Cuplikan performa kecil saja; yang dicari adalah error, bukan profil
    tracesSampleRate: 0.1,
    // JANGAN kirim IP/cookie/header pengguna (UU PDP — PRD §8)
    sendDefaultPii: false,
    beforeSend: (event) => saringEventSentry(event),
    beforeBreadcrumb: (breadcrumb) => saringEventSentry(breadcrumb),
  });
}
