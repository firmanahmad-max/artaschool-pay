"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { adminLoginSchema, otpSchema, phoneSchema } from "./schemas";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Kirim OTP WhatsApp/SMS ke nomor wali TERDAFTAR.
 * Nomor yang tidak ada di `guardians` ditolak sebelum OTP dikirim
 * (PRD §6.1 — mencegah orang asing mengklaim anak orang lain).
 */
export async function requestParentOtp(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = phoneSchema.safeParse(formData.get("phone"));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }
  const phone = parsed.data;

  const admin = createAdminClient();

  // Rate limit OTP: 3 permintaan / 10 menit per nomor (PRD §6.4)
  const { data: allowed } = await admin.rpc("check_rate_limit", {
    p_bucket: `otp:${phone}`,
    p_max: 3,
    p_window_seconds: 600,
  });
  if (allowed === false) {
    return {
      ok: false,
      error: "Terlalu banyak permintaan kode. Coba lagi dalam 10 menit.",
    };
  }

  const { data: guardian, error: lookupError } = await admin
    .from("guardians")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();
  if (lookupError) {
    return { ok: false, error: "Terjadi kesalahan. Coba lagi." };
  }
  if (!guardian) {
    return {
      ok: false,
      error:
        "Nomor belum terdaftar. Hubungi pihak sekolah untuk mendaftarkan nomor HP Anda.",
    };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) {
    return { ok: false, error: "Gagal mengirim kode OTP. Coba beberapa saat lagi." };
  }
  return { ok: true };
}

/** Verifikasi OTP → tautkan akun ke baris guardians → masuk beranda. */
export async function verifyParentOtp(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = otpSchema.safeParse({
    phone: formData.get("phone"),
    token: formData.get("token"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.verifyOtp({
    phone: parsed.data.phone,
    token: parsed.data.token,
    type: "sms",
  });
  if (error) {
    return { ok: false, error: "Kode OTP salah atau kedaluwarsa." };
  }

  const { data: guardianId, error: claimError } = await supabase.rpc(
    "claim_guardian_account",
  );
  if (claimError || !guardianId) {
    // Safety net: OTP sah tapi tidak ada baris guardians yang cocok
    await supabase.auth.signOut();
    return {
      ok: false,
      error: "Akun tidak terhubung dengan data wali. Hubungi pihak sekolah.",
    };
  }

  redirect("/beranda");
}

/** Login admin: email + kata sandi, lalu pastikan punya baris admin_users aktif. */
export async function loginAdmin(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = adminLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { ok: false, error: "Email atau kata sandi salah." };
  }

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id, is_active")
    .maybeSingle();
  if (!adminRow || !adminRow.is_active) {
    await supabase.auth.signOut();
    return { ok: false, error: "Akun ini tidak memiliki akses admin." };
  }

  redirect("/admin");
}

/** Keluar dari sesi; kembali ke halaman login yang sesuai. */
export async function logout(target: "parent" | "admin") {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect(target === "admin" ? "/admin/login" : "/login");
}
