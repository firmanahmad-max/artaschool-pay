-- ============================================================================
-- 023 — Digest harian idempoten
--
-- Vercel Cron bersifat "best effort": satu jadwal kadang terpanggil LEBIH DARI
-- SEKALI (dokumentasi resmi Vercel), begitu pula bila admin memicu ulang
-- manual. enqueue_daily_digest lama mengantre ulang tanpa syarat → kepala
-- sekolah menerima ringkasan harian ganda.
--
-- Kini: satu digest per penerima per hari (zona WITA). Advisory lock
-- transaksi mencegah dua panggilan yang benar-benar bersamaan sama-sama lolos
-- pengecekan.
-- ============================================================================

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
  v_hari_ini date := (now() at time zone 'Asia/Makassar')::date;
  v_tanggal text := to_char(now() at time zone 'Asia/Makassar', 'DD-MM-YYYY');
begin
  perform pg_advisory_xact_lock(hashtext('enqueue_daily_digest'));

  for v_school in select id, name from schools loop
    -- Uang masuk hari ini (yang disetujui hari ini, waktu WITA)
    select coalesce(sum(amount), 0), count(*)
      into v_masuk, v_jml_masuk
    from payments
    where school_id = v_school.id
      and status = 'approved'
      and (reviewed_at at time zone 'Asia/Makassar')::date = v_hari_ini;

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
      -- Sudah diantrekan hari ini → lewati (panggilan cron ganda).
      continue when exists (
        select 1 from notification_jobs
        where school_id = v_school.id
          and recipient_phone = v_admin.phone
          and template = 'digest.daily'
          and (created_at at time zone 'Asia/Makassar')::date = v_hari_ini
      );

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

-- CREATE OR REPLACE mempertahankan ACL, tetapi ditegaskan ulang: hanya server.
revoke execute on function public.enqueue_daily_digest() from public, anon, authenticated;
grant execute on function public.enqueue_daily_digest() to service_role;
