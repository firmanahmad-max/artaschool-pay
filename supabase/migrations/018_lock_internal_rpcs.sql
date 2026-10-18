-- ============================================================================
-- ArtaSchool Pay — 018_lock_internal_rpcs.sql
-- KEAMANAN: tutup RPC internal yang terbuka untuk publik.
--
-- Temuan: fungsi-fungsi di bawah bersifat SECURITY DEFINER, TIDAK punya cek
-- otorisasi di badannya, dan EXECUTE-nya terbuka untuk PUBLIC/anon. Dengan
-- anon key publik saja (tanpa login), penyerang terbukti bisa:
--   • enqueue_notification  → mengantrekan pesan bebas (phishing "transfer ke
--                             rekening X") yang terkirim DARI nomor WA sekolah;
--   • claim_notification_jobs → membaca nomor HP wali + isi pesan antrean
--                             (kebocoran data pribadi, UU PDP) sekaligus
--                             membajak job sehingga tak pernah terkirim;
--   • complete_notification_job → menandai job "terkirim" tanpa dikirim.
--
-- Semua fungsi ini hanya dipanggil (a) dari dalam fungsi SECURITY DEFINER lain
-- — yang berjalan sebagai pemilik sehingga tak terpengaruh revoke — atau
-- (b) oleh worker server memakai service_role. Jadi cabut dari selain itu.
-- ============================================================================

revoke execute on function public.enqueue_notification(uuid, uuid, text, text, jsonb)
  from public, anon, authenticated;
revoke execute on function public.enqueue_notification_phone(uuid, text, text, text, jsonb)
  from public, anon, authenticated;
revoke execute on function public.claim_notification_jobs(int)
  from public, anon, authenticated;
revoke execute on function public.complete_notification_job(bigint, boolean, text)
  from public, anon, authenticated;

-- Helper internal lain dengan pola sama (dipanggil hanya dari SQL).
revoke execute on function public.find_duplicate_proof(uuid, text, uuid)
  from public, anon, authenticated;
revoke execute on function public.recompute_bill_amount_paid(uuid)
  from public, anon, authenticated;

-- Worker & hook server memakai service_role — pastikan haknya eksplisit
-- (setelah revoke dari PUBLIC, service_role tak lagi mewarisinya di Postgres
-- polos/CI).
grant execute on function public.enqueue_notification(uuid, uuid, text, text, jsonb) to service_role;
grant execute on function public.enqueue_notification_phone(uuid, text, text, text, jsonb) to service_role;
grant execute on function public.claim_notification_jobs(int) to service_role;
grant execute on function public.complete_notification_job(bigint, boolean, text) to service_role;
grant execute on function public.find_duplicate_proof(uuid, text, uuid) to service_role;
grant execute on function public.recompute_bill_amount_paid(uuid) to service_role;
