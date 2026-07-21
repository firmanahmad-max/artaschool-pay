-- ============================================================================
-- ArtaSchool Pay — 002_claim_guardian.sql
-- Menautkan akun auth (login OTP pertama) ke baris guardians yang nomornya
-- sudah didaftarkan admin (PRD §6.1: orang tua tidak bisa self-register bebas).
-- ============================================================================

create or replace function public.claim_guardian_account()
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_phone text;
  v_id uuid;
begin
  if auth.uid() is null then
    return null;
  end if;

  -- Sudah tertaut? Kembalikan id-nya (idempotent utk login berikutnya)
  select id into v_id from guardians where auth_user_id = auth.uid();
  if v_id is not null then
    return v_id;
  end if;

  -- Supabase menyimpan phone tanpa '+' (mis. 62812…); guardians memakai +62812…
  select nullif(auth.jwt() ->> 'phone', '') into v_phone;
  if v_phone is null then
    return null;
  end if;

  update guardians
  set auth_user_id = auth.uid()
  where auth_user_id is null
    and regexp_replace(phone, '^\+', '') = regexp_replace(v_phone, '^\+', '')
  returning id into v_id;

  if v_id is not null then
    insert into audit_logs (school_id, actor_id, actor_role, action, entity, entity_id)
    select school_id, auth.uid(), 'guardian', 'guardian.account_claimed', 'guardian', v_id
    from guardians where id = v_id;
  end if;

  return v_id;
end;
$$;
