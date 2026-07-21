-- ============================================================================
-- ArtaSchool Pay — 001_init_schema.sql
-- Direkonstruksi dari PRD v1.0 §4 (model data), §5 (state machine),
-- §6 (keamanan/RLS). Target: PostgreSQL 16 / Supabase.
-- Jalankan via: npx supabase db reset   (migrations/ + supabase/seed.sql)
-- ============================================================================

-- §1 ─── Helper functions (dipakai RLS; security definer agar tidak rekursif)
-- ----------------------------------------------------------------------------

-- Fungsi §1 mereferensikan tabel yang baru dibuat di §2 — tunda validasi body
set check_function_bodies = off;

create or replace function public.current_admin_school_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select school_id from admin_users
  where auth_user_id = auth.uid() and is_active;
$$;

create or replace function public.current_admin_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select role from admin_users
  where auth_user_id = auth.uid() and is_active;
$$;

create or replace function public.current_guardian_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select id from guardians where auth_user_id = auth.uid();
$$;

create or replace function public.current_guardian_school_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select school_id from guardians where auth_user_id = auth.uid();
$$;

-- Anak-anak milik wali yang sedang login
create or replace function public.current_guardian_student_ids()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select gs.student_id
  from guardian_students gs
  join guardians g on g.id = gs.guardian_id
  where g.auth_user_id = auth.uid();
$$;

-- §2 ─── Tabel (semua ber-school_id: multi-tenant by schema — PRD §3.1)
-- ----------------------------------------------------------------------------

create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  logo_url text,
  address text,
  bank_accounts jsonb default '[]',   -- [{bank, no_rek, atas_nama}]
  qris_url text,
  settings jsonb default '{}',
  created_at timestamptz default now()
);

create table academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  name text not null,                  -- "2026/2027"
  is_active boolean default false,
  starts_on date,
  ends_on date,
  unique(school_id, name)
);

create table classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  academic_year_id uuid not null references academic_years(id),
  grade smallint not null,             -- 1..6
  label text not null,                 -- "4A"
  unique(academic_year_id, label)
);

create table students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  nis text not null,
  full_name text not null,
  is_active boolean default true,
  unique(school_id, nis)
);

create table class_enrollments (       -- siswa bisa naik kelas antar tahun ajaran
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id),
  class_id uuid not null references classes(id),
  unique(student_id, class_id)
);

create table guardians (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  auth_user_id uuid unique references auth.users(id),
  full_name text not null,
  phone text not null,                 -- kunci login OTP WhatsApp
  email text,
  unique(school_id, phone)
);

create table guardian_students (       -- many-to-many
  guardian_id uuid references guardians(id),
  student_id uuid references students(id),
  relation text default 'wali',        -- ayah/ibu/wali
  primary key (guardian_id, student_id)
);

create table payment_types (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  name text not null,                  -- SPP, Daftar Ulang, Buku Paket
  default_amount numeric(12,0),
  is_recurring boolean default false,  -- SPP = true (bulanan)
  is_active boolean default true
);

create table admin_users (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  auth_user_id uuid unique references auth.users(id),
  full_name text not null,
  role text not null
    check (role in ('super_admin','admin_keuangan','operator','kepala_sekolah','viewer')),
  is_active boolean default true
);

-- ===== INTI SISTEM: TAGIHAN =====
create table bills (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  student_id uuid not null references students(id),
  payment_type_id uuid not null references payment_types(id),
  academic_year_id uuid not null references academic_years(id),
  period date,                         -- 2026-03-01 utk "SPP Maret 2026"; null utk non-recurring
  amount numeric(12,0) not null check (amount >= 0),
  amount_paid numeric(12,0) not null default 0, -- di-update trigger dari allocations
  status text not null default 'unpaid'
    check (status in ('unpaid','partial','paid','waived','cancelled')),
  due_date date,
  created_at timestamptz default now(),
  -- nulls not distinct (PG15+): non-recurring (period null) juga idempotent
  unique nulls not distinct (student_id, payment_type_id, period)
);

-- ===== PEMBAYARAN (bukti transfer) =====
create table payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  student_id uuid not null references students(id),
  submitted_by uuid references guardians(id),      -- null jika input manual admin
  method text not null default 'transfer'
    check (method in ('transfer','cash','qris')),
  amount numeric(12,0) not null check (amount > 0),
  bank_name text,
  sender_name text,
  transferred_at timestamptz,
  proof_path text,                     -- path di bucket privat (lihat §7)
  proof_sha256 text,                   -- fondasi deteksi bukti ganda (v2, PRD §6.3)
  status text not null default 'pending'
    check (status in ('draft','pending','approved','rejected','needs_revision')),
  reviewed_by uuid references admin_users(id),
  reviewed_at timestamptz,
  review_note text,                    -- wajib jika rejected/needs_revision (enforced di RPC)
  revision_of uuid references payments(id),  -- rantai revisi
  created_at timestamptz default now()
);

create table payment_allocations (     -- 1 bukti transfer bisa melunasi >1 tagihan (K4)
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id),
  bill_id uuid not null references bills(id),
  amount numeric(12,0) not null check (amount > 0),
  unique(payment_id, bill_id)
);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  title text not null,
  body text,
  image_url text,
  attachment_url text,
  audience jsonb default '{"scope":"all"}',  -- {"scope":"class","class_ids":[...]}
  publish_at timestamptz,
  expires_at timestamptz,
  created_by uuid references admin_users(id),
  created_at timestamptz default now()
);

create table audit_logs (              -- APPEND-ONLY: tidak ada update/delete
  id bigint generated always as identity primary key,
  school_id uuid not null,
  actor_id uuid,
  actor_role text,
  action text not null,                -- 'payment.approved', 'student.deactivated'
  entity text,
  entity_id uuid,
  before jsonb,
  after jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz default now()
);

-- §3 ─── Index penunjang query utama
-- ----------------------------------------------------------------------------

create index idx_bills_student on bills(student_id);
create index idx_bills_school_status on bills(school_id, status);
create index idx_payments_school_status on payments(school_id, status);
create index idx_payments_student on payments(student_id);
create index idx_payment_allocations_bill on payment_allocations(bill_id);
create index idx_payment_allocations_payment on payment_allocations(payment_id);
create index idx_audit_logs_school_created on audit_logs(school_id, created_at desc);
create index idx_class_enrollments_class on class_enrollments(class_id);

-- §4 ─── Trigger sinkronisasi bills.amount_paid
--        (hanya alokasi dari payment approved; laporan tunggakan = query murah)
-- ----------------------------------------------------------------------------

create or replace function public.recompute_bill_amount_paid(p_bill_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  update bills b
  set amount_paid = coalesce((
        select sum(pa.amount)
        from payment_allocations pa
        join payments p on p.id = pa.payment_id
        where pa.bill_id = b.id and p.status = 'approved'
      ), 0),
      status = case
        when b.status in ('waived','cancelled') then b.status
        when coalesce((
          select sum(pa.amount)
          from payment_allocations pa
          join payments p on p.id = pa.payment_id
          where pa.bill_id = b.id and p.status = 'approved'
        ), 0) >= b.amount then 'paid'
        when coalesce((
          select sum(pa.amount)
          from payment_allocations pa
          join payments p on p.id = pa.payment_id
          where pa.bill_id = b.id and p.status = 'approved'
        ), 0) > 0 then 'partial'
        else 'unpaid'
      end
  where b.id = p_bill_id;
end;
$$;

create or replace function public.trg_sync_bill_amount_paid()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT','UPDATE') then
    perform recompute_bill_amount_paid(new.bill_id);
  end if;
  if tg_op in ('UPDATE','DELETE') then
    perform recompute_bill_amount_paid(old.bill_id);
  end if;
  return coalesce(new, old);
end;
$$;

create trigger sync_bill_amount_paid
after insert or update or delete on payment_allocations
for each row execute function public.trg_sync_bill_amount_paid();

-- Perubahan status payment (approve / batalkan persetujuan) juga wajib
-- menghitung ulang semua tagihan yang teralokasi ke payment tsb.
create or replace function public.trg_sync_bills_on_payment_status()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform recompute_bill_amount_paid(pa.bill_id)
    from payment_allocations pa
    where pa.payment_id = new.id;
  end if;
  return new;
end;
$$;

create trigger sync_bills_on_payment_status
after update of status on payments
for each row execute function public.trg_sync_bills_on_payment_status();

-- Audit log append-only: blok update/delete di level database
create or replace function public.trg_audit_logs_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_logs bersifat append-only';
end;
$$;

create trigger audit_logs_immutable
before update or delete on audit_logs
for each row execute function public.trg_audit_logs_immutable();

-- §5 ─── RPC: satu-satunya jalur mutasi status pembayaran (CONTEXT Konvensi #1)
-- ----------------------------------------------------------------------------

-- Generate tagihan massal utk semua siswa aktif; idempotent berkat unique
create or replace function public.generate_bills(
  p_payment_type_id uuid,
  p_period date default null,
  p_due_date date default null
)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_school_id uuid := current_admin_school_id();
  v_role text := current_admin_role();
  v_type payment_types;
  v_year_id uuid;
  v_count integer;
begin
  if v_role is null or v_role not in ('super_admin','admin_keuangan') then
    raise exception 'Tidak berwenang membuat tagihan';
  end if;

  select * into v_type from payment_types
  where id = p_payment_type_id and school_id = v_school_id and is_active;
  if not found then
    raise exception 'Jenis pembayaran tidak ditemukan';
  end if;

  select id into v_year_id from academic_years
  where school_id = v_school_id and is_active
  limit 1;
  if v_year_id is null then
    raise exception 'Tidak ada tahun ajaran aktif';
  end if;

  insert into bills (school_id, student_id, payment_type_id, academic_year_id,
                     period, amount, due_date)
  select v_school_id, s.id, v_type.id, v_year_id,
         p_period, coalesce(v_type.default_amount, 0), p_due_date
  from students s
  where s.school_id = v_school_id and s.is_active
  on conflict (student_id, payment_type_id, period) do nothing;

  get diagnostics v_count = row_count;

  insert into audit_logs (school_id, actor_id, actor_role, action, entity, entity_id, after)
  values (v_school_id, auth.uid(), v_role, 'bills.generated', 'payment_type', v_type.id,
          jsonb_build_object('period', p_period, 'created', v_count));

  return v_count;
end;
$$;

-- Terima pembayaran + eksekusi alokasi (state machine PRD §5)
-- p_allocations: [{"bill_id": "...", "amount": 150000}, ...]
create or replace function public.approve_payment(
  p_payment_id uuid,
  p_allocations jsonb
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_school_id uuid := current_admin_school_id();
  v_role text := current_admin_role();
  v_admin_id uuid;
  v_payment payments;
  v_alloc record;
  v_total numeric(12,0) := 0;
  v_bill bills;
begin
  if v_role is null or v_role not in ('super_admin','admin_keuangan') then
    raise exception 'Tidak berwenang memverifikasi pembayaran';
  end if;

  select id into v_admin_id from admin_users
  where auth_user_id = auth.uid() and is_active;

  select * into v_payment from payments
  where id = p_payment_id and school_id = v_school_id
  for update;
  if not found then
    raise exception 'Pembayaran tidak ditemukan';
  end if;
  if v_payment.status <> 'pending' then
    raise exception 'Hanya pembayaran berstatus pending yang bisa disetujui (status saat ini: %)', v_payment.status;
  end if;

  if p_allocations is null or jsonb_typeof(p_allocations) <> 'array'
     or jsonb_array_length(p_allocations) = 0 then
    raise exception 'Alokasi wajib diisi';
  end if;

  for v_alloc in
    select (e->>'bill_id')::uuid as bill_id, (e->>'amount')::numeric(12,0) as amount
    from jsonb_array_elements(p_allocations) e
  loop
    if v_alloc.amount is null or v_alloc.amount <= 0 then
      raise exception 'Nominal alokasi harus lebih dari 0';
    end if;

    select * into v_bill from bills
    where id = v_alloc.bill_id and school_id = v_school_id
      and student_id = v_payment.student_id
    for update;
    if not found then
      raise exception 'Tagihan % tidak valid untuk siswa ini', v_alloc.bill_id;
    end if;
    if v_bill.status in ('waived','cancelled') then
      raise exception 'Tagihan % berstatus % — tidak bisa dialokasikan', v_alloc.bill_id, v_bill.status;
    end if;

    insert into payment_allocations (payment_id, bill_id, amount)
    values (p_payment_id, v_alloc.bill_id, v_alloc.amount);

    v_total := v_total + v_alloc.amount;
  end loop;

  if v_total <> v_payment.amount then
    raise exception 'Total alokasi (%) harus sama dengan nominal pembayaran (%)', v_total, v_payment.amount;
  end if;

  update payments
  set status = 'approved',
      reviewed_by = v_admin_id,
      reviewed_at = now()
  where id = p_payment_id;

  insert into audit_logs (school_id, actor_id, actor_role, action, entity, entity_id, before, after)
  values (v_school_id, auth.uid(), v_role, 'payment.approved', 'payment', p_payment_id,
          jsonb_build_object('status', v_payment.status),
          jsonb_build_object('status', 'approved', 'allocations', p_allocations));
end;
$$;

-- Tolak / minta revisi — catatan WAJIB (PRD §5)
create or replace function public.review_payment(
  p_payment_id uuid,
  p_action text,          -- 'rejected' | 'needs_revision'
  p_note text
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_school_id uuid := current_admin_school_id();
  v_role text := current_admin_role();
  v_admin_id uuid;
  v_payment payments;
begin
  if v_role is null or v_role not in ('super_admin','admin_keuangan') then
    raise exception 'Tidak berwenang memverifikasi pembayaran';
  end if;
  if p_action not in ('rejected','needs_revision') then
    raise exception 'Aksi tidak dikenal: %', p_action;
  end if;
  if p_note is null or length(trim(p_note)) = 0 then
    raise exception 'Catatan wajib diisi untuk aksi Tolak / Perlu Revisi';
  end if;

  select id into v_admin_id from admin_users
  where auth_user_id = auth.uid() and is_active;

  select * into v_payment from payments
  where id = p_payment_id and school_id = v_school_id
  for update;
  if not found then
    raise exception 'Pembayaran tidak ditemukan';
  end if;
  if v_payment.status <> 'pending' then
    raise exception 'Hanya pembayaran berstatus pending yang bisa direview (status saat ini: %)', v_payment.status;
  end if;

  update payments
  set status = p_action,
      reviewed_by = v_admin_id,
      reviewed_at = now(),
      review_note = p_note
  where id = p_payment_id;

  insert into audit_logs (school_id, actor_id, actor_role, action, entity, entity_id, before, after)
  values (v_school_id, auth.uid(), v_role, 'payment.' || p_action, 'payment', p_payment_id,
          jsonb_build_object('status', 'pending'),
          jsonb_build_object('status', p_action, 'note', p_note));
end;
$$;

-- §6 ─── Row Level Security (PRD §6.2)
--        Mutasi status payments TIDAK punya policy update — hanya via RPC.
-- ----------------------------------------------------------------------------

alter table schools              enable row level security;
alter table academic_years       enable row level security;
alter table classes              enable row level security;
alter table students             enable row level security;
alter table class_enrollments    enable row level security;
alter table guardians            enable row level security;
alter table guardian_students    enable row level security;
alter table payment_types        enable row level security;
alter table admin_users          enable row level security;
alter table bills                enable row level security;
alter table payments             enable row level security;
alter table payment_allocations  enable row level security;
alter table announcements        enable row level security;
alter table audit_logs           enable row level security;

-- ── schools
create policy member_read_school on schools for select using (
  id = current_admin_school_id() or id = current_guardian_school_id()
);
create policy super_admin_update_school on schools for update using (
  id = current_admin_school_id() and current_admin_role() = 'super_admin'
);

-- ── master data: semua admin sekolah boleh baca; tulis: super_admin/operator
create policy admin_read_academic_years on academic_years for select
  using (school_id = current_admin_school_id());
create policy admin_write_academic_years on academic_years for all
  using (school_id = current_admin_school_id()
         and current_admin_role() in ('super_admin','operator'));

create policy admin_read_classes on classes for select
  using (school_id = current_admin_school_id());
create policy admin_write_classes on classes for all
  using (school_id = current_admin_school_id()
         and current_admin_role() in ('super_admin','operator'));

create policy admin_read_students on students for select
  using (school_id = current_admin_school_id());
create policy admin_write_students on students for all
  using (school_id = current_admin_school_id()
         and current_admin_role() in ('super_admin','operator'));
create policy parent_read_own_students on students for select
  using (id in (select current_guardian_student_ids()));

create policy admin_read_enrollments on class_enrollments for select using (
  exists (select 1 from students s
          where s.id = student_id and s.school_id = current_admin_school_id())
);
create policy admin_write_enrollments on class_enrollments for all using (
  current_admin_role() in ('super_admin','operator')
  and exists (select 1 from students s
              where s.id = student_id and s.school_id = current_admin_school_id())
);
create policy parent_read_own_enrollments on class_enrollments for select
  using (student_id in (select current_guardian_student_ids()));

create policy admin_read_guardians on guardians for select
  using (school_id = current_admin_school_id());
create policy admin_write_guardians on guardians for all
  using (school_id = current_admin_school_id()
         and current_admin_role() in ('super_admin','operator'));
create policy parent_read_self on guardians for select
  using (auth_user_id = auth.uid());

create policy admin_read_guardian_students on guardian_students for select using (
  exists (select 1 from guardians g
          where g.id = guardian_id and g.school_id = current_admin_school_id())
);
create policy admin_write_guardian_students on guardian_students for all using (
  current_admin_role() in ('super_admin','operator')
  and exists (select 1 from guardians g
              where g.id = guardian_id and g.school_id = current_admin_school_id())
);
create policy parent_read_own_links on guardian_students for select
  using (guardian_id = current_guardian_id());

create policy admin_read_payment_types on payment_types for select
  using (school_id = current_admin_school_id());
create policy admin_write_payment_types on payment_types for all
  using (school_id = current_admin_school_id()
         and current_admin_role() in ('super_admin','admin_keuangan'));
create policy parent_read_payment_types on payment_types for select
  using (school_id = current_guardian_school_id() and is_active);

-- ── admin_users: hanya super_admin yang kelola; semua admin boleh lihat rekan
create policy admin_read_admin_users on admin_users for select
  using (school_id = current_admin_school_id());
create policy super_admin_write_admin_users on admin_users for all
  using (school_id = current_admin_school_id()
         and current_admin_role() = 'super_admin');

-- ── bills: admin baca semua (laporan); tulis via RPC/role keuangan
create policy admin_read_bills on bills for select
  using (school_id = current_admin_school_id());
create policy admin_write_bills on bills for all
  using (school_id = current_admin_school_id()
         and current_admin_role() in ('super_admin','admin_keuangan'));
create policy parent_read_own_bills on bills for select
  using (student_id in (select current_guardian_student_ids()));

-- ── payments: TIDAK ADA policy update/delete untuk siapa pun (RPC only)
create policy admin_read_payments on payments for select
  using (school_id = current_admin_school_id());
create policy admin_insert_cash_payments on payments for insert with check (
  school_id = current_admin_school_id()
  and current_admin_role() in ('super_admin','admin_keuangan','operator')
);
create policy parent_read_own_payments on payments for select using (
  student_id in (select current_guardian_student_ids())
);
create policy parent_insert_own_payments on payments for insert with check (
  submitted_by = current_guardian_id()
  and student_id in (select current_guardian_student_ids())
  and school_id = current_guardian_school_id()
  and status = 'pending'
);

-- ── payment_allocations: read-only dari client; insert hanya via RPC (definer)
create policy admin_read_allocations on payment_allocations for select using (
  exists (select 1 from payments p
          where p.id = payment_id and p.school_id = current_admin_school_id())
);
create policy parent_read_own_allocations on payment_allocations for select using (
  exists (select 1 from payments p
          where p.id = payment_id
            and p.student_id in (select current_guardian_student_ids()))
);

-- ── announcements
create policy admin_read_announcements on announcements for select
  using (school_id = current_admin_school_id());
create policy admin_write_announcements on announcements for all
  using (school_id = current_admin_school_id()
         and current_admin_role() in ('super_admin','operator'));
create policy parent_read_announcements on announcements for select using (
  school_id = current_guardian_school_id()
  and (publish_at is null or publish_at <= now())
  and (expires_at is null or expires_at > now())
);

-- ── audit_logs: insert via RPC (definer); baca: super_admin & kepala_sekolah
create policy audit_read on audit_logs for select using (
  school_id = current_admin_school_id()
  and current_admin_role() in ('super_admin','kepala_sekolah')
);

-- §6b ── Grant privilege ke role Supabase (RLS tetap yang membatasi baris).
--        Wajib eksplisit agar konsisten di lokal/CI; service_role bypass RLS.
-- ----------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;

-- §7 ─── Storage bucket (LANGKAH MANUAL — tidak bisa via migration SQL biasa)
-- ----------------------------------------------------------------------------
-- Buat bucket PRIVAT bernama:  payment-proofs
--   Dashboard Supabase → Storage → New bucket → "payment-proofs" → Public: OFF
-- Aturan (PRD §6.3):
--   • Path file: {school_id}/{student_id}/{payment_id}.{ext}
--   • Akses HANYA via signed URL 5 menit, digenerate Server Action setelah
--     cek otorisasi. Jangan pernah expose path publik.
--   • Validasi upload (Edge Function): max 5 MB, magic-bytes JPEG/PNG/WebP/PDF,
--     strip EXIF, re-encode gambar, simpan sha256 ke payments.proof_sha256.
-- ============================================================================
