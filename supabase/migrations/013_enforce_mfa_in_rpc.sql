-- ============================================================================
-- ArtaSchool Pay — 013_enforce_mfa_in_rpc.sql
--
-- PERBAIKAN KEAMANAN. Sebelum ini 2FA hanya ditegakkan di lapisan aplikasi
-- (`requireAdmin`). Penyerang yang mencuri kata sandi admin dapat masuk pada
-- aal1 lalu memanggil RPC keuangan LANGSUNG ke PostgREST, melewati gerbang
-- 2FA sepenuhnya. Terbukti pada gladi resik UAT.
--
-- Perbaikan: tegakkan aal2 di DALAM RPC yang menyentuh uang, sesuai prinsip
-- PRD §3.1 — database adalah sumber kebenaran otorisasi, aplikasi hanya
-- lapisan kedua.
-- ============================================================================

set check_function_bodies = off;

-- true bila peran tidak mewajibkan 2FA, ATAU sesi sudah aal2.
create or replace function public.admin_mfa_ok()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select case
    when current_admin_role() in ('super_admin', 'admin_keuangan')
      then coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    else true
  end;
$$;

comment on function public.admin_mfa_ok is
  'Peran pemegang uang (super_admin, admin_keuangan) wajib sesi aal2 (2FA terverifikasi).';

-- ── approve_payment ─────────────────────────────────────────────────────────
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
  v_student_name text;
begin
  if v_role is null or v_role not in ('super_admin','admin_keuangan') then
    raise exception 'Tidak berwenang memverifikasi pembayaran';
  end if;
  if not admin_mfa_ok() then
    raise exception 'Aksi ini memerlukan verifikasi dua langkah (2FA)';
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

  if v_payment.submitted_by is not null then
    select full_name into v_student_name from students where id = v_payment.student_id;
    perform enqueue_notification(
      v_school_id, v_payment.submitted_by, 'payment.approved',
      'Pembayaran ' || format_rupiah(v_payment.amount) || ' untuk ' ||
      coalesce(v_student_name, 'siswa') || ' telah DISETUJUI. Terima kasih.',
      jsonb_build_object('payment_id', p_payment_id, 'amount', v_payment.amount)
    );
  end if;
end;
$$;

-- ── review_payment ──────────────────────────────────────────────────────────
create or replace function public.review_payment(
  p_payment_id uuid,
  p_action text,
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
  v_student_name text;
  v_label text;
begin
  if v_role is null or v_role not in ('super_admin','admin_keuangan') then
    raise exception 'Tidak berwenang memverifikasi pembayaran';
  end if;
  if not admin_mfa_ok() then
    raise exception 'Aksi ini memerlukan verifikasi dua langkah (2FA)';
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

  if v_payment.submitted_by is not null then
    select full_name into v_student_name from students where id = v_payment.student_id;
    v_label := case when p_action = 'rejected' then 'DITOLAK' else 'PERLU REVISI' end;
    perform enqueue_notification(
      v_school_id, v_payment.submitted_by, 'payment.' || p_action,
      'Pembayaran ' || format_rupiah(v_payment.amount) || ' untuk ' ||
      coalesce(v_student_name, 'siswa') || ' berstatus ' || v_label ||
      '. Catatan admin: ' || p_note ||
      case when p_action = 'needs_revision'
           then ' Silakan kirim ulang lewat aplikasi.' else '' end,
      jsonb_build_object('payment_id', p_payment_id, 'note', p_note)
    );
  end if;
end;
$$;

-- ── waive_bill / unwaive_bill ───────────────────────────────────────────────
create or replace function public.waive_bill(p_bill_id uuid, p_note text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_school uuid := current_admin_school_id();
  v_role text := current_admin_role();
  v_bill bills;
begin
  if v_role is null or v_role not in ('super_admin','admin_keuangan') then
    raise exception 'Tidak berwenang membebaskan tagihan';
  end if;
  if not admin_mfa_ok() then
    raise exception 'Aksi ini memerlukan verifikasi dua langkah (2FA)';
  end if;
  if p_note is null or length(trim(p_note)) = 0 then
    raise exception 'Catatan wajib diisi untuk pembebasan tagihan';
  end if;

  select * into v_bill from bills
  where id = p_bill_id and school_id = v_school
  for update;
  if not found then
    raise exception 'Tagihan tidak ditemukan';
  end if;
  if v_bill.amount_paid > 0 then
    raise exception 'Tagihan sudah menerima pembayaran — tidak bisa dibebaskan';
  end if;
  if v_bill.status = 'paid' then
    raise exception 'Tagihan sudah lunas';
  end if;

  update bills set status = 'waived' where id = p_bill_id;

  insert into audit_logs (school_id, actor_id, actor_role, action, entity, entity_id, before, after)
  values (v_school, auth.uid(), v_role, 'bill.waived', 'bill', p_bill_id,
          jsonb_build_object('status', v_bill.status),
          jsonb_build_object('status', 'waived', 'note', p_note));
end;
$$;

create or replace function public.unwaive_bill(p_bill_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_school uuid := current_admin_school_id();
  v_role text := current_admin_role();
  v_bill bills;
begin
  if v_role is null or v_role not in ('super_admin','admin_keuangan') then
    raise exception 'Tidak berwenang';
  end if;
  if not admin_mfa_ok() then
    raise exception 'Aksi ini memerlukan verifikasi dua langkah (2FA)';
  end if;

  select * into v_bill from bills
  where id = p_bill_id and school_id = v_school
  for update;
  if not found then
    raise exception 'Tagihan tidak ditemukan';
  end if;
  if v_bill.status <> 'waived' then
    raise exception 'Hanya tagihan berstatus waived yang bisa dibatalkan pembebasannya';
  end if;

  update bills set status = 'unpaid' where id = p_bill_id;
  perform recompute_bill_amount_paid(p_bill_id);

  insert into audit_logs (school_id, actor_id, actor_role, action, entity, entity_id, after)
  values (v_school, auth.uid(), v_role, 'bill.unwaived', 'bill', p_bill_id,
          jsonb_build_object('status', 'unpaid'));
end;
$$;

-- ── record_cash_payment ─────────────────────────────────────────────────────
-- operator TIDAK wajib 2FA (admin_mfa_ok() mengembalikan true untuk peran itu),
-- tetapi super_admin & admin_keuangan tetap wajib.
create or replace function public.record_cash_payment(
  p_student_id uuid,
  p_amount numeric,
  p_allocations jsonb,
  p_method text default 'cash',
  p_note text default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_school_id uuid := current_admin_school_id();
  v_role text := current_admin_role();
  v_admin_id uuid;
  v_payment_id uuid := gen_random_uuid();
  v_alloc record;
  v_total numeric(12,0) := 0;
  v_bill bills;
begin
  if v_role is null or v_role not in ('super_admin','admin_keuangan','operator') then
    raise exception 'Tidak berwenang mencatat pembayaran tunai';
  end if;
  if not admin_mfa_ok() then
    raise exception 'Aksi ini memerlukan verifikasi dua langkah (2FA)';
  end if;
  if p_method not in ('cash','qris') then
    raise exception 'Metode harus cash atau qris';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal harus lebih dari 0';
  end if;
  if not exists (
    select 1 from students where id = p_student_id and school_id = v_school_id
  ) then
    raise exception 'Siswa tidak ditemukan';
  end if;
  if p_allocations is null or jsonb_typeof(p_allocations) <> 'array'
     or jsonb_array_length(p_allocations) = 0 then
    raise exception 'Alokasi wajib diisi';
  end if;

  select id into v_admin_id from admin_users
  where auth_user_id = auth.uid() and is_active;

  insert into payments (
    id, school_id, student_id, submitted_by, method, amount,
    status, reviewed_by, reviewed_at, review_note
  ) values (
    v_payment_id, v_school_id, p_student_id, null, p_method, p_amount,
    'approved', v_admin_id, now(), p_note
  );

  for v_alloc in
    select (e->>'bill_id')::uuid as bill_id, (e->>'amount')::numeric(12,0) as amount
    from jsonb_array_elements(p_allocations) e
  loop
    if v_alloc.amount is null or v_alloc.amount <= 0 then
      raise exception 'Nominal alokasi harus lebih dari 0';
    end if;

    select * into v_bill from bills
    where id = v_alloc.bill_id and school_id = v_school_id
      and student_id = p_student_id
    for update;
    if not found then
      raise exception 'Tagihan tidak valid untuk siswa ini';
    end if;
    if v_bill.status in ('waived','cancelled') then
      raise exception 'Tagihan berstatus % tidak bisa dialokasikan', v_bill.status;
    end if;

    insert into payment_allocations (payment_id, bill_id, amount)
    values (v_payment_id, v_alloc.bill_id, v_alloc.amount);

    v_total := v_total + v_alloc.amount;
  end loop;

  if v_total <> p_amount then
    raise exception 'Total alokasi (%) harus sama dengan nominal (%)', v_total, p_amount;
  end if;

  insert into audit_logs (school_id, actor_id, actor_role, action, entity, entity_id, after)
  values (v_school_id, auth.uid(), v_role, 'payment.cash_recorded', 'payment', v_payment_id,
          jsonb_build_object('amount', p_amount, 'method', p_method, 'note', p_note));

  return v_payment_id;
end;
$$;
