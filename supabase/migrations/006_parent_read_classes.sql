-- ============================================================================
-- ArtaSchool Pay — 006_parent_read_classes.sql
-- Fix: orang tua perlu membaca nama kelas & tahun ajaran anaknya.
-- Sebelumnya hanya admin punya SELECT policy pada classes/academic_years,
-- sehingga nama kelas ke-null oleh RLS di PWA orang tua. Nama kelas & tahun
-- ajaran bukan data sensitif (satu sekolah).
-- ============================================================================

create policy parent_read_classes on classes for select
  using (school_id = current_guardian_school_id());

create policy parent_read_academic_years on academic_years for select
  using (school_id = current_guardian_school_id());
