-- ============================================================================
-- Tes regresi logika keuangan (dijalankan CI setelah migrations + seed).
--
-- Alasan keberadaannya: aturan di RPC inilah yang menjaga uang sekolah tidak
-- salah catat. Sebelum ini CI hanya memastikan migration BISA dijalankan,
-- bukan bahwa aturannya MASIH benar. Satu perubahan ceroboh pada
-- approve_payment sudah cukup untuk membuat tagihan lunas tanpa uang masuk.
--
-- Setiap tes menegaskan satu aturan; gagal = keluar dengan kode error
-- sehingga build berhenti.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

-- Seluruh berkas berjalan dalam SATU transaksi yang selalu di-ROLLBACK.
-- Tanpa ini, data uji tertinggal dan menjalankan ulang gagal karena bentrok
-- kunci unik — kegagalan palsu yang menyamarkan regresi sungguhan.
begin;

-- ── Perkakas uji ────────────────────────────────────────────────────────────
create schema if not exists uji;

-- Jalankan pernyataan yang SEHARUSNYA gagal; error bila justru berhasil.
create or replace function uji.harus_gagal(p_sql text, p_nama text, p_pesan text default null)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if p_pesan is not null and position(lower(p_pesan) in lower(sqlerrm)) = 0 then
      raise exception 'GAGAL [%]: ditolak, tetapi alasannya tak terduga: %', p_nama, sqlerrm;
    end if;
    raise notice '  OK   % — ditolak (%)', p_nama, left(sqlerrm, 58);
    return;
  end;
  raise exception 'GAGAL [%]: seharusnya DITOLAK, tetapi berhasil', p_nama;
end $$;

create or replace function uji.samakan(p_aktual anyelement, p_harap anyelement, p_nama text)
returns void language plpgsql as $$
begin
  if p_aktual is distinct from p_harap then
    raise exception 'GAGAL [%]: dapat %, harap %', p_nama, p_aktual, p_harap;
  end if;
  raise notice '  OK   % (=%)', p_nama, p_harap;
end $$;

-- Sekolah acuan seluruh tes. Ditambatkan ke sekolah dari seed agar tes tetap
-- benar pada basis data yang memuat LEBIH DARI SATU sekolah (skenario SaaS) —
-- memakai `schools limit 1` sempat membuat entitas uji tercecer antar-sekolah.
create or replace function uji.sekolah()
returns uuid language sql stable as $$
  select id from schools order by created_at, id limit 1;
$$;

-- Berperan sebagai admin tertentu, dengan level 2FA tertentu
create or replace function uji.jadi_admin(p_role text, p_aal text default 'aal2')
returns uuid language plpgsql as $$
declare v_uid uuid; v_sekolah uuid := uji.sekolah();
begin
  select auth_user_id into v_uid from admin_users where role = p_role and school_id = v_sekolah limit 1;
  if v_uid is null then
    v_uid := gen_random_uuid();
    insert into auth.users (id) values (v_uid);
    insert into admin_users (school_id, auth_user_id, full_name, role, is_active)
    values (v_sekolah, v_uid, 'Uji ' || p_role, p_role, true);
  end if;
  -- Memakai `request.jwt.claims` (objek JSON) persis seperti Supabase asli,
  -- supaya berkas tes ini juga sahih dijalankan terhadap basis data nyata.
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_uid::text, 'aal', p_aal)::text, false);
  return v_uid;
end $$;

create or replace function uji.jadi_wali(p_phone text)
returns uuid language plpgsql as $$
declare v_uid uuid; v_gid uuid;
begin
  select id, auth_user_id into v_gid, v_uid from guardians where phone = p_phone;
  if v_uid is null then
    v_uid := gen_random_uuid();
    insert into auth.users (id) values (v_uid);
    update guardians set auth_user_id = v_uid where id = v_gid;
  end if;
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_uid::text, 'aal', 'aal1', 'phone', p_phone)::text, false);
  return v_gid;
end $$;

\echo ''
\echo '=== Tes logika keuangan ==='
\echo ''

-- ── 1. approve_payment: alokasi harus seimbang ─────────────────────────────
\echo '[1] approve_payment — keseimbangan alokasi'
do $$
declare
  v_sekolah uuid; v_siswa uuid; v_tagihan uuid; v_bayar uuid; v_jenis uuid; v_tahun uuid;
begin
  perform uji.jadi_admin('admin_keuangan');
  v_sekolah := uji.sekolah();
  select id into v_siswa from students where school_id = uji.sekolah() and is_active limit 1;
  select id into v_jenis from payment_types where school_id = uji.sekolah() limit 1;
  select id into v_tahun from academic_years where is_active and school_id = uji.sekolah() limit 1;

  insert into bills (school_id, student_id, payment_type_id, academic_year_id, period, amount)
  values (v_sekolah, v_siswa, v_jenis, v_tahun, '2030-01-01', 500000)
  returning id into v_tagihan;

  insert into payments (school_id, student_id, amount, status, method)
  values (v_sekolah, v_siswa, 500000, 'pending', 'transfer')
  returning id into v_bayar;

  -- kurang dari nominal
  perform uji.harus_gagal(
    format('select approve_payment(%L, %L::jsonb)', v_bayar,
           json_build_array(json_build_object('bill_id', v_tagihan, 'amount', 400000))::text),
    'alokasi kurang dari nominal', 'harus sama dengan');

  -- lebih dari nominal
  perform uji.harus_gagal(
    format('select approve_payment(%L, %L::jsonb)', v_bayar,
           json_build_array(json_build_object('bill_id', v_tagihan, 'amount', 600000))::text),
    'alokasi melebihi nominal', 'harus sama dengan');

  -- alokasi kosong
  perform uji.harus_gagal(
    format('select approve_payment(%L, %L::jsonb)', v_bayar, '[]'),
    'alokasi kosong', 'wajib diisi');

  -- pas → berhasil, tagihan lunas lewat trigger
  perform approve_payment(v_bayar,
    json_build_array(json_build_object('bill_id', v_tagihan, 'amount', 500000))::jsonb);
  perform uji.samakan((select status from bills where id = v_tagihan), 'paid', 'tagihan lunas');
  perform uji.samakan((select amount_paid from bills where id = v_tagihan), 500000::numeric,
                      'amount_paid tersinkron trigger');
  perform uji.samakan((select status from payments where id = v_bayar), 'approved', 'pembayaran disetujui');

  -- tidak bisa disetujui dua kali
  perform uji.harus_gagal(
    format('select approve_payment(%L, %L::jsonb)', v_bayar,
           json_build_array(json_build_object('bill_id', v_tagihan, 'amount', 500000))::text),
    'setujui dua kali', 'pending');
end $$;

-- ── 2. Penegakan 2FA di database (perbaikan pasca gladi resik UAT) ─────────
\echo ''
\echo '[2] Penegakan 2FA pada RPC uang'
do $$
declare v_sekolah uuid; v_siswa uuid; v_tagihan uuid; v_bayar uuid; v_jenis uuid; v_tahun uuid;
begin
  v_sekolah := uji.sekolah();
  select id into v_siswa from students where school_id = uji.sekolah() and is_active limit 1;
  select id into v_jenis from payment_types where school_id = uji.sekolah() limit 1;
  select id into v_tahun from academic_years where is_active and school_id = uji.sekolah() limit 1;

  insert into bills (school_id, student_id, payment_type_id, academic_year_id, period, amount)
  values (v_sekolah, v_siswa, v_jenis, v_tahun, '2030-02-01', 100000) returning id into v_tagihan;
  insert into payments (school_id, student_id, amount, status, method)
  values (v_sekolah, v_siswa, 100000, 'pending', 'transfer') returning id into v_bayar;

  -- sesi aal1 (kata sandi saja) HARUS ditolak
  perform uji.jadi_admin('admin_keuangan', 'aal1');
  perform uji.harus_gagal(
    format('select approve_payment(%L, %L::jsonb)', v_bayar,
           json_build_array(json_build_object('bill_id', v_tagihan, 'amount', 100000))::text),
    'approve pada aal1', 'dua langkah');
  perform uji.harus_gagal(
    format('select waive_bill(%L, %L)', v_tagihan, 'uji'),
    'waive pada aal1', 'dua langkah');
  perform uji.harus_gagal(
    format('select record_cash_payment(%L, 1000, %L::jsonb)', v_siswa,
           json_build_array(json_build_object('bill_id', v_tagihan, 'amount', 1000))::text),
    'tunai pada aal1', 'dua langkah');

  -- aal2 → boleh
  perform uji.jadi_admin('admin_keuangan', 'aal2');
  perform approve_payment(v_bayar,
    json_build_array(json_build_object('bill_id', v_tagihan, 'amount', 100000))::jsonb);
  perform uji.samakan((select status from payments where id = v_bayar), 'approved', 'approve pada aal2');
end $$;

-- ── 3. review_payment: catatan wajib ───────────────────────────────────────
\echo ''
\echo '[3] review_payment — catatan wajib'
do $$
declare v_sekolah uuid; v_siswa uuid; v_bayar uuid;
begin
  perform uji.jadi_admin('admin_keuangan', 'aal2');
  v_sekolah := uji.sekolah();
  select id into v_siswa from students where school_id = uji.sekolah() and is_active limit 1;
  insert into payments (school_id, student_id, amount, status, method)
  values (v_sekolah, v_siswa, 50000, 'pending', 'transfer') returning id into v_bayar;

  perform uji.harus_gagal(
    format('select review_payment(%L, %L, %L)', v_bayar, 'rejected', ''),
    'tolak tanpa catatan', 'wajib diisi');
  perform uji.harus_gagal(
    format('select review_payment(%L, %L, %L)', v_bayar, 'needs_revision', '   '),
    'revisi dengan catatan spasi', 'wajib diisi');
  perform uji.harus_gagal(
    format('select review_payment(%L, %L, %L)', v_bayar, 'approved', 'x'),
    'aksi tak dikenal', 'tidak dikenal');

  perform review_payment(v_bayar, 'needs_revision', 'Nominal tidak sesuai');
  perform uji.samakan((select status from payments where id = v_bayar), 'needs_revision', 'revisi tercatat');
end $$;

-- ── 4. generate_bills: idempotent ──────────────────────────────────────────
\echo ''
\echo '[4] generate_bills — aman diulang'
do $$
declare v_jenis uuid; v_a int; v_b int; v_aktif int;
begin
  perform uji.jadi_admin('admin_keuangan', 'aal2');
  select id into v_jenis from payment_types where is_recurring and school_id = uji.sekolah() limit 1;
  select count(*) into v_aktif from students where is_active and school_id = uji.sekolah();

  select generate_bills(v_jenis, '2031-03-01') into v_a;
  perform uji.samakan(v_a, v_aktif, 'tagihan dibuat = siswa aktif');
  select generate_bills(v_jenis, '2031-03-01') into v_b;
  perform uji.samakan(v_b, 0, 'jalankan ulang tidak menduplikasi');
end $$;

-- ── 5. waive_bill: tolak bila sudah ada pembayaran ─────────────────────────
\echo ''
\echo '[5] waive_bill — lindungi tagihan yang sudah dibayar'
do $$
declare v_lunas uuid; v_kosong uuid; v_sekolah uuid; v_siswa uuid; v_jenis uuid; v_tahun uuid;
begin
  perform uji.jadi_admin('admin_keuangan', 'aal2');
  v_sekolah := uji.sekolah();
  select id into v_siswa from students where school_id = uji.sekolah() and is_active limit 1;
  select id into v_jenis from payment_types where school_id = uji.sekolah() limit 1;
  select id into v_tahun from academic_years where is_active and school_id = uji.sekolah() limit 1;

  select id into v_lunas from bills where amount_paid > 0 and school_id = uji.sekolah() limit 1;
  perform uji.harus_gagal(format('select waive_bill(%L, %L)', v_lunas, 'coba bebaskan'),
                          'bebaskan tagihan berbayar', 'sudah');

  insert into bills (school_id, student_id, payment_type_id, academic_year_id, period, amount)
  values (v_sekolah, v_siswa, v_jenis, v_tahun, '2032-01-01', 250000) returning id into v_kosong;
  perform waive_bill(v_kosong, 'Beasiswa');
  perform uji.samakan((select status from bills where id = v_kosong), 'waived', 'pembebasan sah');
end $$;

-- ── 6. Audit log bersifat append-only ──────────────────────────────────────
\echo ''
\echo '[6] audit_logs — append-only'
do $$
begin
  perform uji.harus_gagal('update audit_logs set action = ''diubah'' where id = (select min(id) from audit_logs)',
                          'ubah audit log', 'append-only');
  perform uji.harus_gagal('delete from audit_logs where id = (select min(id) from audit_logs)',
                          'hapus audit log', 'append-only');
end $$;

-- ── 7. submit_payment: batas kepemilikan anak ──────────────────────────────
\echo ''
\echo '[7] submit_payment — wali hanya untuk anaknya'
do $$
declare v_wali uuid; v_anak_lain uuid;
begin
  perform uji.jadi_wali('+6281234567002');   -- Fatimah
  select gs.student_id into v_anak_lain
  from guardian_students gs
  join guardians g on g.id = gs.guardian_id
  where g.phone = '+6281234567001' limit 1;   -- anak Made

  perform uji.harus_gagal(
    format('select submit_payment(%L, %L, 10000, %L, ARRAY[]::uuid[])',
           gen_random_uuid(), v_anak_lain, 'x/y/z.jpg'),
    'kirim bukti untuk anak orang lain', 'bukan anak');
end $$;

-- ── 8. Deteksi bukti ganda ─────────────────────────────────────────────────
\echo ''
\echo '[8] find_duplicate_proof — bukti ganda'
do $$
declare v_sekolah uuid; v_siswa uuid; v_sha text := repeat('a', 64); v_bayar uuid;
begin
  v_sekolah := uji.sekolah();
  select id into v_siswa from students where school_id = uji.sekolah() and is_active limit 1;
  insert into payments (school_id, student_id, amount, status, method, proof_sha256)
  values (v_sekolah, v_siswa, 1000, 'pending', 'transfer', v_sha) returning id into v_bayar;

  perform uji.samakan(find_duplicate_proof(v_sekolah, v_sha) is not null, true, 'hash sama terdeteksi');
  perform uji.samakan(find_duplicate_proof(v_sekolah, v_sha, v_bayar) is null, true,
                      'rantai revisi dikecualikan');
  perform uji.samakan(find_duplicate_proof(v_sekolah, repeat('b', 64)) is null, true,
                      'hash baru tidak dianggap ganda');
end $$;

-- ── 9. Wizard naik kelas ───────────────────────────────────────────────────
\echo ''
\echo '[9] promote_students — kenaikan kelas'
do $$
declare
  v_sekolah uuid; v_dari uuid; v_ke uuid; v_kelas6 uuid; v_siswa6 uuid;
  v_hasil jsonb; v_ulang jsonb;
begin
  perform uji.jadi_admin('super_admin', 'aal2');
  v_sekolah := uji.sekolah();
  select id into v_dari from academic_years where is_active and school_id = uji.sekolah() limit 1;
  insert into academic_years (school_id, name) values (v_sekolah, '2099/2100') returning id into v_ke;

  -- siswa tingkat akhir untuk menguji kelulusan
  insert into classes (school_id, academic_year_id, grade, label)
  values (v_sekolah, v_dari, 6, '6Z') returning id into v_kelas6;
  insert into students (school_id, nis, full_name) values (v_sekolah, 'UJI6A', 'Siswa Tingkat Akhir')
  returning id into v_siswa6;
  insert into class_enrollments (student_id, class_id) values (v_siswa6, v_kelas6);

  select promote_students(v_dari, v_ke, true) into v_hasil;
  perform uji.samakan((v_hasil->>'graduated')::int >= 1, true, 'siswa tingkat 6 diluluskan');
  perform uji.samakan((select is_active from students where id = v_siswa6), false,
                      'siswa lulus dinonaktifkan');
  perform uji.samakan(exists (select 1 from classes where academic_year_id = v_ke and grade = 7),
                      false, 'tidak membuat kelas tingkat 7');

  select promote_students(v_dari, v_ke, true) into v_ulang;
  perform uji.samakan((v_ulang->>'promoted')::int, 0, 'kenaikan kelas idempotent');
end $$;

-- ── 10. Otorisasi peran ────────────────────────────────────────────────────
\echo ''
\echo '[10] Batas peran'
do $$
declare v_bayar uuid; v_sekolah uuid; v_siswa uuid;
begin
  v_sekolah := uji.sekolah();
  select id into v_siswa from students where school_id = uji.sekolah() and is_active limit 1;
  insert into payments (school_id, student_id, amount, status, method)
  values (v_sekolah, v_siswa, 1000, 'pending', 'transfer') returning id into v_bayar;

  -- operator tidak boleh memverifikasi pembayaran
  perform uji.jadi_admin('operator', 'aal2');
  perform uji.harus_gagal(
    format('select review_payment(%L, %L, %L)', v_bayar, 'rejected', 'x'),
    'operator menolak pembayaran', 'berwenang');

  -- viewer tidak boleh membuat tagihan
  perform uji.jadi_admin('viewer', 'aal2');
  perform uji.harus_gagal(
    format('select generate_bills(%L, %L)', (select id from payment_types where school_id = uji.sekolah() limit 1), '2033-01-01'),
    'viewer membuat tagihan', 'berwenang');
end $$;

-- Buang seluruh data uji; basis data kembali seperti semula.
rollback;

\echo ''
\echo '=== Semua tes logika keuangan LULUS ==='
\echo ''
