import * as Sentry from "@sentry/nextjs";
import { saringEventSentry } from "@/lib/sentry-scrub";

/**
 * Monitoring sisi browser (PRD §3.2). Memakai NEXT_PUBLIC_SENTRY_DSN karena
 * nilai ini ikut terkirim ke browser; kosongkan untuk mematikan sepenuhnya.
 *
 * Session Replay SENGAJA TIDAK dipakai: layar orang tua memuat nama anak,
 * nominal, dan bukti transfer — merekamnya bertentangan dengan UU PDP
 * (PRD §8).
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend: (event) => saringEventSentry(event),
    beforeBreadcrumb: (breadcrumb) => saringEventSentry(breadcrumb),
  });
}
