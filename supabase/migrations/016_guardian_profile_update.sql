-- ============================================================================
-- ArtaSchool Pay — 016_guardian_profile_update.sql
-- UU PDP: HAK KOREKSI DATA. Wali membetulkan data pribadinya sendiri.
--
-- Hanya nama & email yang boleh diubah wali. Nomor HP TIDAK — itu kunci login
-- (OTP) dan diubah lewat sekolah agar akun tidak bisa dibajak dengan menukar
-- nomor. school_id & auth_user_id juga tak tersentuh RPC ini.
--
-- guardians tidak punya policy UPDATE untuk wali (hanya admin), jadi jalur satu-
-- satunya adalah RPC security definer yang di-scope ke current_guardian_id().
-- ============================================================================

set check_function_bodies = off;

create or replace function public.update_my_guardian_profile(
  p_full_name text,
  p_email     text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gid    uuid := current_guardian_id();
  v_school uuid;
  v_name   text;
  v_email  text;
begin
  if v_gid is null then
    raise exception 'Bukan akun wali aktif' using errcode = '42501';
  end if;

  v_name := nullif(btrim(p_full_name), '');
  if v_name is null then
    raise exception 'Nama wajib diisi' using errcode = '22023';
  end if;
  if length(v_name) > 100 then
    raise exception 'Nama terlalu panjang' using errcode = '22023';
  end if;

  -- Email opsional; kosong berarti dihapus.
  v_email := nullif(btrim(p_email), '');
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email tidak valid' using errcode = '22023';
  end if;

  select school_id into v_school from guardians where id = v_gid;

  update guardians
  set full_name = v_name,
      email     = v_email
  where id = v_gid;

  insert into audit_logs
    (school_id, actor_id, actor_role, action, entity, entity_id)
  values
    (v_school, auth.uid(), 'guardian', 'guardian.profile_updated', 'guardian', v_gid);
end;
$$;

revoke all on function public.update_my_guardian_profile(text, text) from public;
grant execute on function public.update_my_guardian_profile(text, text) to authenticated;
