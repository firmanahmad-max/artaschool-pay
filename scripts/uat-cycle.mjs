/**
 * Gladi resik UAT — membuktikan DEFINISI SELESAI MVP (PRD §9):
 * "1 sekolah menjalankan 1 siklus penuh SPP bulanan (generate tagihan →
 *  orang tua upload → verifikasi → laporan) tanpa menyentuh WhatsApp manual."
 *
 *   npm run uat
 *
 * Dijalankan pada SEKOLAH TERPISAH ("SD Pilot UAT") di database yang sama,
 * sehingga sekaligus menguji isolasi multi-tenant terhadap sekolah demo.
 * Memakai sesi asli (anon key + OTP untuk wali, email+sandi untuk admin) —
 * service_role hanya dipakai untuk penyiapan data & unggah berkas, persis
 * seperti yang dilakukan Server Action.
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE) {
  console.error("Env Supabase belum lengkap.");
  process.exit(1);
}

const admin = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let langkah = 0;
const gagal = [];
function cek(nama, lulus, detail = "") {
  langkah++;
  console.log(`${lulus ? "  LULUS" : "  GAGAL"}  ${nama}${detail ? ` — ${detail}` : ""}`);
  if (!lulus) gagal.push(nama);
}
function rp(n) {
  return "Rp " + Number(n).toLocaleString("id-ID");
}

// TOTP untuk login admin ber-2FA
function b32d(s) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of s.replace(/=+$/, "").toUpperCase()) {
    const i = A.indexOf(c);
    if (i >= 0) bits += i.toString(2).padStart(5, "0");
  }
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}
function totp(secret) {
  const c = Math.floor(Date.now() / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(0, 0);
  buf.writeUInt32BE(c >>> 0, 4);
  const h = createHmac("sha1", b32d(secret)).update(buf).digest();
  const o = h[h.length - 1] & 0xf;
  const bin =
    ((h[o] & 0x7f) << 24) | ((h[o + 1] & 0xff) << 16) | ((h[o + 2] & 0xff) << 8) | (h[o + 3] & 0xff);
  return String(bin % 1000000).padStart(6, "0");
}

function sesiAnon() {
  return createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Buat "foto bukti" JPEG minimal yang unik (header JPEG valid + payload acak). */
function bukti(tag) {
  const head = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
  const body = Buffer.from(`BUKTI-${tag}-${randomUUID()}`);
  const tail = Buffer.from([0xff, 0xd9]);
  return Buffer.concat([head, body, tail]);
}

/** Meniru Server Action submitPayment: unggah service-role lalu RPC sesi wali. */
async function unggahBukti(sesi, { schoolId, studentId, amount, billIds, revisionOf }) {
  const bytes = bukti(studentId.slice(0, 8));
  const sha = createHash("sha256").update(bytes).digest("hex");
  const paymentId = randomUUID();
  const path = `${schoolId}/${studentId}/${paymentId}.jpg`;

  const up = await admin.storage
    .from("payment-proofs")
    .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (up.error) throw new Error("unggah gagal: " + up.error.message);

  const { error } = await sesi.rpc("submit_payment", {
    p_payment_id: paymentId,
    p_student_id: studentId,
    p_amount: amount,
    p_proof_path: path,
    p_bill_ids: billIds,
    p_method: "transfer",
    p_bank_name: "BCA - 9988776655",
    p_sender_name: "Wali UAT",
    p_proof_sha256: sha,
    p_revision_of: revisionOf ?? undefined,
  });
  if (error) {
    await admin.storage.from("payment-proofs").remove([path]);
    throw new Error("submit_payment gagal: " + error.message);
  }
  return paymentId;
}

console.log("\n=== Gladi resik UAT: siklus SPP penuh ===\n");

// ── 0. Bersihkan sisa run sebelumnya ────────────────────────────────────────
const SLUG = "sd-pilot-uat";
const { data: lama } = await admin.from("schools").select("id").eq("slug", SLUG).maybeSingle();
if (lama) {
  // Urutan penting: anak dulu, induk terakhir. notification_jobs merujuk
  // guardians, jadi HARUS dihapus sebelum guardians.
  const { data: st } = await admin.from("students").select("id").eq("school_id", lama.id);
  const ids = (st ?? []).map((s) => s.id);
  const { data: pay } = await admin.from("payments").select("id").eq("school_id", lama.id);
  for (const p of pay ?? []) {
    await admin.from("payment_allocations").delete().eq("payment_id", p.id);
  }
  const langkahHapus = [
    ["notification_jobs", () => admin.from("notification_jobs").delete().eq("school_id", lama.id)],
    ["payments", () => admin.from("payments").delete().eq("school_id", lama.id)],
    ["bills", () => admin.from("bills").delete().eq("school_id", lama.id)],
    [
      "class_enrollments",
      () =>
        ids.length
          ? admin.from("class_enrollments").delete().in("student_id", ids)
          : Promise.resolve({ error: null }),
    ],
    [
      "guardian_students",
      () =>
        ids.length
          ? admin.from("guardian_students").delete().in("student_id", ids)
          : Promise.resolve({ error: null }),
    ],
    ["guardians", () => admin.from("guardians").delete().eq("school_id", lama.id)],
    ["students", () => admin.from("students").delete().eq("school_id", lama.id)],
    ["classes", () => admin.from("classes").delete().eq("school_id", lama.id)],
    ["payment_types", () => admin.from("payment_types").delete().eq("school_id", lama.id)],
    ["academic_years", () => admin.from("academic_years").delete().eq("school_id", lama.id)],
    ["admin_users", () => admin.from("admin_users").delete().eq("school_id", lama.id)],
    ["schools", () => admin.from("schools").delete().eq("id", lama.id)],
  ];
  for (const [nama, fn] of langkahHapus) {
    const { error } = await fn();
    if (error) {
      console.error(`Pembersihan gagal di ${nama}: ${error.message}`);
      process.exit(1);
    }
  }
  console.log("(sisa run sebelumnya dibersihkan)\n");
}

console.log("[1] Penyiapan sekolah pilot");
const { data: sekolah } = await admin
  .from("schools")
  .insert({
    name: "SD Pilot UAT",
    slug: SLUG,
    bank_accounts: [{ bank: "BCA", no_rek: "9988776655", atas_nama: "SD Pilot UAT" }],
  })
  .select("id")
  .single();
const SCHOOL = sekolah.id;

const { data: tahun } = await admin
  .from("academic_years")
  .insert({ school_id: SCHOOL, name: "2026/2027", is_active: true })
  .select("id")
  .single();

const { data: kelas } = await admin
  .from("classes")
  .insert({ school_id: SCHOOL, academic_year_id: tahun.id, grade: 3, label: "3A" })
  .select("id")
  .single();

const siswaInput = [
  { nis: "UAT001", full_name: "Ayu Pratiwi", phone: "+6281299900001", wali: "Ibu Ayu" },
  { nis: "UAT002", full_name: "Budi Santoso", phone: "+6281299900002", wali: "Bapak Budi" },
  { nis: "UAT003", full_name: "Citra Dewi", phone: "+6281299900003", wali: "Ibu Citra" },
];
const siswa = [];
for (const s of siswaInput) {
  const { data: st } = await admin
    .from("students")
    .insert({ school_id: SCHOOL, nis: s.nis, full_name: s.full_name })
    .select("id")
    .single();
  await admin.from("class_enrollments").insert({ student_id: st.id, class_id: kelas.id });
  const { data: g } = await admin
    .from("guardians")
    .insert({ school_id: SCHOOL, full_name: s.wali, phone: s.phone })
    .select("id")
    .single();
  await admin.from("guardian_students").insert({
    guardian_id: g.id,
    student_id: st.id,
    relation: "wali",
  });
  siswa.push({ ...s, id: st.id, guardianId: g.id });
}

const { data: jenis } = await admin
  .from("payment_types")
  .insert({ school_id: SCHOOL, name: "SPP", default_amount: 400000, is_recurring: true })
  .select("id")
  .single();

cek("Sekolah pilot + 3 siswa + 3 wali + jenis SPP siap", siswa.length === 3);

// Admin keuangan sekolah pilot
const EMAIL = "keuangan@pilot-uat.local";
const SANDI = "uat-pilot-12345";
const { data: existing } = await admin.auth.admin.listUsers();
const found = existing.users.find((u) => u.email === EMAIL);
if (found) await admin.auth.admin.deleteUser(found.id);
const { data: created } = await admin.auth.admin.createUser({
  email: EMAIL,
  password: SANDI,
  email_confirm: true,
});
await admin.from("admin_users").insert({
  school_id: SCHOOL,
  auth_user_id: created.user.id,
  full_name: "Admin Keuangan Pilot",
  role: "admin_keuangan",
  is_active: true,
});

// ── 2. Admin masuk & (uji) 2FA ──────────────────────────────────────────────
console.log("\n[2] Admin masuk + 2FA");
const sesiAdmin = sesiAnon();
await sesiAdmin.auth.signInWithPassword({ email: EMAIL, password: SANDI });

// Peran admin_keuangan WAJIB 2FA → daftarkan seperti di aplikasi
const { data: enroll } = await sesiAdmin.auth.mfa.enroll({
  factorType: "totp",
  friendlyName: "UAT",
});
const ch1 = await sesiAdmin.auth.mfa.challenge({ factorId: enroll.id });
const v1 = await sesiAdmin.auth.mfa.verify({
  factorId: enroll.id,
  challengeId: ch1.data.id,
  code: totp(enroll.totp.secret),
});
cek("Admin keuangan mendaftarkan 2FA (TOTP)", !v1.error, v1.error?.message);

const { data: aal } = await sesiAdmin.auth.mfa.getAuthenticatorAssuranceLevel();
cek("Sesi admin naik ke aal2", aal?.currentLevel === "aal2", `aal=${aal?.currentLevel}`);

// ── 3. Generate tagihan SPP massal ──────────────────────────────────────────
console.log("\n[3] Generate tagihan SPP bulanan");
const PERIODE = "2026-09-01";
const { data: dibuat, error: genErr } = await sesiAdmin.rpc("generate_bills", {
  p_payment_type_id: jenis.id,
  p_period: PERIODE,
  p_due_date: "2026-09-10",
});
cek("generate_bills membuat 3 tagihan", dibuat === 3, genErr?.message ?? `dibuat=${dibuat}`);

const { data: ulang } = await sesiAdmin.rpc("generate_bills", {
  p_payment_type_id: jenis.id,
  p_period: PERIODE,
});
cek("Aman diulang (idempotent)", ulang === 0, `dibuat lagi=${ulang}`);

const { data: tagihan } = await admin
  .from("bills")
  .select("id, student_id, amount")
  .eq("school_id", SCHOOL);
const tagihanPer = Object.fromEntries(tagihan.map((b) => [b.student_id, b]));

// ── 4. Orang tua upload bukti ───────────────────────────────────────────────
console.log("\n[4] Orang tua upload bukti transfer");
const sesiWali = {};
for (const s of siswa) {
  const c = sesiAnon();
  await c.auth.signInWithOtp({ phone: s.phone });
  const { error } = await c.auth.verifyOtp({ phone: s.phone, token: "123456", type: "sms" });
  if (error) throw new Error(`OTP wali ${s.nis} gagal: ${error.message}`);
  await c.rpc("claim_guardian_account");
  sesiWali[s.nis] = c;
}
cek("3 wali masuk via OTP WhatsApp", Object.keys(sesiWali).length === 3);

const bayar = {};
// Wali 1: nominal benar
bayar.UAT001 = await unggahBukti(sesiWali.UAT001, {
  schoolId: SCHOOL,
  studentId: siswa[0].id,
  amount: 400000,
  billIds: [tagihanPer[siswa[0].id].id],
});
// Wali 2: nominal kurang → nanti diminta revisi
bayar.UAT002 = await unggahBukti(sesiWali.UAT002, {
  schoolId: SCHOOL,
  studentId: siswa[1].id,
  amount: 300000,
  billIds: [tagihanPer[siswa[1].id].id],
});
cek("2 bukti terkirim (1 benar, 1 nominal kurang)", !!bayar.UAT001 && !!bayar.UAT002);

// Wali 3 tidak upload — akan dibayar tunai di sekolah

// ── 5. Admin verifikasi ─────────────────────────────────────────────────────
console.log("\n[5] Admin verifikasi antrean");
const { error: apprErr } = await sesiAdmin.rpc("approve_payment", {
  p_payment_id: bayar.UAT001,
  p_allocations: [{ bill_id: tagihanPer[siswa[0].id].id, amount: 400000 }],
});
cek("Terima pembayaran pertama", !apprErr, apprErr?.message);

const { error: revErr } = await sesiAdmin.rpc("review_payment", {
  p_payment_id: bayar.UAT002,
  p_action: "needs_revision",
  p_note: "Nominal di bukti Rp 300.000, sedangkan SPP September Rp 400.000. Mohon lengkapi lalu kirim ulang.",
});
cek("Minta revisi pembayaran kedua", !revErr, revErr?.message);

// ── 6. Orang tua kirim ulang ────────────────────────────────────────────────
console.log("\n[6] Orang tua kirim ulang setelah revisi");
bayar.UAT002b = await unggahBukti(sesiWali.UAT002, {
  schoolId: SCHOOL,
  studentId: siswa[1].id,
  amount: 400000,
  billIds: [tagihanPer[siswa[1].id].id],
  revisionOf: bayar.UAT002,
});
const { data: rantai } = await admin
  .from("payments")
  .select("revision_of")
  .eq("id", bayar.UAT002b)
  .single();
cek("Kiriman ulang menunjuk pembayaran lama", rantai.revision_of === bayar.UAT002);

const { error: appr2 } = await sesiAdmin.rpc("approve_payment", {
  p_payment_id: bayar.UAT002b,
  p_allocations: [{ bill_id: tagihanPer[siswa[1].id].id, amount: 400000 }],
});
cek("Terima kiriman ulang", !appr2, appr2?.message);

// ── 7. Pembayaran tunai di sekolah ──────────────────────────────────────────
console.log("\n[7] Pembayaran tunai di sekolah");
const { error: cashErr } = await sesiAdmin.rpc("record_cash_payment", {
  p_student_id: siswa[2].id,
  p_amount: 400000,
  p_allocations: [{ bill_id: tagihanPer[siswa[2].id].id, amount: 400000 }],
  p_method: "cash",
  p_note: "Dibayar tunai di TU",
});
cek("Catat pembayaran tunai", !cashErr, cashErr?.message);

// ── 8. Hasil akhir siklus ───────────────────────────────────────────────────
console.log("\n[8] Hasil akhir siklus");
const { data: akhir } = await admin
  .from("bills")
  .select("status, amount, amount_paid")
  .eq("school_id", SCHOOL);
const lunas = akhir.filter((b) => b.status === "paid").length;
cek("Semua 3 tagihan LUNAS", lunas === 3, `${lunas}/3 lunas`);

const totalMasuk = akhir.reduce((s, b) => s + Number(b.amount_paid), 0);
cek("Total uang masuk Rp 1.200.000", totalMasuk === 1200000, rp(totalMasuk));

const { data: notif } = await admin
  .from("notification_jobs")
  .select("template")
  .eq("school_id", SCHOOL);
const tpl = (notif ?? []).map((n) => n.template);
cek(
  "Notifikasi WA terantre otomatis (tanpa WhatsApp manual)",
  tpl.filter((t) => t.startsWith("payment.")).length >= 3,
  tpl.join(", "),
);

const { data: audit } = await admin
  .from("audit_logs")
  .select("action")
  .eq("school_id", SCHOOL);
const aksi = new Set((audit ?? []).map((a) => a.action));
cek(
  "Jejak audit lengkap",
  ["payment.submitted", "payment.resubmitted", "payment.approved", "payment.needs_revision", "payment.cash_recorded"].every(
    (a) => aksi.has(a),
  ),
  [...aksi].join(", "),
);

// ── 9. Isolasi multi-tenant ─────────────────────────────────────────────────
console.log("\n[9] Isolasi antar-sekolah");
const { data: lihatLain } = await sesiAdmin.from("students").select("id, school_id");
const bocor = (lihatLain ?? []).filter((s) => s.school_id !== SCHOOL).length;
cek("Admin pilot tidak melihat siswa sekolah lain", bocor === 0, `terlihat ${lihatLain?.length ?? 0} siswa`);

const { data: tagihanLain } = await sesiAdmin.from("bills").select("school_id");
cek(
  "Admin pilot tidak melihat tagihan sekolah lain",
  (tagihanLain ?? []).every((b) => b.school_id === SCHOOL),
);

console.log(`\n=== Hasil: ${langkah - gagal.length}/${langkah} lulus ===`);
if (gagal.length > 0) {
  console.error("\nGAGAL:");
  for (const g of gagal) console.error(" - " + g);
  process.exit(1);
}
console.log("Siklus SPP penuh berjalan tanpa menyentuh WhatsApp manual.");
console.log(`Login admin pilot → ${EMAIL} / ${SANDI}\n`);
