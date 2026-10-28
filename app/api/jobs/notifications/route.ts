import { NextResponse, type NextRequest } from "next/server";
import { tolakBilaBukanCron } from "@/lib/cron-route";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsApp } from "@/modules/notifications/gateway";
import { waMode } from "@/modules/notifications/mode";
import { kirimPush, pushAktif } from "@/modules/notifications/push";
import { isiPush } from "@/modules/notifications/push-content";

export const dynamic = "force-dynamic";

const BATCH = 20;
/** Jeda antar-kiriman WA agar nomor gateway tidak diblokir (PRD §7.2 throttle). */
const THROTTLE_MS = 250;

type Hasil = { ok: true } | { ok: false; error: string };
type Supabase = ReturnType<typeof createAdminClient>;

/** Kirim satu job kanal push ke semua perangkat wali; bersihkan yang kedaluwarsa. */
async function kirimJobPush(
  supabase: Supabase,
  job: { recipient_guardian_id: string | null; template: string; body: string; payload: unknown },
): Promise<Hasil> {
  if (!pushAktif()) return { ok: false, error: "VAPID belum dikonfigurasi" };
  if (!job.recipient_guardian_id) return { ok: true };

  const { data: langganan } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("guardian_id", job.recipient_guardian_id);
  // Perangkat sudah dicabut sejak diantrekan → tak ada yang perlu dikirim.
  if (!langganan || langganan.length === 0) return { ok: true };

  const hasil = await kirimPush(
    langganan,
    isiPush(job.template, job.body, job.payload as Record<string, unknown> | null),
  );

  const kedaluwarsa = hasil.filter((h) => !h.ok && h.kedaluwarsa).map((h) => h.endpoint);
  if (kedaluwarsa.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", kedaluwarsa);
  }
  const sukses = hasil.filter((h) => h.ok).map((h) => h.endpoint);
  if (sukses.length) {
    await supabase
      .from("push_subscriptions")
      .update({ last_success_at: new Date().toISOString() })
      .in("endpoint", sukses);
    return { ok: true };
  }
  // Semua gagal karena kedaluwarsa → sudah dibersihkan, tak perlu diulang.
  const gagalLain = hasil.find((h) => !h.ok && !h.kedaluwarsa);
  return gagalLain && !gagalLain.ok ? { ok: false, error: gagalLain.error } : { ok: true };
}

/**
 * Worker antrean notifikasi. Dipanggil terjadwal: Vercel Cron (GET +
 * `Authorization: Bearer`) atau penjadwal lain (POST + `x-cron-secret`) —
 * lihat `lib/cron-auth.ts`. Retry + dead-letter ditangani RPC
 * `complete_notification_job`; klaim memakai SKIP LOCKED sehingga panggilan
 * ganda/bersamaan aman.
 */
async function jalankan(request: NextRequest) {
  const tolak = tolakBilaBukanCron(request);
  if (tolak) return tolak;

  const supabase = createAdminClient();
  // Mode manual: kanal WA dibiarkan menunggu di Kotak Keluar (dikirim admin);
  // push tetap otomatis.
  const channels = waMode() === "manual" ? ["push"] : ["wa", "push"];
  const { data: jobs, error } = await supabase.rpc("claim_notification_jobs", {
    p_limit: BATCH,
    p_channels: channels,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const job of jobs ?? []) {
    let result: Hasil;
    if (job.channel === "wa") {
      result = await sendWhatsApp(job.recipient_phone, job.body);
    } else if (job.channel === "push") {
      result = await kirimJobPush(supabase, job);
    } else {
      result = { ok: false, error: `Kanal ${job.channel} belum didukung` };
    }

    await supabase.rpc("complete_notification_job", {
      p_id: job.id,
      p_ok: result.ok,
      p_error: result.ok ? undefined : result.error,
    });
    if (result.ok) sent++;
    else failed++;
    if (job.channel === "wa" && THROTTLE_MS > 0) {
      await new Promise((r) => setTimeout(r, THROTTLE_MS));
    }
  }

  return NextResponse.json({ claimed: jobs?.length ?? 0, sent, failed });
}

export const GET = jalankan;
export const POST = jalankan;
