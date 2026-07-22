-- ============================================================================
-- ArtaSchool Pay — 012_daily_digest.sql
-- v2: digest harian WhatsApp untuk kepala sekolah (PRD §7.3 & §9 v2).
-- Memakai antrean notifikasi yang sudah ada (Sprint 8), jadi throttle, retry,
-- dan dead-letter otomatis berlaku.
-- ============================================================================

set check_function_bodies = off;

-- Penerima digest adalah admin_users, bukan guardians → butuh nomor HP.
alter table admin_users
  add column if not exists phone text,
  add column if not exists daily_digest boolean not null default false;

comment on column admin_users.daily_digest is
  'Terima ringkasan harian via WhatsApp (kepala sekolah / super admin).';

-- Enqueue ke nomor bebas (bukan wali) — dipakai digest admin.
create or replace function public.enqueue_notification_phone(
  p_school_id uuid,
  p_phone text,
  p_template text,
  p_body text,
  p_payload jsonb default '{}'
)
returns bigint
language plpgsql security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if p_phone is null or length(trim(p_phone)) = 0 then
    return null;
  end if;
  insert into notification_jobs (
    school_id, recipient_guardian_id, recipient_phone, template, body, payload
  ) values (
    p_school_id, null, p_phone, p_template, p_body, coalesce(p_payload, '{}')
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- Susun & antre digest harian untuk semua sekolah yang punya penerima aktif.
-- Dipanggil worker terjadwal memakai service_role (tanpa konteks auth.uid()).
create or replace function public.enqueue_daily_digest()
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_school record;
  v_admin record;
  v_masuk numeric(12,0);
  v_jml_masuk int;
  v_antre int;
  v_tunggakan numeric(12,0);
  v_body text;
  v_count int := 0;
  v_tanggal text := to_char(now() at time zone 'Asia/Makassar', 'DD-MM-YYYY');
begin
  for v_school in select id, name from schools loop
    -- Uang masuk hari ini (yang disetujui hari ini, waktu WITA)
    select coalesce(sum(amount), 0), count(*)
      into v_masuk, v_jml_masuk
    from payments
    where school_id = v_school.id
      and status = 'approved'
      and (reviewed_at at time zone 'Asia/Makassar')::date
          = (now() at time zone 'Asia/Makassar')::date;

    select count(*) into v_antre
    from payments
    where school_id = v_school.id and status = 'pending';

    select coalesce(sum(amount - amount_paid), 0) into v_tunggakan
    from bills
    where school_id = v_school.id and status in ('unpaid', 'partial');

    v_body :=
      '[Ringkasan Harian ' || v_tanggal || '] ' || v_school.name || chr(10) ||
      '• Uang masuk hari ini: ' || format_rupiah(v_masuk) ||
      ' (' || v_jml_masuk || ' pembayaran)' || chr(10) ||
      '• Menunggu verifikasi: ' || v_antre || chr(10) ||
      '• Total tunggakan: ' || format_rupiah(v_tunggakan);

    for v_admin in
      select phone from admin_users
      where school_id = v_school.id
        and is_active
        and daily_digest
        and phone is not null
    loop
      if enqueue_notification_phone(
           v_school.id, v_admin.phone, 'digest.daily', v_body,
           jsonb_build_object('masuk', v_masuk, 'antre', v_antre,
                              'tunggakan', v_tunggakan)
         ) is not null then
        v_count := v_count + 1;
      end if;
    end loop;
  end loop;

  return v_count;
end;
$$;

-- Hanya server (service_role) yang boleh memicu digest.
revoke execute on function public.enqueue_daily_digest() from public;
revoke execute on function public.enqueue_daily_digest() from anon;
revoke execute on function public.enqueue_daily_digest() from authenticated;
grant execute on function public.enqueue_daily_digest() to service_role;
