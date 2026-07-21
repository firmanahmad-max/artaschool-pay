-- ============================================================================
-- ArtaSchool Pay — 004_billing_helpers.sql
-- Sprint 4: pembebasan/pembatalan tagihan (catatan wajib + audit).
-- generate_bills sudah ada di 001. Mutasi status khusus lewat RPC ini agar
-- konsisten dgn konvensi (audit + otorisasi role).
-- ============================================================================

-- Pembebasan tagihan (waived) — mis. beasiswa. Catatan wajib.
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

-- Batalkan pembebasan → kembali unpaid (bila belum ada pembayaran).
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

  select * into v_bill from bills
  where id = p_bill_id and school_id = v_school
  for update;
  if not found then
    raise exception 'Tagihan tidak ditemukan';
  end if;
  if v_bill.status <> 'waived' then
    raise exception 'Hanya tagihan berstatus waived yang bisa dibatalkan pembebasannya';
  end if;

  -- recompute_bill_amount_paid mengembalikan ke unpaid/partial/paid sesuai alokasi
  update bills set status = 'unpaid' where id = p_bill_id;
  perform recompute_bill_amount_paid(p_bill_id);

  insert into audit_logs (school_id, actor_id, actor_role, action, entity, entity_id, after)
  values (v_school, auth.uid(), v_role, 'bill.unwaived', 'bill', p_bill_id,
          jsonb_build_object('status', 'unpaid'));
end;
$$;
