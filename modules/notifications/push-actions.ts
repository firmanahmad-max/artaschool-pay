"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type PushResult = { ok: true } | { ok: false; error: string };

/** Simpan langganan push perangkat ini untuk wali yang sedang masuk. */
export async function savePushSubscription(sub: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}): Promise<PushResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: sub.endpoint,
    p_p256dh: sub.keys.p256dh,
    p_auth: sub.keys.auth,
    p_user_agent: headers().get("user-agent") ?? undefined,
  });
  return error ? { ok: false, error: "Gagal mengaktifkan notifikasi." } : { ok: true };
}

/** Cabut langganan perangkat ini (matikan notifikasi / sebelum keluar). */
export async function deletePushSubscription(endpoint: string): Promise<PushResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("delete_push_subscription", { p_endpoint: endpoint });
  return error ? { ok: false, error: "Gagal mematikan notifikasi." } : { ok: true };
}
