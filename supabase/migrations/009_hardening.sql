-- ============================================================================
-- ArtaSchool Pay — 009_hardening.sql
-- Sprint 10: rate limiting (PRD §6.4) + penegasan kebijakan storage.
-- Rate limit disimpan di DB (bukan memori) agar tetap berlaku lintas instance
-- serverless. RPC hanya boleh dipanggil service_role dari Server Action —
-- klien anon TIDAK boleh memanggilnya (mencegah menghabiskan kuota nomor lain).
-- ============================================================================

create table rate_limits (
  id bigint generated always as identity primary key,
  bucket text not null,          -- 'otp:+628...', 'upload:<guardian_id>'
  hit_at timestamptz not null default now()
);

create index idx_rate_limits_bucket_time on rate_limits (bucket, hit_at desc);

-- true  = boleh lanjut (kuota dicatat)
-- false = melewati batas
create or replace function public.check_rate_limit(
  p_bucket text,
  p_max int,
  p_window_seconds int
)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_window interval := make_interval(secs => greatest(p_window_seconds, 1));
  v_used int;
begin
  -- housekeeping ringan: buang jejak lama
  delete from rate_limits where hit_at < now() - interval '1 day';

  select count(*) into v_used
  from rate_limits
  where bucket = p_bucket and hit_at > now() - v_window;

  if v_used >= greatest(p_max, 1) then
    return false;
  end if;

  insert into rate_limits (bucket) values (p_bucket);
  return true;
end;
$$;

alter table rate_limits enable row level security;
-- Tidak ada policy → hanya service_role (bypass RLS) yang bisa mengakses.

-- Cabut hak eksekusi dari klien; hanya server (service_role) yang boleh.
revoke execute on function public.check_rate_limit(text, int, int) from public;
revoke execute on function public.check_rate_limit(text, int, int) from anon;
revoke execute on function public.check_rate_limit(text, int, int) from authenticated;
grant execute on function public.check_rate_limit(text, int, int) to service_role;

-- ── Storage: bukti transfer tidak boleh diakses langsung oleh klien ─────────
-- Bucket `payment-proofs` privat & TIDAK diberi policy apa pun pada
-- storage.objects → default-deny untuk anon/authenticated. Satu-satunya jalur
-- baca adalah signed URL 5 menit yang digenerate server setelah cek otorisasi
-- (PRD §6.3). Lebih ketat daripada policy prefix school_id.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    update storage.buckets
    set public = false,
        file_size_limit = 5242880,
        allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf']
    where id = 'payment-proofs';
  end if;
end $$;
