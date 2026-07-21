-- ============================================================================
-- ArtaSchool Pay — 007_resubmit.sql
-- Sprint 7: kirim ulang setelah "Perlu Revisi" — payment baru menunjuk payment
-- lama via revision_of sehingga riwayat audit utuh (PRD §5).
-- ============================================================================

-- Signature berubah (param baru) → drop dulu agar tidak jadi overload ganda
drop function if exists public.submit_payment(
  uuid, uuid, numeric, text, uuid[], text, text, text, timestamptz, text
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

  -- Rantai revisi: hanya boleh menunjuk payment needs_revision milik siswa sama
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
