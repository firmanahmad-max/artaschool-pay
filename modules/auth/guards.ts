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

/** Peran yang WAJIB 2FA (PRD §6.1) — memegang uang & data finansial. */
const MFA_REQUIRED_ROLES = ["super_admin", "admin_keuangan"];

/**
 * Guard dasar: sesi + baris admin_users aktif, TANPA penegakan 2FA.
 * Dipakai halaman gerbang keamanan (/admin/2fa, /admin/keamanan) agar tidak
 * terjadi loop redirect.
 */
export async function requireAdminBasic(): Promise<AdminProfile> {
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

  return {
    id: adminRow.id,
    full_name: adminRow.full_name,
    role: adminRow.role,
    school_id: adminRow.school_id,
  };
}

/**
 * Guard layout (admin): sesi + admin aktif + cek role + PENEGAKAN 2FA.
 *
 * Dua kondisi 2FA yang ditangani:
 * 1. Sudah punya faktor tapi sesi masih aal1  → wajib verifikasi (/admin/2fa)
 * 2. Peran wajib 2FA tapi belum mendaftar     → wajib daftar (/admin/keamanan)
 */
export async function requireAdmin(
  allowedRoles?: string[],
): Promise<AdminProfile> {
  const admin = await requireAdminBasic();
  const supabase = createClient();

  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  // Punya faktor terverifikasi tetapi sesi belum dinaikkan → verifikasi dulu
  if (aal?.nextLevel === "aal2" && aal.currentLevel === "aal1") {
    redirect("/admin/2fa");
  }

  if (MFA_REQUIRED_ROLES.includes(admin.role) && aal?.nextLevel !== "aal2") {
    redirect("/admin/keamanan?wajib=1");
  }

  if (allowedRoles && !allowedRoles.includes(admin.role)) redirect("/admin");

  return admin;
}
