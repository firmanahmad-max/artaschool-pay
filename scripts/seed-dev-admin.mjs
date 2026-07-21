/**
 * Buat akun admin pengembangan lokal (idempotent).
 * Jalankan setelah `supabase start` + `supabase db reset`:
 *   node scripts/seed-dev-admin.mjs
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (dari `supabase status`).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

// Muat .env.local sederhana bila env belum diset
if (!process.env.SUPABASE_SERVICE_ROLE_KEY && existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset.");
  process.exit(1);
}

const SCHOOL_ID = "00000000-0000-0000-0000-000000000001";
const EMAIL = "admin@artaschool.local";
const PASSWORD = "admin-dev-12345";

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let userId;
const { data: created, error: createError } =
  await supabase.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });

if (createError) {
  const { data: list, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;
  const existing = list.users.find((u) => u.email === EMAIL);
  if (!existing) throw createError;
  userId = existing.id;
  console.log(`Akun auth sudah ada: ${EMAIL}`);
} else {
  userId = created.user.id;
  console.log(`Akun auth dibuat: ${EMAIL}`);
}

const { error: upsertError } = await supabase.from("admin_users").upsert(
  {
    school_id: SCHOOL_ID,
    auth_user_id: userId,
    full_name: "Admin Dev",
    role: "super_admin",
    is_active: true,
  },
  { onConflict: "auth_user_id" },
);
if (upsertError) throw upsertError;

console.log(`Baris admin_users siap (super_admin).`);
console.log(`Login admin lokal → email: ${EMAIL}  sandi: ${PASSWORD}`);
