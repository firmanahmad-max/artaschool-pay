import * as Sentry from "@sentry/nextjs";
import { saringEventSentry } from "@/lib/sentry-scrub";

/** Monitoring runtime edge (middleware). Nonaktif tanpa SENTRY_DSN. */
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend: (event) => saringEventSentry(event),
    beforeBreadcrumb: (breadcrumb) => saringEventSentry(breadcrumb),
  });
}
