-- Stub minimal skema `auth` Supabase untuk validasi migration di PostgreSQL
-- polos (CI service container). JANGAN dijalankan di Supabase asli.
create schema if not exists auth;

-- Role standar Supabase (dibutuhkan statement grant di migration)
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid()
);

-- Klaim JWT tiruan. SENGAJA meniru implementasi Supabase asli: membaca
-- `request.jwt.claims` sebagai satu objek JSON. Kalau stub ini berbeda dari
-- produksi, tes bisa lulus di CI padahal perilaku nyatanya lain.
create or replace function auth.jwt()
returns jsonb
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb;
$$;

-- Sama seperti Supabase asli: menerima klaim per-kunci maupun objek JSON.
create or replace function auth.uid()
returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
$$;
