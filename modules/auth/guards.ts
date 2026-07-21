import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type GuardianProfile = {
  id: string;
  full_name: string;
  phone: string;
  school_id: string;
};

export type AdminProfile = {
  id: string;
  full_name: string;
  role: string;
  school_id: string;
};

/** Guard layout (parent): wajib sesi + baris guardians tertaut. */
export async function requireGuardian(): Promise<GuardianProfile> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: guardian } = await supabase
    .from("guardians")
    .select("id, full_name, phone, school_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!guardian) {
    // Sesi valid tapi bukan wali (mis. admin nyasar ke area orang tua)
    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    redirect(adminRow ? "/admin" : "/login");
  }

  return guardian;
}

/** Guard layout (admin): wajib sesi + baris admin_users aktif (opsional cek role). */
export async function requireAdmin(
  allowedRoles?: string[],
): Promise<AdminProfile> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id, full_name, role, school_id, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!adminRow || !adminRow.is_active) redirect("/admin/login");
  if (allowedRoles && !allowedRoles.includes(adminRow.role)) redirect("/admin");

  return {
    id: adminRow.id,
    full_name: adminRow.full_name,
    role: adminRow.role,
    school_id: adminRow.school_id,
  };
}
