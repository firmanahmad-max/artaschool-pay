-- ============================================================================
-- ArtaSchool Pay — 019_guardian_activation.sql
-- Login wali TANPA gateway WA: kode aktivasi (dari sekolah) + PIN 6 angka.
--
-- Alur:
--   1. Admin menerbitkan kode aktivasi untuk seorang wali → dikirim manual
--      (tautan wa.me / dicetak). Plaintext hanya dikembalikan SEKALI.
--   2. Wali memasukkan nomor HP + kode + PIN baru. Server (service_role)
--      memverifikasi kode, menyetel PIN sebagai kata sandi Supabase Auth,
--      lalu menautkan akun.
--   3. Login berikutnya cukup nomor HP + PIN — tanpa OTP, tanpa gateway.
--
-- Keamanan:
--   • Kode di-hash bcrypt (pgcrypto), sekali pakai, berlaku 7 hari.
--   • 5 kali salah → kode dicabut (attempt dihitung TANPA raise, agar
--     penambahan hitungan tidak ikut ter-rollback).
--   • Penerbitan: admin (bukan viewer/kepala sekolah) + gerbang 2FA
--     admin_mfa_ok(); kode lama otomatis dicabut. Audit tanpa plaintext.
--   • Verifikasi & penautan: HANYA service_role (dipanggil server action
--     yang sudah membatasi laju per nomor).
-- ============================================================================

set check_function_bodies = off;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table guardian_activation_codes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  guardian_id uuid not null references guardians(id),
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index idx_activation_codes_active
  on guardian_activation_codes (guardian_id)
  where used_at is null and revoked_at is null;

-- Tanpa policy: hanya bisa disentuh lewat RPC di bawah / service_role.
alter table guardian_activation_codes enable row level security;
revoke all on guardian_activation_codes from anon, authenticated;

-- ── 1. Admin menerbitkan kode ───────────────────────────────────────────────
create or replace function public.issue_activation_code(p_guardian_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school   uuid := current_admin_school_id();
  v_role     text := current_admin_role();
  -- Tanpa I, L, O, 0, 1 agar tak tertukar saat dibaca/diketik.
  v_alfabet  constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_n        constant int := 31;
  v_bytes    bytea;
  v_b        int;
  v_code     text := '';
  v_deleted  timestamptz;
  i          int;
begin
  if v_role is null or v_role not in ('super_admin', 'admin_keuangan', 'operator') then
    raise exception 'Tidak berwenang menerbitkan kode aktivasi' using errcode = '42501';
  end if;
  if not admin_mfa_ok() then
    raise exception 'Wajib verifikasi 2FA terlebih dahulu' using errcode = '42501';
  end if;

  select deleted_at into v_deleted
  from guardians where id = p_guardian_id and school_id = v_school;
  if not found or v_deleted is not null then
    raise exception 'Wali tidak ditemukan';
  end if;

  -- Satu kode berlaku per wali: cabut yang lama.
  update guardian_activation_codes
  set revoked_at = now()
  where guardian_id = p_guardian_id and used_at is null and revoked_at is null;

  -- Rejection sampling: byte >= 248 (= 31 × 8) dibuang agar tak bias.
  while length(v_code) < 8 loop
    v_bytes := extensions.gen_random_bytes(16);
    for i in 0 .. 15 loop
      v_b := get_byte(v_bytes, i);
      if v_b < 248 and length(v_code) < 8 then
        v_code := v_code || substr(v_alfabet, (v_b % v_n) + 1, 1);
      end if;
    end loop;
  end loop;

  insert into guardian_activation_codes
    (school_id, guardian_id, code_hash, expires_at, created_by)
  values
    (v_school, p_guardian_id, extensions.crypt(v_code, extensions.gen_salt('bf', 8)),
     now() + interval '7 days', auth.uid());

  insert into audit_logs (school_id, actor_id, actor_role, action, entity, entity_id)
  values (v_school, auth.uid(), v_role, 'guardian.activation_issued', 'guardian', p_guardian_id);

  return v_code;
end;
$$;

-- ── 2. Server memverifikasi kode (service_role) ─────────────────────────────
-- Mengembalikan guardian_id bila cocok, NULL bila tidak. Sengaja tidak raise
-- pada kode salah: hitungan percobaan harus tersimpan.
create or replace function public.verify_activation_code(p_phone text, p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gid  uuid;
  v_row  guardian_activation_codes;
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  select id into v_gid
  from guardians
  where deleted_at is null
    and regexp_replace(phone, '^\+', '') = regexp_replace(coalesce(p_phone, ''), '^\+', '');
  if v_gid is null then
    return null;
  end if;

  select * into v_row
  from guardian_activation_codes
  where guardian_id = v_gid and used_at is null and revoked_at is null
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;
  if not found then
    return null;
  end if;

  if v_row.code_hash <> extensions.crypt(v_code, v_row.code_hash) then
    update guardian_activation_codes
    set attempts = attempts + 1,
        revoked_at = case when attempts + 1 >= 5 then now() else null end
    where id = v_row.id;
    return null;
  end if;

  return v_gid;
end;
$$;

-- ── 3. Server menautkan akun & menghabiskan kode (service_role) ─────────────
create or replace function public.complete_guardian_activation(
  p_guardian_id  uuid,
  p_auth_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid;
begin
  select school_id into v_school
  from guardians where id = p_guardian_id and deleted_at is null;
  if v_school is null then
    raise exception 'Wali tidak ditemukan';
  end if;

  update guardian_activation_codes
  set used_at = now()
  where guardian_id = p_guardian_id and used_at is null and revoked_at is null;

  update guardians set auth_user_id = p_auth_user_id where id = p_guardian_id;

  insert into audit_logs (school_id, actor_id, actor_role, action, entity, entity_id)
  values (v_school, p_auth_user_id, 'guardian', 'guardian.activated', 'guardian', p_guardian_id);
end;
$$;

-- ── 4. Cari akun auth yang sudah ada untuk sebuah nomor (service_role) ──────
-- Wali yang dulu pernah login OTP sudah punya baris auth.users; pakai ulang
-- (cukup setel PIN-nya) alih-alih membuat akun ganda.
create or replace function public.auth_user_id_by_phone(p_phone text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  return (
    select id from auth.users
    where phone = regexp_replace(coalesce(p_phone, ''), '^\+', '')
    limit 1
  );
end;
$$;

-- ── 5. Apakah wali yang login sudah punya PIN (untuk form ubah PIN) ─────────
create or replace function public.my_pin_is_set()
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  return coalesce(
    (select coalesce(encrypted_password, '') <> '' from auth.users where id = auth.uid()),
    false
  );
end;
$$;

-- ── 6. Jejak audit dari sisi wali (daftar aksi tertutup) ────────────────────
-- log_audit khusus admin; wali hanya boleh mencatat aksi dari daftar ini,
-- sehingga tak bisa memalsukan entri audit sembarang.
create or replace function public.log_guardian_event(p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gid    uuid := current_guardian_id();
  v_school uuid;
begin
  if v_gid is null then
    raise exception 'Bukan akun wali aktif' using errcode = '42501';
  end if;
  if p_action not in ('guardian.pin_changed') then
    raise exception 'Aksi audit tidak dikenal: %', p_action;
  end if;
  select school_id into v_school from guardians where id = v_gid;
  insert into audit_logs (school_id, actor_id, actor_role, action, entity, entity_id)
  values (v_school, auth.uid(), 'guardian', p_action, 'guardian', v_gid);
end;
$$;

-- ── Hak eksekusi ────────────────────────────────────────────────────────────
revoke execute on function public.log_guardian_event(text) from public, anon;
grant execute on function public.log_guardian_event(text) to authenticated;

revoke execute on function public.issue_activation_code(uuid) from public, anon;
grant execute on function public.issue_activation_code(uuid) to authenticated;

revoke execute on function public.verify_activation_code(text, text) from public, anon, authenticated;
revoke execute on function public.complete_guardian_activation(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.auth_user_id_by_phone(text) from public, anon, authenticated;
grant execute on function public.verify_activation_code(text, text) to service_role;
grant execute on function public.complete_guardian_activation(uuid, uuid) to service_role;
grant execute on function public.auth_user_id_by_phone(text) to service_role;

revoke execute on function public.my_pin_is_set() from public, anon;
grant execute on function public.my_pin_is_set() to authenticated;
