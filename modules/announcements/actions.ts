"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/modules/auth/guards";
import { announcementSchema } from "./schemas";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const ANNOUNCE_ROLES = ["super_admin", "operator"];

export async function createAnnouncement(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin(ANNOUNCE_ROLES);

  const parsed = announcementSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body") ?? "",
    scope: formData.get("scope") ?? "all",
    class_ids: formData.getAll("class_ids").map(String).filter(Boolean),
    publish_at: formData.get("publish_at") ?? "",
    expires_at: formData.get("expires_at") ?? "",
    broadcast: formData.get("broadcast") === "on",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Input tidak valid",
    };
  }
  const v = parsed.data;

  const supabase = createClient();
  const { data: created, error } = await supabase
    .from("announcements")
    .insert({
      school_id: admin.school_id,
      title: v.title,
      body: v.body || null,
      audience:
        v.scope === "class"
          ? { scope: "class", class_ids: v.class_ids }
          : { scope: "all" },
      publish_at: v.publish_at ? new Date(v.publish_at).toISOString() : new Date().toISOString(),
      expires_at: v.expires_at ? new Date(v.expires_at).toISOString() : null,
      created_by: admin.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: "Gagal menyimpan pengumuman." };

  await supabase.rpc("log_audit", {
    p_action: "announcement.created",
    p_entity: "announcement",
    p_entity_id: created.id,
    p_after: { title: v.title, scope: v.scope },
  });

  let message = "Pengumuman tersimpan.";
  if (v.broadcast) {
    const { data: count, error: bcError } = await supabase.rpc(
      "broadcast_announcement",
      { p_announcement_id: created.id },
    );
    message = bcError
      ? "Pengumuman tersimpan, tetapi broadcast gagal dijadwalkan."
      : `Pengumuman tersimpan. ${count ?? 0} pesan WhatsApp masuk antrean.`;
  }

  revalidatePath("/admin/pengumuman");
  revalidatePath("/pengumuman");
  return { ok: true, message };
}

/** Broadcast ulang pengumuman yang sudah ada. */
export async function broadcastAnnouncement(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin(ANNOUNCE_ROLES);
  const id = String(formData.get("id") ?? "");

  const supabase = createClient();
  const { data: count, error } = await supabase.rpc("broadcast_announcement", {
    p_announcement_id: id,
  });
  if (error) {
    return { ok: false, error: error.message ?? "Broadcast gagal." };
  }

  revalidatePath("/admin/pengumuman");
  return { ok: true, message: `${count ?? 0} pesan WhatsApp masuk antrean.` };
}

export async function deleteAnnouncement(formData: FormData): Promise<void> {
  await requireAdmin(ANNOUNCE_ROLES);
  const id = String(formData.get("id") ?? "");
  const supabase = createClient();
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (!error) {
    await supabase.rpc("log_audit", {
      p_action: "announcement.deleted",
      p_entity: "announcement",
      p_entity_id: id,
    });
  }
  revalidatePath("/admin/pengumuman");
  revalidatePath("/pengumuman");
}
