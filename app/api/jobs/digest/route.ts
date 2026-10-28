import { NextResponse, type NextRequest } from "next/server";
import { tolakBilaBukanCron } from "@/lib/cron-route";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Susun digest harian kepala sekolah dan masukkan ke antrean notifikasi.
 * Pengiriman sebenarnya tetap dilakukan worker `/api/jobs/notifications`
 * (throttle + retry + dead-letter berlaku otomatis).
 *
 * Dijadwalkan Vercel Cron (GET + `Authorization: Bearer`) atau penjadwal lain
 * (POST + `x-cron-secret`) — lihat `lib/cron-auth.ts`.
 */
async function jalankan(request: NextRequest) {
  const tolak = tolakBilaBukanCron(request);
  if (tolak) return tolak;

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("enqueue_daily_digest");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ queued: data ?? 0 });
}

export const GET = jalankan;
export const POST = jalankan;
