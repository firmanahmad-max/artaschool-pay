-- ============================================================================
-- ArtaSchool Pay — 003_masterdata_helpers.sql
-- Helper Sprint 3: audit log dari Server Action + aktivasi tahun ajaran atomik.
-- ============================================================================

-- Server Action tidak boleh insert audit_logs langsung (tidak ada policy insert
-- untuk authenticated) — semua lewat RPC ini (CONTEXT Konvensi #4).
create or replace function public.log_audit(
  p_action text,
  p_entity text default null,
  p_entity_id uuid default null,
  p_before jsonb default null,
  p_after jsonb default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_school uuid := current_admin_school_id();
  v_role text := current_admin_role();
begin
  if v_school is null then
    raise exception 'Hanya admin yang boleh menulis audit log';
  end if;
  insert into audit_logs (school_id, actor_id, actor_role, action, entity, entity_id, before, after)
  values (v_school, auth.uid(), v_role, p_action, p_entity, p_entity_id, p_before, p_after);
end;
$$;

-- Hanya satu tahun ajaran aktif per sekolah; ganti aktif harus atomik.
create or replace function public.activate_academic_year(p_year_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_school uuid := current_admin_school_id();
  v_role text := current_admin_role();
  v_name text;
begin
  if v_role is null or v_role not in ('super_admin','operator') then
    raise exception 'Tidak berwenang mengelola tahun ajaran';
  end if;

  select name into v_name from academic_years
  where id = p_year_id and school_id = v_school;
  if not found then
    raise exception 'Tahun ajaran tidak ditemukan';
  end if;

  update academic_years set is_active = (id = p_year_id)
  where school_id = v_school;

  insert into audit_logs (school_id, actor_id, actor_role, action, entity, entity_id, after)
  values (v_school, auth.uid(), v_role, 'academic_year.activated', 'academic_year', p_year_id,
          jsonb_build_object('name', v_name));
end;
$$;
