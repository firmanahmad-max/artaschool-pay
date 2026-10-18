-- ============================================================================
-- ArtaSchool Pay — 020_manual_wa_outbox.sql
-- Kotak Keluar WA: mode semi-otomatis tanpa gateway.
--
-- Pesan WA tetap diantrekan seperti biasa (notification_jobs). Bedanya, pada
-- mode manual worker TIDAK mengklaim kanal 'wa' — pesan menunggu di Kotak
-- Keluar, admin membuka tautan wa.me, menekan Kirim di WhatsApp, lalu
-- menandainya terkirim. Pada mode gateway, Kotak Keluar menampung pesan yang
-- gagal permanen agar bisa dikirim manual.
-- ============================================================================

set check_function_bodies = off;

-- Status baru 'skipped': sengaja tidak dikirim admin (beda dari 'dead' =
-- gagal permanen di gateway).
alter table notification_jobs drop constraint notification_jobs_status_check;
alter table notification_jobs add constraint notification_jobs_status_check
  check (status in ('queued', 'sending', 'sent', 'failed', 'dead', 'skipped'));

-- Siapa yang mengirim/melewati secara manual (auth uid admin).
alter table notification_jobs add column if not exists manual_sender uuid;

-- ── Worker: klaim hanya kanal yang bisa ia kirim ────────────────────────────
drop function if exists public.claim_notification_jobs(int);

create function public.claim_notification_jobs(
  p_limit    int    default 10,
  p_channels text[] default array['wa', 'push']
)
returns setof notification_jobs
language plpgsql security definer
set search_path = public
as $$
begin
  return query
  update notification_jobs nj
  set status = 'sending', attempts = nj.attempts + 1
  where nj.id in (
    select j.id from notification_jobs j
    where j.status in ('queued', 'failed')
      and j.next_attempt_at <= now()
      and j.channel = any(p_channels)
    order by j.next_attempt_at
    limit greatest(p_limit, 1)
    for update skip locked
  )
  returning nj.*;
end;
$$;

-- Tetap internal (lihat 018).
revoke execute on function public.claim_notification_jobs(int, text[])
  from public, anon, authenticated;
grant execute on function public.claim_notification_jobs(int, text[]) to service_role;

-- ── Admin: tandai terkirim manual / lewati ──────────────────────────────────
create or replace function public.mark_notification_sent_manually(p_id bigint)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_school uuid := current_admin_school_id();
  v_role   text := current_admin_role();
begin
  if v_role is null or v_role not in ('super_admin', 'admin_keuangan', 'operator') then
    raise exception 'Tidak berwenang mengelola Kotak Keluar WA' using errcode = '42501';
  end if;

  update notification_jobs
  set status = 'sent', sent_at = now(), last_error = null, manual_sender = auth.uid()
  where id = p_id
    and school_id = v_school
    and channel = 'wa'
    and status in ('queued', 'failed', 'dead');
  if not found then
    raise exception 'Pesan tidak ditemukan atau sudah diproses';
  end if;
end;
$$;

create or replace function public.skip_notification(p_id bigint)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_school uuid := current_admin_school_id();
  v_role   text := current_admin_role();
begin
  if v_role is null or v_role not in ('super_admin', 'admin_keuangan', 'operator') then
    raise exception 'Tidak berwenang mengelola Kotak Keluar WA' using errcode = '42501';
  end if;

  update notification_jobs
  set status = 'skipped', manual_sender = auth.uid()
  where id = p_id
    and school_id = v_school
    and channel = 'wa'
    and status in ('queued', 'failed', 'dead');
  if not found then
    raise exception 'Pesan tidak ditemukan atau sudah diproses';
  end if;
end;
$$;

revoke execute on function public.mark_notification_sent_manually(bigint) from public, anon;
revoke execute on function public.skip_notification(bigint) from public, anon;
grant execute on function public.mark_notification_sent_manually(bigint) to authenticated;
grant execute on function public.skip_notification(bigint) to authenticated;
