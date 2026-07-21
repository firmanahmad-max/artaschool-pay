import "server-only";
import { createClient } from "@/lib/supabase/server";

type Audience = { scope?: string; class_ids?: string[] };

function readAudience(raw: unknown): Audience {
  return raw && typeof raw === "object" ? (raw as Audience) : { scope: "all" };
}

/** Daftar pengumuman untuk admin (semua, termasuk terjadwal & kedaluwarsa). */
export async function getAnnouncementsForAdmin() {
  const supabase = createClient();
  const { data } = await supabase
    .from("announcements")
    .select("id, title, body, audience, publish_at, expires_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (data ?? []).map((a) => {
    const audience = readAudience(a.audience);
    return {
      id: a.id,
      title: a.title,
      body: a.body,
      scope: audience.scope ?? "all",
      classCount: audience.class_ids?.length ?? 0,
      publish_at: a.publish_at,
      expires_at: a.expires_at,
    };
  });
}

/** Ringkasan antrean notifikasi untuk monitor admin. */
export async function getNotificationSummary() {
  const supabase = createClient();
  const { data } = await supabase
    .from("notification_jobs")
    .select("id, status, template, recipient_phone, body, attempts, last_error, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = data ?? [];
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  return { rows, counts };
}

/**
 * Pengumuman yang berhak dilihat wali: sudah terbit, belum kedaluwarsa, dan
 * audiensnya "all" atau memuat kelas anaknya. RLS sudah membatasi ke sekolah
 * & jendela publikasi; penyaringan audiens dilakukan di sini.
 */
export async function getAnnouncementsForGuardian(guardianId: string) {
  const supabase = createClient();

  const { data: links } = await supabase
    .from("guardian_students")
    .select("students(class_enrollments(class_id))")
    .eq("guardian_id", guardianId);

  const myClassIds = new Set(
    (links ?? []).flatMap(
      (l) => l.students?.class_enrollments.map((e) => e.class_id) ?? [],
    ),
  );

  const { data } = await supabase
    .from("announcements")
    .select("id, title, body, audience, publish_at")
    .order("publish_at", { ascending: false, nullsFirst: false })
    .limit(50);

  return (data ?? [])
    .filter((a) => {
      const audience = readAudience(a.audience);
      if ((audience.scope ?? "all") === "all") return true;
      return (audience.class_ids ?? []).some((id) => myClassIds.has(id));
    })
    .map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      publish_at: a.publish_at,
    }));
}
