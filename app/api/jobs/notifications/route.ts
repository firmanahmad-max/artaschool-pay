import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsApp } from "@/modules/notifications/gateway";

export const dynamic = "force-dynamic";

const BATCH = 20;
/** Jeda antar-kiriman agar nomor gateway tidak diblokir (PRD §7.2 throttle). */
const THROTTLE_MS = 250;

/**
 * Worker antrean notifikasi. Dipanggil terjadwal (Vercel Cron / Edge Function).
 * Dilindungi header `x-cron-secret`. Retry + dead-letter ditangani RPC
 * `complete_notification_job`.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET belum dikonfigurasi" },
      { status: 500 },
    );
  }
  if (request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: jobs, error } = await supabase.rpc("claim_notification_jobs", {
    p_limit: BATCH,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const job of jobs ?? []) {
    const result = await sendWhatsApp(job.recipient_phone, job.body);
    await supabase.rpc("complete_notification_job", {
      p_id: job.id,
      p_ok: result.ok,
      p_error: result.ok ? undefined : result.error,
    });
    if (result.ok) sent++;
    else failed++;
    if (THROTTLE_MS > 0) {
      await new Promise((r) => setTimeout(r, THROTTLE_MS));
    }
  }

  return NextResponse.json({ claimed: jobs?.length ?? 0, sent, failed });
}
