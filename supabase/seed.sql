-- ============================================================================
-- ArtaSchool Pay — seed.sql (data pengembangan lokal; dijalankan `db reset`)
-- ============================================================================

insert into schools (id, name, slug, address, bank_accounts)
values (
  '00000000-0000-0000-0000-000000000001',
  'SD Contoh Nusantara',
  'sd-contoh-nusantara',
  'Jl. Pendidikan No. 1, Denpasar',
  '[{"bank":"BCA","no_rek":"1234567890","atas_nama":"Yayasan Contoh Nusantara"}]'
);

insert into academic_years (id, school_id, name, is_active, starts_on, ends_on)
values (
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000001',
  '2026/2027', true, '2026-07-13', '2027-06-19'
);

insert into classes (id, school_id, academic_year_id, grade, label) values
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 1, '1A'),
  ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 4, '4A');

insert into students (id, school_id, nis, full_name) values
  ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000001', '2026001', 'Putu Adi Wijaya'),
  ('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000001', '2026002', 'Siti Rahma'),
  ('00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000001', '2023001', 'Kadek Ayu Lestari');

insert into class_enrollments (student_id, class_id) values
  ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000021'),
  ('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000021'),
  ('00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000022');

-- Wali tanpa auth_user_id: nomor didaftarkan admin; akun dibuat saat OTP pertama
insert into guardians (id, school_id, full_name, phone) values
  ('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000001', 'Made Wijaya', '+6281234567001'),
  ('00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000001', 'Fatimah', '+6281234567002');

insert into guardian_students (guardian_id, student_id, relation) values
  ('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000031', 'ayah'),
  ('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000033', 'ayah'),
  ('00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000032', 'ibu');

-- Kepala sekolah penerima digest harian (auth_user_id diisi saat akun dibuat)
insert into admin_users (school_id, full_name, role, phone, daily_digest)
values ('00000000-0000-0000-0000-000000000001', 'Kepala Sekolah',
        'kepala_sekolah', '+6281234567090', true);

insert into payment_types (id, school_id, name, default_amount, is_recurring) values
  ('00000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000001', 'SPP', 350000, true),
  ('00000000-0000-0000-0000-000000000052', '00000000-0000-0000-0000-000000000001', 'Daftar Ulang', 500000, false);

-- Tagihan SPP Juli 2026 untuk semua siswa (contoh hasil generate_bills)
insert into bills (school_id, student_id, payment_type_id, academic_year_id, period, amount, due_date)
select '00000000-0000-0000-0000-000000000001', s.id,
       '00000000-0000-0000-0000-000000000051',
       '00000000-0000-0000-0000-000000000011',
       '2026-07-01', 350000, '2026-07-10'
from students s;
