-- ============================================================================
-- ArtaSchool Pay — 010_duplicate_and_cash.sql
-- v2: (a) deteksi bukti ganda via hash sha256 — memakai proof_sha256 yang sudah
--         disimpan sejak Sprint 5, tanpa AI (PRD §6.3 & §9 v2)
--     (b) pencatatan pembayaran TUNAI oleh admin (keputusan K5)
-- ============================================================================

set check_function_bodies = off;

create index if not exists idx_payments_school_sha
  on payments (school_id, proof_sha256)
  where proof_sha256 is not null;

-- Cari pembayaran lain dengan bukti identik (hash sama) di sekolah yang sama.
-- Bukti pada rantai revisi yang sama TIDAK dianggap duplikat — orang tua boleh
-- mengirim ulang bukti yang sama bila yang salah hanya nominal/keterangan.
create or replace function public.find_duplicate_proof(
  p_school_id uuid,
  p_sha256 text,
  p_exclude_payment_id uuid default null
)
returns uuid
language sql stable security definer
set search_path = public
as $$
  select p.id
  from payments p
  where p.school_id = p_school_id
    and p.proof_sha256 = p_sha256
    and p.status in ('pending', 'approved')
    and (p_exclude_payment_id is null or p.id <> p_exclude_payment_id)
  order by p.created_at
  limit 1;
$$;

-- submit_payment: tambah penolakan bukti ganda
drop function if exists public.submit_payment(
  uuid, uuid, numeric, text, uuid[], text, text, text, timestamptz, text, uuid
);

create or replace function public.submit_payment(
  p_payment_id uuid,
  p_student_id uuid,
  p_amount numeric,
  p_proof_path text,
  p_bill_ids uuid[],
  p_method text default 'transfer',
  p_bank_name text default null,
  p_sender_name text default null,
  p_transferred_at timestamptz default null,
  p_proof_sha256 text default null,
  p_revision_of uuid default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_guardian_id uuid;
  v_school_id uuid;
  v_dup uuid;
begin
  select id, school_id into v_guardian_id, v_school_id
  from guardians where auth_user_id = auth.uid();
  if v_guardian_id is null then
    raise exception 'Akun bukan wali terdaftar';
  end if;

  if not exists (
    select 1 from guardian_students
    where guardian_id = v_guardian_id and student_id = p_student_id
  ) then
    raise exception 'Siswa bukan anak dari wali ini';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal harus lebih dari 0';
  end if;

  -- Bukti ganda: hash identik dengan pembayaran lain yang masih hidup
  if p_proof_sha256 is not null then
    v_dup := find_duplicate_proof(v_school_id, p_proof_sha256, p_revision_of);
    if v_dup is not null then
      raise exception 'Bukti transfer ini sudah pernah dikirim sebelumnya. Gunakan bukti yang berbeda.';
    end if;
  end if;

  if p_bill_ids is not null and array_length(p_bill_ids, 1) > 0 then
    if exists (
      select 1 from unnest(p_bill_ids) as bid
      where not exists (
        select 1 from bills b
        where b.id = bid
          and b.student_id = p_student_id
          and b.status in ('unpaid', 'partial')
      )
    ) then
      raise exception 'Ada tagihan yang tidak valid untuk siswa ini';
    end if;
  end if;

  if p_revision_of is not null then
    if not exists (
      select 1 from payments
      where id = p_revision_of
        and student_id = p_student_id
        and status = 'needs_revision'
    ) then
      raise exception 'Pembayaran yang direvisi tidak valid';
    end if;
  end if;

  insert into payments (
    id, school_id, student_id, submitted_by, method, amount,
    bank_name, sender_name, transferred_at, proof_path, proof_sha256,
    status, requested_bill_ids, revision_of
  ) values (
    p_payment_id, v_school_id, p_student_id, v_guardian_id,
    coalesce(p_method, 'transfer'), p_amount,
    p_bank_name, p_sender_name, p_transferred_at, p_proof_path, p_proof_sha256,
    'pending', p_bill_ids, p_revision_of
  );

  insert into audit_logs (school_id, actor_id, actor_role, action, entity, entity_id, after)
  values (v_school_id, auth.uid(), 'guardian',
          case when p_revision_of is null then 'payment.submitted'
               else 'payment.resubmitted' end,
          'payment', p_payment_id,
          jsonb_build_object('amount', p_amount, 'bills', to_jsonb(p_bill_ids),
                             'revision_of', p_revision_of));

  return p_payment_id;
end;
$$;

-- ── Pembayaran tunai (K5) ───────────────────────────────────────────────────
-- Admin menerima uang langsung → langsung approved + alokasi dieksekusi.
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
