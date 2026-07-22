"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminBasic } from "@/modules/auth/guards";

export type MfaResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

export type EnrollData = { factorId: string; qrSvg: string; secret: string };

// Catatan: berkas "use server" HANYA boleh mengekspor fungsi async.
// Daftar peran wajib 2FA hidup di `guards.ts` (tempat ia ditegakkan).

/**
 * Mulai pendaftaran TOTP. Mengembalikan QR untuk dipindai aplikasi
 * authenticator; faktor baru berstatus `unverified` sampai dikonfirmasi
 * dengan kode 6 digit.
 */
export async function startMfaEnrollment(): Promise<
  { ok: true; data: EnrollData } | { ok: false; error: string }
> {
  await requireAdminBasic();
  const supabase = createClient();

  // Bersihkan faktor menggantung dari percobaan sebelumnya
  const { data: existing } = await supabase.auth.mfa.listFactors();
  for (const f of existing?.all ?? []) {
    if (f.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `ArtaSchool ${new Date().toISOString().slice(0, 10)}`,
  });
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Gagal memulai pendaftaran 2FA." };
  }

  return {
    ok: true,
    data: {
      factorId: data.id,
      qrSvg: data.totp.qr_code,
      secret: data.totp.secret,
    },
  };
}

/** Konfirmasi pendaftaran dengan kode 6 digit dari aplikasi authenticator. */
export async function confirmMfaEnrollment(
  _prev: MfaResult | null,
  formData: FormData,
): Promise<MfaResult> {
  await requireAdminBasic();
  const factorId = String(formData.get("factor_id") ?? "");
  const code = String(formData.get("code") ?? "").trim();

  if (!/^\d{6}$/.test(code)) {
    return { ok: false, error: "Kode terdiri dari 6 angka." };
  }

  const supabase = createClient();
  const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
    factorId,
  });
  if (chErr || !challenge) {
    return { ok: false, error: "Gagal membuat tantangan 2FA." };
  }

  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  if (error) {
    return { ok: false, error: "Kode salah atau kedaluwarsa. Coba lagi." };
  }

  await supabase.rpc("log_audit", {
    p_action: "admin.mfa_enrolled",
    p_entity: "admin_user",
  });
  revalidatePath("/admin/keamanan");
  return { ok: true, message: "2FA aktif. Mulai sekarang login butuh kode dari aplikasi." };
}

/** Verifikasi kode saat login (sesi sudah aal1, dinaikkan ke aal2). */
export async function verifyMfaLogin(
  _prev: MfaResult | null,
  formData: FormData,
): Promise<MfaResult> {
  const code = String(formData.get("code") ?? "").trim();
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, error: "Kode terdiri dari 6 angka." };
  }

  const supabase = createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = factors?.totp?.[0];
  if (!totp) {
    return { ok: false, error: "Tidak ada faktor 2FA terdaftar." };
  }

  const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
    factorId: totp.id,
  });
  if (chErr || !challenge) {
    return { ok: false, error: "Gagal membuat tantangan 2FA." };
  }

  const { error } = await supabase.auth.mfa.verify({
    factorId: totp.id,
    challengeId: challenge.id,
    code,
  });
  if (error) {
    return { ok: false, error: "Kode salah atau kedaluwarsa." };
  }

  revalidatePath("/admin", "layout");
  return { ok: true };
}

/** Cabut 2FA (mis. ganti perangkat). Tercatat di audit log. */
export async function unenrollMfa(formData: FormData): Promise<void> {
  await requireAdminBasic();
  const factorId = String(formData.get("factor_id") ?? "");
  const supabase = createClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (!error) {
    await supabase.rpc("log_audit", {
      p_action: "admin.mfa_unenrolled",
      p_entity: "admin_user",
    });
  }
  revalidatePath("/admin/keamanan");
}
