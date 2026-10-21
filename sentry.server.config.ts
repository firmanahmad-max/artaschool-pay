import * as Sentry from "@sentry/nextjs";
import { PENGUMPULAN_DATA_MINIMAL, saringEventSentry } from "@/lib/sentry-scrub";

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
    // JANGAN kumpulkan cookie/header/query/body/variabel lokal (UU PDP — PRD §8).
    // Pengganti `sendDefaultPii: false` sejak @sentry/nextjs v11.
    dataCollection: PENGUMPULAN_DATA_MINIMAL,
    beforeSend: (event) => saringEventSentry(event),
    beforeSendTransaction: (event) => saringEventSentry(event),
    beforeBreadcrumb: (breadcrumb) => saringEventSentry(breadcrumb),
  });
}
