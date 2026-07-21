-- ============================================================================
-- ArtaSchool Pay — 005_payment_submit.sql
-- Sprint 5: orang tua submit bukti bayar (pending) + pilihan tagihan.
-- Alokasi FINAL tetap dibuat admin saat approve (Sprint 6); di sini hanya
-- menyimpan USULAN tagihan dari orang tua (requested_bill_ids).
-- ============================================================================

alter table payments
  add column if not exists requested_bill_ids uuid[];

-- Submit pembayaran oleh wali. SECURITY DEFINER: memvalidasi kepemilikan anak
-- & tagihan sendiri (bukan lewat RLS). proof sudah diunggah server-side dengan
-- id yang sama sebelum RPC ini dipanggil.
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
  p_proof_sha256 text default null
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

  -- Semua tagihan yang dipilih harus milik siswa & masih bisa dibayar
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

  insert into payments (
    id, school_id, student_id, submitted_by, method, amount,
    bank_name, sender_name, transferred_at, proof_path, proof_sha256,
    status, requested_bill_ids
  ) values (
    p_payment_id, v_school_id, p_student_id, v_guardian_id,
    coalesce(p_method, 'transfer'), p_amount,
    p_bank_name, p_sender_name, p_transferred_at, p_proof_path, p_proof_sha256,
    'pending', p_bill_ids
  );

  insert into audit_logs (school_id, actor_id, actor_role, action, entity, entity_id, after)
  values (v_school_id, auth.uid(), 'guardian', 'payment.submitted', 'payment', p_payment_id,
          jsonb_build_object('amount', p_amount, 'bills', to_jsonb(p_bill_ids)));

  return p_payment_id;
end;
$$;

-- ── Bucket storage privat (hanya di stack yang punya skema `storage`;
--    dilewati di CI postgres polos). Akses tetap via signed URL server-side.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'payment-proofs', 'payment-proofs', false, 5242880,
      array['image/jpeg','image/png','image/webp','application/pdf']
    )
    on conflict (id) do nothing;
  end if;
end $$;
