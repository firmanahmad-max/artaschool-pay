-- ============================================================================
-- ArtaSchool Pay — 021_web_push.sql
-- Notifikasi push aplikasi (Web Push / VAPID) — kanal otomatis GRATIS yang
-- tidak bergantung gateway WhatsApp. Android: langsung; iPhone: setelah
-- aplikasi dipasang ke Layar Utama (iOS 16.4+).
--
-- • Setiap notifikasi wali yang diantrekan (enqueue_notification) kini juga
--   membuat job kanal 'push' BILA wali punya perangkat terdaftar. Worker
--   mengirimnya otomatis — juga di mode manual.
-- • Langganan hanya dikelola wali sendiri lewat RPC; tabel tanpa policy.
-- ============================================================================

set check_function_bodies = off;

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  guardian_id uuid not null references guardians(id),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);

create index idx_push_subscriptions_guardian on push_subscriptions (guardian_id);

alter table push_subscriptions enable row level security;
revoke all on push_subscriptions from anon, authenticated;

-- ── Wali: daftarkan / cabut perangkat ───────────────────────────────────────
create or replace function public.save_push_subscription(
  p_endpoint   text,
  p_p256dh     text,
  p_auth       text,
  p_user_agent text default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_gid    uuid := current_guardian_id();
  v_school uuid;
begin
  if v_gid is null then
    raise exception 'Bukan akun wali aktif' using errcode = '42501';
  end if;
  if p_endpoint is null or p_endpoint !~ '^https://' or length(p_endpoint) > 1000
     or coalesce(length(p_p256dh), 0) not between 1 and 200
     or coalesce(length(p_auth), 0) not between 1 and 100 then
    raise exception 'Data langganan push tidak valid';
  end if;

  select school_id into v_school from guardians where id = v_gid;

  -- Ponsel keluarga dipakai bergantian: endpoint yang sama berpindah ke wali
  -- yang sedang masuk, bukan menumpuk ke dua wali.
  insert into push_subscriptions (school_id, guardian_id, endpoint, p256dh, auth, user_agent)
  values (v_school, v_gid, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
  set school_id = excluded.school_id,
      guardian_id = excluded.guardian_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      user_agent = excluded.user_agent,
      created_at = now();
end;
$$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_gid uuid := current_guardian_id();
begin
  if v_gid is null then
    raise exception 'Bukan akun wali aktif' using errcode = '42501';
  end if;
  delete from push_subscriptions where endpoint = p_endpoint and guardian_id = v_gid;
end;
$$;

-- ── Antrean: notifikasi wali → juga kanal push bila ada perangkat ───────────
-- Signature sama dgn 008 → ACL dari 018 (internal) tetap berlaku.
create or replace function public.enqueue_notification(
  p_school_id uuid,
  p_guardian_id uuid,
  p_template text,
  p_body text,
  p_payload jsonb default '{}'
)
returns bigint
language plpgsql security definer
set search_path = public
as $$
declare
  v_phone text;
  v_id bigint;
begin
  select phone into v_phone from guardians where id = p_guardian_id;
  if v_phone is null or length(trim(v_phone)) = 0 then
    return null;  -- wali tanpa nomor: lewati, bukan error
  end if;

  insert into notification_jobs (
    school_id, recipient_guardian_id, recipient_phone, template, body, payload
  ) values (
    p_school_id, p_guardian_id, v_phone, p_template, p_body, coalesce(p_payload, '{}')
  )
  returning id into v_id;

  if exists (select 1 from push_subscriptions where guardian_id = p_guardian_id) then
    insert into notification_jobs (
      school_id, channel, recipient_guardian_id, recipient_phone, template, body, payload
    ) values (
      p_school_id, 'push', p_guardian_id, v_phone, p_template, p_body, coalesce(p_payload, '{}')
    );
  end if;

  return v_id;
end;
$$;

-- ── Kotak Keluar: wali mana yang sudah menerima notifikasi aplikasi ─────────
-- Petunjuk bagi admin (boleh melewati WA manual); tidak membuka endpoint/kunci.
-- Hanya perangkat yang BENAR-BENAR berhasil menerima push ≤30 hari terakhir —
-- sekadar terdaftar belum berarti notifikasinya sampai.
create or replace function public.outbox_guardians_with_push()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select distinct guardian_id
  from push_subscriptions
  where school_id = current_admin_school_id()
    and current_admin_role() in ('super_admin', 'admin_keuangan', 'operator')
    and last_success_at > now() - interval '30 days';
$$;

-- ── Hapus akun wali (UU PDP): cabut juga perangkat push ─────────────────────
-- Isi sama dgn 014 + penghapusan push_subscriptions (endpoint = data perangkat).
create or replace function public.delete_my_guardian_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid    uuid := auth.uid();
  v_gid    uuid;
  v_school uuid;
begin
  if v_uid is null then
    raise exception 'Tidak ada sesi' using errcode = '42501';
  end if;

  select id, school_id into v_gid, v_school
  from guardians
  where auth_user_id = v_uid;

  if v_gid is null then
    raise exception 'Bukan akun wali aktif' using errcode = '42501';
  end if;

  delete from notification_jobs where recipient_guardian_id = v_gid;
  delete from push_subscriptions where guardian_id = v_gid;
  delete from guardian_students where guardian_id = v_gid;

  update guardians
  set full_name    = 'Akun Dihapus',
      phone        = 'deleted:' || v_gid::text,
      email        = null,
      auth_user_id = null,
      deleted_at   = now()
  where id = v_gid;

  insert into audit_logs
    (school_id, actor_id, actor_role, action, entity, entity_id)
  values
    (v_school, v_uid, 'guardian', 'guardian.account_deleted', 'guardian', v_gid);

  delete from auth.users where id = v_uid;
end;
$$;

-- ── Hak eksekusi ────────────────────────────────────────────────────────────
revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
revoke execute on function public.delete_push_subscription(text) from public, anon;
revoke execute on function public.outbox_guardians_with_push() from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.delete_push_subscription(text) to authenticated;
grant execute on function public.outbox_guardians_with_push() to authenticated;
