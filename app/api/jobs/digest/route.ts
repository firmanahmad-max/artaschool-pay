import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Susun digest harian kepala sekolah dan masukkan ke antrean notifikasi.
 * Pengiriman sebenarnya tetap dilakukan worker `/api/jobs/notifications`
 * (throttle + retry + dead-letter berlaku otomatis).
 *
 * Dijadwalkan Vercel Cron; dilindungi header `x-cron-secret`.
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
  const { data, error } = await supabase.rpc("enqueue_daily_digest");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ queued: data ?? 0 });
}
