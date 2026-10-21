-- ============================================================================
-- ArtaSchool Pay — 022_statistik_perangkat.sql
-- Statistik perangkat ANONIM untuk keputusan migrasi Tailwind 4 berbasis data
-- (v4 butuh Safari 16.4+/Chrome 111+ — lihat CHECKLIST-GO-LIVE §6).
--
-- UU PDP: yang disimpan HANYA penghitung harian per kategori kasar. Tidak ada
-- user-agent utuh, IP, identitas wali, sesi, atau halaman. Kunci gabungan
-- membuat jumlah baris terbatas (bukan satu baris per kunjungan), sehingga
-- endpoint publik yang di-spam tak bisa membengkakkan tabel tanpa batas.
-- ============================================================================

set check_function_bodies = off;

create table statistik_perangkat (
  hari date not null,
  area text not null check (area in ('wali', 'admin')),
  browser text not null
    check (browser in ('chrome','safari','firefox','samsung','edge','opera','webview','lain')),
  versi int not null check (versi between 0 and 999),
  os text not null check (os in ('android','ios','windows','macos','linux','lain')),
  os_versi int not null check (os_versi between 0 and 99),
  -- Lolos deteksi fitur yang diwajibkan Tailwind 4 (color-mix, @property, oklch)
  tw4 boolean not null,
  jumlah int not null default 0,
  primary key (hari, area, browser, versi, os, os_versi, tw4)
);

alter table statistik_perangkat enable row level security;
revoke all on statistik_perangkat from anon, authenticated;

-- Pencatat — hanya server (route handler memakai service_role).
create or replace function public.catat_statistik_perangkat(
  p_area text, p_browser text, p_versi int, p_os text, p_os_versi int, p_tw4 boolean
)
returns void
language sql security definer
set search_path = public
as $$
  insert into statistik_perangkat (hari, area, browser, versi, os, os_versi, tw4, jumlah)
  values ((now() at time zone 'Asia/Makassar')::date,
          p_area, p_browser, p_versi, p_os, p_os_versi, p_tw4, 1)
  on conflict (hari, area, browser, versi, os, os_versi, tw4)
  do update set jumlah = statistik_perangkat.jumlah + 1;
$$;

-- Ringkasan untuk admin (data agregat, tak sensitif).
create or replace function public.ringkasan_statistik_perangkat(p_hari int default 30)
returns table (area text, browser text, versi int, os text, os_versi int, tw4 boolean, jumlah bigint)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if current_admin_role() is null then
    raise exception 'Hanya admin' using errcode = '42501';
  end if;
  return query
  select s.area, s.browser, s.versi, s.os, s.os_versi, s.tw4, sum(s.jumlah)::bigint
  from statistik_perangkat s
  where s.hari > (now() at time zone 'Asia/Makassar')::date - greatest(p_hari, 1)
  group by 1, 2, 3, 4, 5, 6
  order by 7 desc;
end;
$$;

revoke execute on function public.catat_statistik_perangkat(text, text, int, text, int, boolean)
  from public, anon, authenticated;
grant execute on function public.catat_statistik_perangkat(text, text, int, text, int, boolean)
  to service_role;
revoke execute on function public.ringkasan_statistik_perangkat(int) from public, anon;
grant execute on function public.ringkasan_statistik_perangkat(int) to authenticated;
