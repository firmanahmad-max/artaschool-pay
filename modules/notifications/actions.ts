"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type OutboxResult = { ok: true } | { ok: false; error: string };

/** Admin sudah menekan Kirim di WhatsApp → tandai terkirim. Wewenang dicek RPC. */
export async function markSentManually(id: number): Promise<OutboxResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_notification_sent_manually", { p_id: id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/kotak-keluar");
  return { ok: true };
}

/** Pesan sengaja tidak dikirim (mis. sudah dikabari langsung). */
export async function skipNotification(id: number): Promise<OutboxResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("skip_notification", { p_id: id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/kotak-keluar");
  return { ok: true };
}
