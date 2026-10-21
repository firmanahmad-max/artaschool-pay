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

-- ── 11. Hapus akun wali (UU PDP §8) ────────────────────────────────────────
-- Data pribadi harus hilang, catatan keuangan harus TETAP (retensi 7 tahun).
\echo ''
\echo '[11] delete_my_guardian_account — erasure vs retensi pembukuan'
do $$
declare
  v_sekolah uuid; v_siswa uuid; v_gid uuid; v_uid uuid; v_bayar uuid; v_job bigint;
begin
  v_sekolah := uji.sekolah();
  select id into v_siswa from students where school_id = v_sekolah and is_active limit 1;

  -- Wali uji dengan data pribadi lengkap + keterkaitan + jejak.
  insert into guardians (school_id, full_name, phone, email)
  values (v_sekolah, 'Wali Uji Hapus', '+6281100000099', 'wali.hapus@contoh.id')
  returning id into v_gid;
  insert into guardian_students (guardian_id, student_id) values (v_gid, v_siswa);
  insert into payments (school_id, student_id, amount, status, method, submitted_by)
  values (v_sekolah, v_siswa, 250000, 'approved', 'transfer', v_gid) returning id into v_bayar;
  insert into notification_jobs (school_id, recipient_guardian_id, recipient_phone, template, body)
  values (v_sekolah, v_gid, '+6281100000099', 'payment.approved', 'uji') returning id into v_job;

  v_uid := uji.jadi_wali('+6281100000099');   -- masuk sebagai wali tsb

  perform delete_my_guardian_account();

  -- Data pribadi terhapus, baris tetap ada (FK payments utuh).
  perform uji.samakan((select full_name from guardians where id = v_gid), 'Akun Dihapus',
                      'nama dianonimkan');
  perform uji.samakan((select email from guardians where id = v_gid) is null, true,
                      'email dihapus');
  perform uji.samakan((select auth_user_id from guardians where id = v_gid) is null, true,
                      'tautan login dilepas');
  perform uji.samakan((select phone from guardians where id = v_gid) like 'deleted:%', true,
                      'nomor HP di-tombstone');
  perform uji.samakan((select deleted_at from guardians where id = v_gid) is not null, true,
                      'ditandai deleted_at');

  -- Catatan keuangan DIPERTAHANKAN (pembukuan 7 tahun).
  perform uji.samakan(exists (select 1 from payments where id = v_bayar and submitted_by = v_gid),
                      true, 'pembayaran tetap tersimpan & tertaut');

  -- Jejak operasional & keterkaitan dibersihkan.
  perform uji.samakan(exists (select 1 from guardian_students where guardian_id = v_gid),
                      false, 'keterkaitan anak dilepas');
  perform uji.samakan(exists (select 1 from notification_jobs where id = v_job),
                      false, 'notifikasi tertunda dibatalkan');

  -- Identitas login benar-benar dihapus (auth.users menyimpan nomor asli).
  perform uji.samakan(exists (select 1 from auth.users where id = v_uid),
                      false, 'identitas auth dihapus');

  -- Jejak audit tercatat tanpa data pribadi.
  perform uji.samakan(exists (select 1 from audit_logs
                               where entity_id = v_gid and action = 'guardian.account_deleted'),
                      true, 'audit penghapusan tercatat');

  -- Tidak bisa dijalankan ulang (sudah bukan wali aktif).
  perform uji.harus_gagal('select delete_my_guardian_account()',
                          'hapus ulang ditolak', 'wali aktif');

  -- Admin (bukan wali) tidak bisa memakai RPC ini.
  perform uji.jadi_admin('operator', 'aal2');
  perform uji.harus_gagal('select delete_my_guardian_account()',
                          'admin tak bisa hapus akun wali', 'wali aktif');
end $$;

-- ── 12. Ekspor data wali (UU PDP — hak akses & isolasi) ────────────────────
\echo ''
\echo '[12] export_my_guardian_data — hak akses & isolasi antar-wali'
do $$
declare
  v_sekolah uuid; v_s1 uuid; v_s2 uuid; v_ga uuid; v_gb uuid; v_ua uuid; v_json jsonb;
begin
  v_sekolah := uji.sekolah();

  insert into students (school_id, nis, full_name)
  values (v_sekolah, 'UJIEXP1', 'Anak Wali A') returning id into v_s1;
  insert into students (school_id, nis, full_name)
  values (v_sekolah, 'UJIEXP2', 'Anak Wali B') returning id into v_s2;

  -- Wali A (subjek ekspor)
  insert into guardians (school_id, full_name, phone, email)
  values (v_sekolah, 'Wali A Ekspor', '+6281100000101', 'a@contoh.id') returning id into v_ga;
  insert into guardian_students (guardian_id, student_id) values (v_ga, v_s1);
  insert into payments (school_id, student_id, amount, status, method, submitted_by, sender_name)
  values (v_sekolah, v_s1, 111000, 'approved', 'transfer', v_ga, 'PENGIRIM_A_UNIK');

  -- Wali B (tetangga se-sekolah — datanya TIDAK boleh ikut terekspor)
  insert into guardians (school_id, full_name, phone, email)
  values (v_sekolah, 'Wali B Ekspor', '+6281100000102', 'b@contoh.id') returning id into v_gb;
  insert into guardian_students (guardian_id, student_id) values (v_gb, v_s2);
  insert into payments (school_id, student_id, amount, status, method, submitted_by, sender_name)
  values (v_sekolah, v_s2, 222000, 'approved', 'transfer', v_gb, 'PENGIRIM_B_UNIK');

  v_ua := uji.jadi_wali('+6281100000101');   -- masuk sebagai Wali A
  select export_my_guardian_data() into v_json;

  perform uji.samakan(v_json->'wali'->>'nama', 'Wali A Ekspor', 'profil wali sendiri termuat');
  perform uji.samakan(jsonb_array_length(v_json->'pembayaran'), 1, 'hanya pembayaran sendiri');
  perform uji.samakan(v_json->'pembayaran'->0->>'nama_pengirim', 'PENGIRIM_A_UNIK',
                      'pembayaran sendiri termuat');
  perform uji.samakan(position('PENGIRIM_B_UNIK' in v_json::text), 0,
                      'data wali lain TIDAK bocor');
  perform uji.samakan(jsonb_array_length(v_json->'anak'), 1, 'anak sendiri termuat');
  perform uji.samakan(v_json->'anak'->0->>'nis', 'UJIEXP1', 'nis anak benar');
  perform uji.samakan(exists (select 1 from audit_logs
                              where entity_id = v_ga and action = 'guardian.data_exported'),
                      true, 'audit akses tercatat');

  -- Admin (bukan wali) tidak bisa memakai RPC ini.
  perform uji.jadi_admin('operator', 'aal2');
  perform uji.harus_gagal('select export_my_guardian_data()',
                          'admin tak bisa ekspor data wali', 'wali aktif');
end $$;

-- ── 13. Koreksi profil wali (UU PDP — hak koreksi) ─────────────────────────
\echo ''
\echo '[13] update_my_guardian_profile — hak koreksi & batas kolom'
do $$
declare v_sekolah uuid; v_gid uuid; v_uid uuid;
begin
  v_sekolah := uji.sekolah();
  insert into guardians (school_id, full_name, phone, email)
  values (v_sekolah, 'Nama Lama', '+6281100000201', 'lama@contoh.id') returning id into v_gid;

  v_uid := uji.jadi_wali('+6281100000201');

  perform update_my_guardian_profile('Nama Baru', 'baru@contoh.id');
  perform uji.samakan((select full_name from guardians where id = v_gid), 'Nama Baru',
                      'nama diperbarui');
  perform uji.samakan((select email from guardians where id = v_gid), 'baru@contoh.id',
                      'email diperbarui');
  -- Nomor HP (kunci login) TIDAK boleh berubah lewat RPC ini.
  perform uji.samakan((select phone from guardians where id = v_gid), '+6281100000201',
                      'nomor HP tetap');

  -- Email boleh dikosongkan.
  perform update_my_guardian_profile('Nama Baru', '');
  perform uji.samakan((select email from guardians where id = v_gid) is null, true,
                      'email bisa dikosongkan');

  -- Validasi masukan.
  perform uji.harus_gagal('select update_my_guardian_profile('''', ''x@y.z'')',
                          'nama kosong ditolak', 'Nama wajib');
  perform uji.harus_gagal('select update_my_guardian_profile(''X'', ''bukan-email'')',
                          'email tak valid ditolak', 'Email tidak valid');

  perform uji.samakan(exists (select 1 from audit_logs
                              where entity_id = v_gid and action = 'guardian.profile_updated'),
                      true, 'audit koreksi tercatat');

  -- Admin (bukan wali) tidak bisa memakai RPC ini.
  perform uji.jadi_admin('operator', 'aal2');
  perform uji.harus_gagal('select update_my_guardian_profile(''Z'', '''')',
                          'admin tak bisa ubah profil wali', 'wali aktif');
end $$;

-- ── 14. RPC internal tertutup untuk publik ─────────────────────────────────
-- Fungsi SECURITY DEFINER tanpa cek otorisasi di badannya HANYA boleh
-- dipanggil internal / service_role. Dicek per nama (semua overload) agar tetap
-- berlaku walau signature berubah.
\echo ''
\echo '[14] RPC internal tak bisa dieksekusi anon/authenticated'
do $$
declare v_fn record; v_bocor text := '';
begin
  for v_fn in
    select p.oid, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('enqueue_notification', 'enqueue_notification_phone',
                        'claim_notification_jobs', 'complete_notification_job',
                        'find_duplicate_proof', 'recompute_bill_amount_paid',
                        'verify_activation_code', 'complete_guardian_activation',
                        'auth_user_id_by_phone', 'catat_statistik_perangkat')
  loop
    if has_function_privilege('anon', v_fn.oid, 'execute')
       or has_function_privilege('authenticated', v_fn.oid, 'execute') then
      v_bocor := v_bocor || v_fn.proname || ' ';
    end if;
  end loop;
  perform uji.samakan(v_bocor, '', 'tak ada RPC internal yang terbuka');
end $$;

-- ── 15. Kode aktivasi + PIN (login tanpa gateway) ──────────────────────────
\echo ''
\echo '[15] Kode aktivasi: format, percobaan, kedaluwarsa, sekali pakai, wewenang'
do $$
declare
  v_sekolah uuid := uji.sekolah();
  v_gid uuid; v_uid uuid; v_kode text; v_kode2 text; i int;
begin
  insert into guardians (school_id, full_name, phone)
  values (v_sekolah, 'Wali Aktivasi', '+6281100000301') returning id into v_gid;

  perform uji.jadi_admin('operator', 'aal2');
  v_kode := issue_activation_code(v_gid);
  perform uji.samakan(v_kode ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$', true,
                      'kode 8 karakter dari alfabet aman');
  perform uji.samakan(
    (select code_hash <> v_kode from guardian_activation_codes
     where guardian_id = v_gid and revoked_at is null), true,
    'kode tersimpan sbg hash, bukan plaintext');
  perform uji.samakan(
    exists (select 1 from audit_logs where entity_id = v_gid
            and action = 'guardian.activation_issued'
            and coalesce(after::text, '') not like '%' || v_kode || '%'),
    true, 'audit penerbitan tanpa plaintext');

  -- Kode salah dicatat (tidak ter-rollback)
  perform uji.samakan(verify_activation_code('+6281100000301', 'ZZZZZZZZ') is null, true,
                      'kode salah → ditolak');
  perform uji.samakan((select attempts from guardian_activation_codes
                       where guardian_id = v_gid and revoked_at is null), 1,
                      'percobaan salah tercatat');

  -- Kode benar, toleran huruf kecil + tanda hubung
  perform uji.samakan(
    verify_activation_code('6281100000301',
      lower(substr(v_kode, 1, 4)) || '-' || lower(substr(v_kode, 5))),
    v_gid, 'kode benar (huruf kecil, ber-strip, tanpa +) → wali');

  -- Terbitkan ulang → kode lama mati
  v_kode2 := issue_activation_code(v_gid);
  perform uji.samakan(verify_activation_code('+6281100000301', v_kode) is null, true,
                      'kode lama dicabut saat diterbitkan ulang');

  -- 5 kali salah → kode dikunci, kode benar pun ditolak
  for i in 1 .. 5 loop
    perform verify_activation_code('+6281100000301', 'ZZZZZZZZ');
  end loop;
  perform uji.samakan(verify_activation_code('+6281100000301', v_kode2) is null, true,
                      '5x salah → kode terkunci');

  -- Kedaluwarsa
  v_kode := issue_activation_code(v_gid);
  update guardian_activation_codes set expires_at = now() - interval '1 minute'
  where guardian_id = v_gid and revoked_at is null and used_at is null;
  perform uji.samakan(verify_activation_code('+6281100000301', v_kode) is null, true,
                      'kode kedaluwarsa → ditolak');

  -- Sekali pakai + penautan akun
  v_kode := issue_activation_code(v_gid);
  v_uid := gen_random_uuid();
  insert into auth.users (id, phone) values (v_uid, '6281100000301');
  perform uji.samakan(auth_user_id_by_phone('+6281100000301'), v_uid,
                      'akun auth lama ditemukan lewat nomor');
  perform complete_guardian_activation(v_gid, v_uid);
  perform uji.samakan((select auth_user_id from guardians where id = v_gid), v_uid,
                      'akun tertaut ke wali');
  perform uji.samakan(verify_activation_code('+6281100000301', v_kode) is null, true,
                      'kode yg sudah dipakai → ditolak');
  perform uji.samakan(
    exists (select 1 from audit_logs where entity_id = v_gid and action = 'guardian.activated'),
    true, 'audit aktivasi tercatat');

  -- PIN terdeteksi
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_uid::text)::text, false);
  perform uji.samakan(my_pin_is_set(), false, 'belum ada PIN → false');
  update auth.users set encrypted_password = '$2a$10$hash' where id = v_uid;
  perform uji.samakan(my_pin_is_set(), true, 'PIN tersetel → true');

  -- Audit dari sisi wali: hanya aksi dalam daftar
  perform uji.jadi_wali('+6281100000301');
  perform log_guardian_event('guardian.pin_changed');
  perform uji.samakan(
    exists (select 1 from audit_logs where entity_id = v_gid and action = 'guardian.pin_changed'),
    true, 'wali mencatat ubah PIN');
  perform uji.harus_gagal('select log_guardian_event(''payment.approved'')',
                          'wali tak bisa memalsukan aksi audit lain', 'tidak dikenal');

  -- Wewenang
  perform uji.jadi_admin('admin_keuangan', 'aal1');
  perform uji.harus_gagal(format('select issue_activation_code(%L)', v_gid),
                          'admin keuangan tanpa 2FA ditolak', '2FA');
  perform uji.jadi_admin('viewer', 'aal2');
  perform uji.harus_gagal(format('select issue_activation_code(%L)', v_gid),
                          'viewer ditolak', 'berwenang');
  perform uji.jadi_wali('+6281100000301');
  perform uji.harus_gagal(format('select issue_activation_code(%L)', v_gid),
                          'wali tak bisa menerbitkan kode', 'berwenang');

  -- Wali terhapus (UU PDP) tak bisa diaktifkan lagi
  perform uji.jadi_admin('operator', 'aal2');
  update guardians set deleted_at = now() where id = v_gid;
  perform uji.harus_gagal(format('select issue_activation_code(%L)', v_gid),
                          'wali terhapus ditolak', 'tidak ditemukan');
end $$;

-- ── 16. Kotak Keluar WA (mode manual) ──────────────────────────────────────
\echo ''
\echo '[16] Kotak Keluar WA: klaim per kanal, tandai/lewati, wewenang, isolasi'
do $$
declare
  v_sekolah uuid := uji.sekolah();
  v_lain uuid; v_wa bigint; v_wa2 bigint; v_push bigint; v_asing bigint; v_n int;
begin
  insert into notification_jobs (school_id, channel, recipient_phone, template, body)
  values (v_sekolah, 'wa', '+6281100000401', 'uji', 'pesan wa 1') returning id into v_wa;
  insert into notification_jobs (school_id, channel, recipient_phone, template, body)
  values (v_sekolah, 'wa', '+6281100000402', 'uji', 'pesan wa 2') returning id into v_wa2;
  insert into notification_jobs (school_id, channel, recipient_phone, template, body)
  values (v_sekolah, 'push', '+6281100000401', 'uji', 'pesan push') returning id into v_push;

  -- Mode manual: worker hanya mengklaim 'push'; WA tetap menunggu admin.
  select count(*) into v_n from claim_notification_jobs(50, array['push'])
  where id in (v_wa, v_wa2, v_push);
  perform uji.samakan(v_n, 1, 'klaim kanal push saja → 1 job');
  perform uji.samakan((select status from notification_jobs where id = v_wa), 'queued',
                      'job WA tidak diklaim worker mode manual');

  perform uji.jadi_admin('operator', 'aal2');
  perform mark_notification_sent_manually(v_wa);
  perform uji.samakan((select status from notification_jobs where id = v_wa), 'sent',
                      'ditandai terkirim manual');
  perform uji.samakan((select manual_sender is not null and sent_at is not null
                       from notification_jobs where id = v_wa), true,
                      'pengirim manual & waktu tercatat');
  perform uji.harus_gagal(format('select mark_notification_sent_manually(%s)', v_wa),
                          'tandai dua kali ditolak', 'sudah diproses');

  perform skip_notification(v_wa2);
  perform uji.samakan((select status from notification_jobs where id = v_wa2), 'skipped',
                      'dilewati → skipped (beda dari dead)');

  perform uji.harus_gagal(format('select mark_notification_sent_manually(%s)', v_push),
                          'job push tak bisa ditandai manual', 'tidak ditemukan');

  -- Isolasi sekolah
  insert into schools (name, slug) values ('Sekolah Lain', 'uji-sekolah-lain')
  returning id into v_lain;
  insert into notification_jobs (school_id, channel, recipient_phone, template, body)
  values (v_lain, 'wa', '+6281100000499', 'uji', 'milik sekolah lain') returning id into v_asing;
  perform uji.harus_gagal(format('select mark_notification_sent_manually(%s)', v_asing),
                          'admin tak bisa menyentuh pesan sekolah lain', 'tidak ditemukan');
  perform uji.samakan((select status from notification_jobs where id = v_asing), 'queued',
                      'pesan sekolah lain tetap utuh');

  -- Wewenang
  perform uji.jadi_admin('viewer', 'aal2');
  perform uji.harus_gagal(format('select skip_notification(%s)', v_asing),
                          'viewer tak bisa mengelola Kotak Keluar', 'berwenang');
  perform uji.jadi_wali('+6281234567001');
  perform uji.harus_gagal(format('select mark_notification_sent_manually(%s)', v_asing),
                          'wali tak bisa mengelola Kotak Keluar', 'berwenang');
end $$;

-- ── 17. Web Push: langganan, fan-out antrean, isolasi, hapus akun ──────────
\echo ''
\echo '[17] Web Push: langganan wali, job push, isolasi, hapus akun'
do $$
declare
  v_sekolah uuid := uji.sekolah();
  v_made uuid; v_fatimah uuid; v_gx uuid; v_n int;
  v_ep constant text := 'https://fcm.googleapis.com/fcm/send/uji-perangkat-keluarga';
begin
  select id into v_made from guardians where phone = '+6281234567001';
  select id into v_fatimah from guardians where phone = '+6281234567002';

  perform uji.jadi_wali('+6281234567001');
  perform save_push_subscription(v_ep, 'kunci-p256dh', 'kunci-auth', 'UjiBrowser');
  perform uji.samakan((select guardian_id from push_subscriptions where endpoint = v_ep), v_made,
                      'langganan tersimpan milik wali pemanggil');
  perform uji.harus_gagal(
    'select save_push_subscription(''http://tidak-aman.contoh/x'', ''a'', ''b'')',
    'endpoint non-HTTPS ditolak', 'tidak valid');

  -- Perangkat sama dipakai wali lain → berpindah, tidak ganda
  perform uji.jadi_wali('+6281234567002');
  perform save_push_subscription(v_ep, 'kunci-p256dh-2', 'kunci-auth-2', 'UjiBrowser');
  perform uji.samakan((select count(*)::int from push_subscriptions where endpoint = v_ep), 1,
                      'endpoint tetap satu baris');
  perform uji.samakan((select guardian_id from push_subscriptions where endpoint = v_ep), v_fatimah,
                      'endpoint berpindah ke wali yang sedang masuk');

  -- Fan-out: wali berperangkat → job wa + push; tanpa perangkat → wa saja
  perform enqueue_notification(v_sekolah, v_fatimah, 'uji.push', 'halo fatimah', '{}');
  select count(*) into v_n from notification_jobs where template = 'uji.push'
    and recipient_guardian_id = v_fatimah;
  perform uji.samakan(v_n, 2, 'wali berperangkat: job wa + push');
  perform uji.samakan(exists (select 1 from notification_jobs where template = 'uji.push'
                              and recipient_guardian_id = v_fatimah and channel = 'push'),
                      true, 'job kanal push dibuat');
  perform enqueue_notification(v_sekolah, v_made, 'uji.push', 'halo made', '{}');
  select count(*) into v_n from notification_jobs where template = 'uji.push'
    and recipient_guardian_id = v_made;
  perform uji.samakan(v_n, 1, 'wali tanpa perangkat: wa saja');

  -- Petunjuk Kotak Keluar: hanya perangkat yang terbukti menerima push
  perform uji.jadi_admin('operator', 'aal2');
  perform uji.samakan(v_fatimah in (select outbox_guardians_with_push()), false,
                      'baru terdaftar (belum pernah sampai) → tidak dianggap menerima');
  update push_subscriptions set last_success_at = now() where endpoint = v_ep;
  perform uji.samakan(v_fatimah in (select outbox_guardians_with_push()), true,
                      'pernah berhasil ≤30 hari → admin melihat petunjuk');
  update push_subscriptions set last_success_at = now() - interval '31 days' where endpoint = v_ep;
  perform uji.samakan(v_fatimah in (select outbox_guardians_with_push()), false,
                      'sukses terakhir >30 hari → petunjuk hilang');
  update push_subscriptions set last_success_at = now() where endpoint = v_ep;
  perform uji.jadi_admin('viewer', 'aal2');
  perform uji.samakan((select count(*)::int from outbox_guardians_with_push()), 0,
                      'viewer tidak mendapat daftar');

  -- Wali lain tak bisa mencabut perangkat orang
  perform uji.jadi_wali('+6281234567001');
  perform delete_push_subscription(v_ep);
  perform uji.samakan(exists (select 1 from push_subscriptions where endpoint = v_ep), true,
                      'wali lain tak bisa mencabut perangkat');
  perform uji.jadi_wali('+6281234567002');
  perform delete_push_subscription(v_ep);
  perform uji.samakan(exists (select 1 from push_subscriptions where endpoint = v_ep), false,
                      'pemilik mencabut perangkatnya');

  -- Hapus akun (UU PDP) ikut menghapus perangkat
  insert into guardians (school_id, full_name, phone)
  values (v_sekolah, 'Wali Push Hapus', '+6281100000501') returning id into v_gx;
  perform uji.jadi_wali('+6281100000501');
  perform save_push_subscription('https://push.contoh/hapus', 'p', 'a');
  perform delete_my_guardian_account();
  perform uji.samakan(exists (select 1 from push_subscriptions where guardian_id = v_gx), false,
                      'hapus akun menghapus perangkat push');
end $$;

-- ── 18. Statistik perangkat anonim ─────────────────────────────────────────
\echo ''
\echo '[18] Statistik perangkat: agregat, daftar tertutup, hanya admin membaca'
do $$
declare v_n int;
begin
  perform catat_statistik_perangkat('wali', 'safari', 15, 'ios', 15, false);
  perform catat_statistik_perangkat('wali', 'safari', 15, 'ios', 15, false);
  perform catat_statistik_perangkat('wali', 'chrome', 129, 'android', 13, true);

  select count(*) into v_n from statistik_perangkat;
  perform uji.samakan(v_n, 2, 'kunjungan berulang → penghitung, bukan baris baru');
  perform uji.samakan((select jumlah from statistik_perangkat where browser = 'safari'), 2,
                      'penghitung bertambah');

  perform uji.harus_gagal(
    'select catat_statistik_perangkat(''wali'', ''Mozilla/5.0 (iPhone) bocor'', 1, ''ios'', 1, false)',
    'string bebas (mis. UA utuh) ditolak', 'check');
  perform uji.harus_gagal(
    'select catat_statistik_perangkat(''wali'', ''chrome'', 100000, ''android'', 1, true)',
    'versi absurd ditolak', 'check');
  perform uji.samakan(
    (select count(*)::int from information_schema.columns
     where table_name = 'statistik_perangkat'
       and column_name ~ '(ua|agent|ip|user|guardian|session|path|url)'),
    0, 'tak ada kolom identitas/UA/IP/halaman');

  perform uji.jadi_admin('viewer', 'aal2');
  perform uji.samakan((select count(*)::int from ringkasan_statistik_perangkat(30)), 2,
                      'admin membaca ringkasan');
  perform uji.jadi_wali('+6281234567001');
  perform uji.harus_gagal('select * from ringkasan_statistik_perangkat(30)',
                          'wali tak bisa membaca ringkasan', 'admin');
end $$;

-- Buang seluruh data uji; basis data kembali seperti semula.
rollback;

\echo ''
\echo '=== Semua tes logika keuangan LULUS ==='
\echo ''
