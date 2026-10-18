"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { tautanWa } from "@/modules/notifications/wa-link";
import type { ActionResult } from "./actions";
import { requireGuardian } from "./guards";
import {
  formatKode,
  kodeAktivasiValid,
  normalisasiKode,
  pesanAktivasi,
  urlAktivasi,
  validasiPin,
} from "./kredensial";
import { phoneSchema } from "./schemas";

/**
 * Login wali TANPA gateway WhatsApp: kode aktivasi dari sekolah + PIN 6 angka.
 * Logika kode (hash, percobaan, kedaluwarsa) ada di migration 019; di sini
 * hanya batas laju, penyetelan PIN di Supabase Auth, dan sesi.
 */

const LIMIT_PERCOBAAN = 5;
const JENDELA_DETIK = 900; // 15 menit

async function dalamBatas(bucket: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("check_rate_limit", {
    p_bucket: bucket,
    p_max: LIMIT_PERCOBAAN,
    p_window_seconds: JENDELA_DETIK,
  });
  return data !== false;
}

const TERLALU_SERING = "Terlalu banyak percobaan. Coba lagi 15 menit lagi.";

// ── Wali: aktivasi akun (sekaligus "lupa PIN") ──────────────────────────────
export async function activateGuardianAccount(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsedPhone = phoneSchema.safeParse(formData.get("phone"));
  if (!parsedPhone.success) {
    return { ok: false, error: parsedPhone.error.issues[0]?.message ?? "Nomor HP tidak valid" };
  }
  const phone = parsedPhone.data;
  const kode = normalisasiKode(String(formData.get("kode") ?? ""));
  const pin = String(formData.get("pin") ?? "");
  const pinUlang = String(formData.get("pin_ulang") ?? "");

  if (!kodeAktivasiValid(kode)) {
    return { ok: false, error: "Kode aktivasi terdiri dari 8 huruf/angka (contoh: ABCD-EFGH)." };
  }
  const pinError = validasiPin(pin);
  if (pinError) return { ok: false, error: pinError };
  if (pin !== pinUlang) return { ok: false, error: "Konfirmasi PIN tidak sama." };

  if (!(await dalamBatas(`aktivasi:${phone}`))) {
    return { ok: false, error: TERLALU_SERING };
  }

  const admin = createAdminClient();
  const { data: guardianId } = await admin.rpc("verify_activation_code", {
    p_phone: phone,
    p_code: kode,
  });
  if (!guardianId) {
    return {
      ok: false,
      error:
        "Kode aktivasi salah, sudah dipakai, atau kedaluwarsa. Minta kode baru ke pihak sekolah.",
    };
  }

  const { data: guardian } = await admin
    .from("guardians")
    .select("auth_user_id")
    .eq("id", guardianId)
    .single();

  // Pakai ulang akun auth yang sudah ada (mis. dulu login OTP) agar tak ganda.
  let authUserId = guardian?.auth_user_id ?? null;
  if (!authUserId) {
    const { data } = await admin.rpc("auth_user_id_by_phone", { p_phone: phone });
    authUserId = data ?? null;
  }

  if (authUserId) {
    const { error } = await admin.auth.admin.updateUserById(authUserId, {
      password: pin,
      phone_confirm: true,
    });
    if (error) return { ok: false, error: "Gagal menyimpan PIN. Coba lagi." };
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      phone,
      password: pin,
      phone_confirm: true,
    });
    if (error || !data.user) return { ok: false, error: "Gagal membuat akun. Coba lagi." };
    authUserId = data.user.id;
  }

  const { error: linkError } = await admin.rpc("complete_guardian_activation", {
    p_guardian_id: guardianId,
    p_auth_user_id: authUserId,
  });
  if (linkError) return { ok: false, error: "Gagal menautkan akun. Hubungi pihak sekolah." };

  const supabase = createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    phone,
    password: pin,
  });
  if (signInError) {
    return {
      ok: false,
      error: "Akun sudah aktif, tetapi gagal masuk otomatis. Silakan masuk dengan nomor HP + PIN.",
    };
  }
  redirect("/beranda");
}

// ── Wali: masuk dengan nomor HP + PIN ───────────────────────────────────────
export async function loginParentPin(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsedPhone = phoneSchema.safeParse(formData.get("phone"));
  if (!parsedPhone.success) {
    return { ok: false, error: parsedPhone.error.issues[0]?.message ?? "Nomor HP tidak valid" };
  }
  const phone = parsedPhone.data;
  const pin = String(formData.get("pin") ?? "");
  if (!/^\d{6}$/.test(pin)) return { ok: false, error: "PIN harus 6 angka." };

  if (!(await dalamBatas(`pin:${phone}`))) {
    return { ok: false, error: TERLALU_SERING };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ phone, password: pin });
  if (error) {
    // Sengaja satu pesan untuk "nomor tak dikenal" dan "PIN salah".
    return {
      ok: false,
      error: "Nomor HP atau PIN salah. Belum punya PIN? Pilih Aktivasi akun.",
    };
  }

  const { data: guardianId } = await supabase.rpc("claim_guardian_account");
  if (!guardianId) {
    await supabase.auth.signOut();
    return { ok: false, error: "Akun tidak terhubung dengan data wali. Hubungi pihak sekolah." };
  }
  redirect("/beranda");
}

// ── Wali: buat / ubah PIN dari menu Akun ────────────────────────────────────
export async function changeMyPin(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guardian = await requireGuardian();
  const supabase = createClient();

  const baru = String(formData.get("pin_baru") ?? "");
  const ulang = String(formData.get("pin_ulang") ?? "");
  const pinError = validasiPin(baru);
  if (pinError) return { ok: false, error: pinError };
  if (baru !== ulang) return { ok: false, error: "Konfirmasi PIN tidak sama." };

  if (!(await dalamBatas(`ubahpin:${guardian.phone}`))) {
    return { ok: false, error: TERLALU_SERING };
  }

  const { data: punyaPin } = await supabase.rpc("my_pin_is_set");
  if (punyaPin) {
    // Verifikasi PIN lama dengan klien terpisah agar sesi aktif tak terganggu.
    const pemeriksa = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error } = await pemeriksa.auth.signInWithPassword({
      phone: guardian.phone,
      password: String(formData.get("pin_lama") ?? ""),
    });
    if (error) return { ok: false, error: "PIN lama salah." };
    // `local`: tutup HANYA sesi pemeriksa, bukan sesi wali yang sedang dipakai.
    await pemeriksa.auth.signOut({ scope: "local" });
  }

  const { error } = await supabase.auth.updateUser({ password: baru });
  if (error) return { ok: false, error: "Gagal menyimpan PIN. Coba lagi." };

  await supabase.rpc("log_guardian_event", { p_action: "guardian.pin_changed" });
  return { ok: true, message: punyaPin ? "PIN berhasil diubah." : "PIN berhasil dibuat." };
}

// ── Admin: terbitkan kode aktivasi untuk seorang wali ───────────────────────
export type KodeAktivasiResult =
  | { ok: true; kode: string; pesan: string; tautan: string; nama: string }
  | { ok: false; error: string };

function urlDasarAplikasi(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function issueActivationCodeAction(
  _prev: KodeAktivasiResult | null,
  formData: FormData,
): Promise<KodeAktivasiResult> {
  const guardianId = String(formData.get("guardian_id") ?? "");
  const supabase = createClient();

  const { data: kode, error } = await supabase.rpc("issue_activation_code", {
    p_guardian_id: guardianId,
  });
  if (error || !kode) {
    // Pesan dari RPC kita sendiri (wewenang/2FA/wali tak ditemukan) aman ditampilkan.
    return { ok: false, error: error?.message ?? "Gagal menerbitkan kode aktivasi." };
  }

  const { data: guardian } = await supabase
    .from("guardians")
    .select("full_name, phone")
    .eq("id", guardianId)
    .single();
  if (!guardian) return { ok: false, error: "Wali tidak ditemukan." };

  const pesan = pesanAktivasi({
    nama: guardian.full_name,
    kode,
    urlAktivasi: urlAktivasi(urlDasarAplikasi()),
  });
  return {
    ok: true,
    kode: formatKode(kode),
    pesan,
    tautan: tautanWa(guardian.phone, pesan),
    nama: guardian.full_name,
  };
}
