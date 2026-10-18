"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { otpWaTersedia } from "@/modules/notifications/mode";
import {
  adminLoginSchema,
  guardianProfileSchema,
  otpSchema,
  phoneSchema,
} from "./schemas";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

/**
 * Kirim OTP WhatsApp/SMS ke nomor wali TERDAFTAR.
 * Nomor yang tidak ada di `guardians` ditolak sebelum OTP dikirim
 * (PRD §6.1 — mencegah orang asing mengklaim anak orang lain).
 */
export async function requestParentOtp(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  // Mode manual: tak ada gateway yang mengirim OTP — jangan membuat Supabase
  // menghasilkan kode yang tak akan pernah sampai.
  if (!otpWaTersedia()) {
    return {
      ok: false,
      error:
        "Masuk dengan kode WhatsApp belum tersedia. Gunakan nomor HP + PIN, atau aktivasi akun dengan kode dari sekolah.",
    };
  }

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
  const { data: signIn, error } = await supabase.auth.signInWithPassword(
    parsed.data,
  );
  if (error || !signIn.user) {
    return { ok: false, error: "Email atau kata sandi salah." };
  }

  // WAJIB filter auth_user_id: RLS memperbolehkan admin melihat rekan
  // se-sekolah, jadi tanpa filter ini `maybeSingle()` gagal begitu sekolah
  // punya lebih dari satu admin.
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id, is_active")
    .eq("auth_user_id", signIn.user.id)
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

/**
 * Wali membetulkan data pribadinya sendiri (UU PDP — hak koreksi).
 * Hanya nama & email. Nomor HP (kunci login) diubah lewat sekolah.
 */
export async function updateMyGuardianProfile(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = guardianProfileSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Input tidak valid",
    };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("update_my_guardian_profile", {
    p_full_name: parsed.data.full_name,
    p_email: parsed.data.email ?? "",
  });
  if (error) {
    return { ok: false, error: "Gagal menyimpan perubahan. Coba lagi." };
  }

  revalidatePath("/akun");
  return { ok: true, message: "Perubahan tersimpan." };
}

/**
 * Hapus akun wali sendiri (UU PDP §8 — hak penghapusan data).
 *
 * Data pribadi (nama, HP, email, identitas login) dihapus; catatan keuangan
 * (pembayaran) DIPERTAHANKAN ter-anonimkan demi retensi pembukuan 7 tahun
 * (PRD §8). Seluruh mutasi + penghapusan identitas login terjadi di dalam RPC
 * `delete_my_guardian_account` (satu transaksi, otorisasi via auth.uid()).
 */
export async function deleteMyGuardianAccount(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  // Konfirmasi eksplisit — cegah submit tak sengaja.
  if (formData.get("konfirmasi") !== "HAPUS") {
    return { ok: false, error: "Ketik HAPUS untuk mengonfirmasi." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("delete_my_guardian_account");
  if (error) {
    return {
      ok: false,
      error: "Gagal menghapus akun. Coba lagi atau hubungi pihak sekolah.",
    };
  }

  // Identitas auth sudah dihapus di dalam RPC; bersihkan cookie sesi lokal.
  await supabase.auth.signOut();
  redirect("/login?dihapus=1");
}
