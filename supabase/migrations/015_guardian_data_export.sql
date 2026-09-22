-- ============================================================================
-- ArtaSchool Pay — 015_guardian_data_export.sql
-- UU PDP: HAK AKSES & PORTABILITAS DATA WALI.
--
-- Wali berhak memperoleh salinan data pribadi yang disimpan sekolah tentang
-- dirinya. RPC ini merakit satu objek JSON (mudah dibaca manusia sekaligus
-- machine-readable) berisi: profil wali, anak yang terhubung, dan riwayat
-- pembayaran yang IA kirim.
--
-- Isolasi: seluruh subquery di-scope ke current_guardian_id() (wali pemanggil).
-- Tidak ada parameter id — mustahil mengekspor data wali lain. Data yang
-- disertakan hanyalah yang memang menjadi hak akses wali (dirinya + anaknya +
-- pembayarannya sendiri), sejalan dengan RLS.
-- ============================================================================

set check_function_bodies = off;

create or replace function public.export_my_guardian_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gid    uuid := current_guardian_id();
  v_result jsonb;
begin
  if v_gid is null then
    raise exception 'Bukan akun wali aktif' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'diekspor_pada', now(),

    'wali', (
      select jsonb_build_object(
        'nama',     g.full_name,
        'nomor_hp', g.phone,
        'email',    g.email,
        'sekolah',  s.name
      )
      from guardians g
      join schools s on s.id = g.school_id
      where g.id = v_gid
    ),

    'anak', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'nama',   st.full_name,
          'nis',    st.nis,
          'relasi', gs.relation,
          'kelas', (
            select c.label
            from class_enrollments ce
            join classes c        on c.id = ce.class_id
            join academic_years ay on ay.id = c.academic_year_id
            where ce.student_id = st.id and ay.is_active
            limit 1
          )
        )
        order by st.full_name
      )
      from guardian_students gs
      join students st on st.id = gs.student_id
      where gs.guardian_id = v_gid
    ), '[]'::jsonb),

    'pembayaran', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'tanggal_kirim',     p.created_at,
          'tanggal_transfer',  p.transferred_at,
          'nominal',           p.amount,
          'metode',            p.method,
          'bank',              p.bank_name,
          'nama_pengirim',     p.sender_name,
          'status',            p.status,
          'catatan_verifikasi', p.review_note,
          'siswa',             (select full_name from students where id = p.student_id),
          'alokasi', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'periode', b.period,
                'jenis',   pt.name,
                'nominal', pa.amount
              )
            )
            from payment_allocations pa
            join bills b            on b.id = pa.bill_id
            left join payment_types pt on pt.id = b.payment_type_id
            where pa.payment_id = p.id
          ), '[]'::jsonb)
        )
        order by p.created_at desc
      )
      from payments p
      where p.submitted_by = v_gid
    ), '[]'::jsonb)
  )
  into v_result;

  -- Jejak audit: wali mengakses/mengekspor datanya (hak akses UU PDP).
  insert into audit_logs
    (school_id, actor_id, actor_role, action, entity, entity_id)
  select school_id, auth.uid(), 'guardian', 'guardian.data_exported', 'guardian', v_gid
  from guardians where id = v_gid;

  return v_result;
end;
$$;

revoke all on function public.export_my_guardian_data() from public;
grant execute on function public.export_my_guardian_data() to authenticated;
