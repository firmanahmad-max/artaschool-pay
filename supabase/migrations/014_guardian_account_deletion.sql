-- ============================================================================
-- ArtaSchool Pay — 014_guardian_account_deletion.sql
-- UU PDP §8: HAK HAPUS AKUN WALI (right to erasure).
--
-- Ketegangan yang ditangani:
--   • UU PDP menuntut data pribadi wali bisa dihapus atas permintaannya.
--   • PRD §8 menuntut bukti transfer & catatan keuangan disimpan 7 tahun
--     (kebutuhan pembukuan).
--
-- Penyelesaian (pola right-to-erasure): HAPUS data pribadi (nama, HP, email,
-- identitas login) TETAPI PERTAHANKAN catatan keuangan (payments.submitted_by)
-- dalam bentuk ter-anonimkan. Baris `guardians` TIDAK dihapus fisik — itu akan
-- memutus FK payments — melainkan di-*tombstone*. Identitas login (auth.users,
-- yang menyimpan nomor HP asli) dihapus agar erasure benar-benar tuntas.
-- ============================================================================

set check_function_bodies = off;

alter table guardians add column if not exists deleted_at timestamptz;

-- Wali menghapus akunnya sendiri. Otorisasi: HANYA baris yang tertaut ke
-- auth.uid() pemanggil — tidak ada parameter id, jadi tak bisa menghapus wali
-- lain. security definer agar boleh menyentuh notification_jobs & auth.users.
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
    -- Bukan wali aktif (mis. admin, atau akun sudah dihapus sebelumnya).
    raise exception 'Bukan akun wali aktif' using errcode = '42501';
  end if;

  -- 1) Batalkan notifikasi tertunda & buang jejak nomor pada job lama.
  --    notification_jobs = data operasional transient, bukan pembukuan.
  delete from notification_jobs where recipient_guardian_id = v_gid;

  -- 2) Lepas keterkaitan dengan anak — wali tidak lagi terkait siswa manapun.
  --    (Data siswa itu sendiri milik sekolah, tetap ada.)
  delete from guardian_students where guardian_id = v_gid;

  -- 3) Anonimkan baris guardians (tombstone). Data pribadi hilang, FK utuh.
  --    phone di-tombstone UNIK: tetap memenuhi NOT NULL + unique(school,phone)
  --    dan tidak akan cocok dengan OTP nomor asli, sehingga baris ini tak bisa
  --    direklaim diam-diam lewat login ulang.
  update guardians
  set full_name    = 'Akun Dihapus',
      phone        = 'deleted:' || v_gid::text,
      email        = null,
      auth_user_id = null,
      deleted_at   = now()
  where id = v_gid;

  -- 4) Jejak audit — WAJIB tanpa data pribadi (nama/HP tidak disertakan).
  insert into audit_logs
    (school_id, actor_id, actor_role, action, entity, entity_id)
  values
    (v_school, v_uid, 'guardian', 'guardian.account_deleted', 'guardian', v_gid);

  -- 5) Hapus identitas login. auth.users menyimpan nomor HP asli, jadi ini
  --    perlu agar erasure tuntas. auth_user_id sudah di-null-kan (langkah 3)
  --    sehingga FK guardians→auth.users tidak terlanggar.
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_guardian_account() from public;
grant execute on function public.delete_my_guardian_account() to authenticated;
