-- ============================================================================
-- ArtaSchool Pay — 011_promotion_wizard.sql
-- v2: wizard naik kelas antar tahun ajaran (PRD §7.2.4 & §9 v2).
-- Pemetaan otomatis: kelas tingkat g label "4A" → tingkat g+1 label "5A".
-- Siswa tingkat tertinggi (6) LULUS: tidak didaftarkan ke kelas baru dan
-- (opsional) dinonaktifkan agar tidak lagi mendapat tagihan.
-- ============================================================================

set check_function_bodies = off;

-- Sufiks label kelas: "4A" → "A", "4 Bahasa" → " Bahasa"
create or replace function public.class_label_suffix(p_label text, p_grade smallint)
returns text
language sql immutable
as $$
  select case
    when p_label like p_grade::text || '%' then substr(p_label, length(p_grade::text) + 1)
    else p_label
  end;
$$;

-- Pratinjau: apa yang AKAN terjadi, tanpa mengubah apa pun.
create or replace function public.preview_promotion(
  p_from_year uuid,
  p_to_year uuid
)
returns table (
  from_class_id uuid,
  from_label text,
  from_grade smallint,
  student_count bigint,
  to_label text,
  to_grade smallint,
  to_class_exists boolean,
  graduates boolean
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_school uuid := current_admin_school_id();
begin
  if v_school is null then
    raise exception 'Hanya admin yang boleh melihat pratinjau';
  end if;

  return query
  select
    c.id,
    c.label,
    c.grade,
    (select count(*) from class_enrollments ce
      join students s on s.id = ce.student_id and s.is_active
     where ce.class_id = c.id),
    case when c.grade >= 6 then null
         else (c.grade + 1)::text || class_label_suffix(c.label, c.grade) end,
    case when c.grade >= 6 then null else (c.grade + 1)::smallint end,
    case when c.grade >= 6 then false
         else exists (
           select 1 from classes t
           where t.academic_year_id = p_to_year
             and t.label = (c.grade + 1)::text || class_label_suffix(c.label, c.grade)
         ) end,
    c.grade >= 6
  from classes c
  where c.academic_year_id = p_from_year
    and c.school_id = v_school
  order by c.grade, c.label;
end;
$$;

-- Eksekusi kenaikan kelas. Idempotent: enrollment yang sudah ada dilewati.
create or replace function public.promote_students(
  p_from_year uuid,
  p_to_year uuid,
  p_deactivate_graduates boolean default true
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_school uuid := current_admin_school_id();
  v_role text := current_admin_role();
  v_row record;
  v_target_id uuid;
  v_created_classes int := 0;
  v_promoted int := 0;
  v_graduated int := 0;
  v_moved int;
begin
  if v_role is null or v_role not in ('super_admin','operator') then
    raise exception 'Tidak berwenang menjalankan kenaikan kelas';
  end if;
  if p_from_year = p_to_year then
    raise exception 'Tahun ajaran asal dan tujuan tidak boleh sama';
  end if;
  if not exists (select 1 from academic_years where id = p_from_year and school_id = v_school)
     or not exists (select 1 from academic_years where id = p_to_year and school_id = v_school) then
    raise exception 'Tahun ajaran tidak ditemukan';
  end if;

  for v_row in
    select c.id, c.label, c.grade,
           (c.grade + 1)::text || class_label_suffix(c.label, c.grade) as target_label
    from classes c
    where c.academic_year_id = p_from_year and c.school_id = v_school
    order by c.grade, c.label
  loop
    if v_row.grade >= 6 then
      -- Lulus: tidak naik kelas
      if p_deactivate_graduates then
        update students s
        set is_active = false
        where s.is_active
          and exists (
            select 1 from class_enrollments ce
            where ce.student_id = s.id and ce.class_id = v_row.id
          );
        get diagnostics v_moved = row_count;
        v_graduated := v_graduated + v_moved;
      end if;
      continue;
    end if;

    -- Pastikan kelas tujuan ada
    select id into v_target_id from classes
    where academic_year_id = p_to_year and label = v_row.target_label;

    if v_target_id is null then
      insert into classes (school_id, academic_year_id, grade, label)
      values (v_school, p_to_year, (v_row.grade + 1)::smallint, v_row.target_label)
      returning id into v_target_id;
      v_created_classes := v_created_classes + 1;
    end if;

    -- Daftarkan siswa aktif ke kelas tujuan (lewati yang sudah terdaftar)
    insert into class_enrollments (student_id, class_id)
    select ce.student_id, v_target_id
    from class_enrollments ce
    join students s on s.id = ce.student_id and s.is_active
    where ce.class_id = v_row.id
    on conflict (student_id, class_id) do nothing;

    get diagnostics v_moved = row_count;
    v_promoted := v_promoted + v_moved;
  end loop;

  insert into audit_logs (school_id, actor_id, actor_role, action, entity, entity_id, after)
  values (v_school, auth.uid(), v_role, 'academic_year.promoted', 'academic_year', p_to_year,
          jsonb_build_object('from_year', p_from_year, 'promoted', v_promoted,
                             'created_classes', v_created_classes, 'graduated', v_graduated));

  return jsonb_build_object(
    'promoted', v_promoted,
    'created_classes', v_created_classes,
    'graduated', v_graduated
  );
end;
$$;
