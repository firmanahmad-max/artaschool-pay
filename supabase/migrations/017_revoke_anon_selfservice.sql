-- ============================================================================
-- ArtaSchool Pay — 017_revoke_anon_selfservice.sql
-- Pengetatan (defense-in-depth) untuk RPC swalayan wali.
--
-- Supabase memberi EXECUTE ke `anon` secara default saat fungsi dibuat (lewat
-- ALTER DEFAULT PRIVILEGES), sehingga `revoke ... from public` di migrasi 014–016
-- belum mencabut hak `anon`. Badan fungsi tetap menolak anon (auth.uid() null),
-- jadi ini bukan celah — tetapi untuk endpoint yang dipakai orang tua dan
-- sebagiannya destruktif (hapus akun), lebih baik menolak di GERBANG hak akses,
-- sebelum badan fungsi dijalankan. Hanya sesi `authenticated` yang boleh memanggil.
-- ============================================================================

revoke execute on function public.delete_my_guardian_account()      from anon;
revoke execute on function public.export_my_guardian_data()         from anon;
revoke execute on function public.update_my_guardian_profile(text, text) from anon;
