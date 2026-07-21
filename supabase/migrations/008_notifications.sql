-- ============================================================================
-- ArtaSchool Pay — 008_notifications.sql
-- Sprint 8: antrean notifikasi WA + broadcast pengumuman.
-- Gateway WA lokal sering tidak stabil → JANGAN kirim inline di request.
-- Semua kiriman masuk `notification_jobs`, diproses worker dengan retry
-- exponential backoff + dead-letter (PRD §7.3).
-- ============================================================================

set check_function_bodies = off;

-- Rp 350.000 (format Indonesia) untuk isi pesan
create or replace function public.format_rupiah(p numeric)
returns text
language sql immutable
as $$
  select 'Rp ' || replace(to_char(coalesce(p, 0), 'FM999,999,999,999'), ',', '.');
$$;

create table notification_jobs (
  id bigint generated always as identity primary key,
  school_id uuid not null references schools(id),
  channel text not null default 'wa' check (channel in ('wa','push','email')),
  recipient_guardian_id uuid references guardians(id),
  recipient_phone text not null,
  template text not null,               -- 'payment.approved', 'announcement', dst
  payload jsonb not null default '{}',
  body text not null,                   -- pesan final (di-render saat enqueue)
  status text not null default 'queued'
    check (status in ('queued','sending','sent','failed','dead')),
  attempts int not null default 0,
  max_attempts int not null default 3,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz default now()
);

create index idx_notification_jobs_pickup
  on notification_jobs (status, next_attempt_at);
create index idx_notification_jobs_school_created
  on notification_jobs (school_id, created_at desc);

-- ── Enqueue ─────────────────────────────────────────────────────────────────
create or replace function public.enqueue_notification(
  p_school_id uuid,
  p_guardian_id uuid,
  p_template text,
  p_body text,
  p_payload jsonb default '{}'
)
returns bigint
language plpgsql security definer
set search_path = public
as $$
declare
  v_phone text;
  v_id bigint;
begin
  select phone into v_phone from guardians where id = p_guardian_id;
  if v_phone is null or length(trim(v_phone)) = 0 then
    return null;  -- wali tanpa nomor: lewati, bukan error
  end if;

  insert into notification_jobs (
    school_id, recipient_guardian_id, recipient_phone, template, body, payload
  ) values (
    p_school_id, p_guardian_id, v_phone, p_template, p_body, coalesce(p_payload, '{}')
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- ── Worker: klaim & selesaikan job ──────────────────────────────────────────
-- SKIP LOCKED agar aman bila worker berjalan paralel.
create or replace function public.claim_notification_jobs(p_limit int default 10)
returns setof notification_jobs
language plpgsql security definer
set search_path = public
as $$
begin
  return query
  update notification_jobs nj
  set status = 'sending', attempts = nj.attempts + 1
  where nj.id in (
    select j.id from notification_jobs j
    where j.status in ('queued', 'failed')
      and j.next_attempt_at <= now()
    order by j.next_attempt_at
    limit greatest(p_limit, 1)
    for update skip locked
  )
  returning nj.*;
end;
$$;

create or replace function public.complete_notification_job(
  p_id bigint,
  p_ok boolean,
  p_error text default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if p_ok then
    update notification_jobs
    set status = 'sent', sent_at = now(), last_error = null
    where id = p_id;
  else
    -- backoff eksponensial; habis percobaan → dead-letter
    update notification_jobs
    set status = case when attempts >= max_attempts then 'dead' else 'failed' end,
        last_error = p_error,
        next_attempt_at = now() + (interval '1 minute' * power(2, attempts))
    where id = p_id;
  end if;
end;
$$;

-- ── Hook: notifikasi hasil verifikasi pembayaran ────────────────────────────
-- approve_payment & review_payment ditulis ulang (isi sama + enqueue notif).

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

  -- Notifikasi ke orang tua (antrean, bukan inline)
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

-- ── Broadcast pengumuman ────────────────────────────────────────────────────
-- audience: {"scope":"all"} atau {"scope":"class","class_ids":[...]}
create or replace function public.broadcast_announcement(p_announcement_id uuid)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_school_id uuid := current_admin_school_id();
  v_role text := current_admin_role();
  v_ann announcements;
  v_scope text;
  v_class_ids uuid[];
  v_count integer := 0;
  v_guardian record;
begin
  if v_role is null or v_role not in ('super_admin','operator') then
    raise exception 'Tidak berwenang melakukan broadcast';
  end if;

  select * into v_ann from announcements
  where id = p_announcement_id and school_id = v_school_id;
  if not found then
    raise exception 'Pengumuman tidak ditemukan';
  end if;

  v_scope := coalesce(v_ann.audience->>'scope', 'all');
  if v_scope = 'class' then
    select array_agg(value::uuid) into v_class_ids
    from jsonb_array_elements_text(coalesce(v_ann.audience->'class_ids', '[]'::jsonb));
  end if;

  for v_guardian in
    select distinct g.id
    from guardians g
    join guardian_students gs on gs.guardian_id = g.id
    join students s on s.id = gs.student_id and s.is_active
    left join class_enrollments ce on ce.student_id = s.id
    where g.school_id = v_school_id
      and (
        v_scope = 'all'
        or (v_class_ids is not null and ce.class_id = any(v_class_ids))
      )
  loop
    if enqueue_notification(
         v_school_id, v_guardian.id, 'announcement',
         '[Pengumuman] ' || v_ann.title ||
         case when v_ann.body is not null then chr(10) || v_ann.body else '' end,
         jsonb_build_object('announcement_id', p_announcement_id)
       ) is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  insert into audit_logs (school_id, actor_id, actor_role, action, entity, entity_id, after)
  values (v_school_id, auth.uid(), v_role, 'announcement.broadcast', 'announcement',
          p_announcement_id, jsonb_build_object('recipients', v_count));

  return v_count;
end;
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Worker memakai service_role (bypass RLS). Admin sekolah boleh memantau.
alter table notification_jobs enable row level security;

create policy admin_read_notification_jobs on notification_jobs for select
  using (school_id = current_admin_school_id());

grant all on notification_jobs to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
