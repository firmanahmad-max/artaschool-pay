import * as Sentry from "@sentry/nextjs";
import { PENGUMPULAN_DATA_MINIMAL, saringEventSentry } from "@/lib/sentry-scrub";

/** Monitoring runtime edge (middleware). Nonaktif tanpa SENTRY_DSN. */
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    dataCollection: PENGUMPULAN_DATA_MINIMAL,
    beforeSend: (event) => saringEventSentry(event),
    beforeSendTransaction: (event) => saringEventSentry(event),
    beforeBreadcrumb: (breadcrumb) => saringEventSentry(breadcrumb),
  });
}
