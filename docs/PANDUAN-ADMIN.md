# Panduan Admin — ArtaSchool Pay

Panduan operasional untuk staf sekolah. Ditulis untuk pengguna non-teknis.

---

## 1. Masuk ke Aplikasi

- **Admin sekolah**: buka `/admin/login`, masuk dengan email + kata sandi dari Super Admin.
- **Orang tua**: buka halaman depan, masuk dengan **nomor HP** yang didaftarkan sekolah. Kode OTP dikirim via WhatsApp — tidak ada kata sandi.

> Orang tua **tidak bisa mendaftar sendiri**. Nomor harus didaftarkan admin lebih dulu (lihat §3). Ini mencegah orang asing mengklaim data anak orang lain.

### Peran & Kewenangan

| Kemampuan | Super Admin | Admin Keuangan | Operator | Kepsek | Viewer |
|---|---|---|---|---|---|
| Verifikasi (terima/tolak/revisi) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Kelola siswa/kelas/tahun ajaran | ✅ | ❌ | ✅ | ❌ | ❌ |
| Kelola tagihan & pembebasan | ✅ | ✅ | ❌ | ❌ | ❌ |
| Pengumuman & broadcast | ✅ | ❌ | ✅ | ❌ | ❌ |
| Laporan & export | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lihat audit log | ✅ | ❌ | ❌ | ✅ | ❌ |

---

## 2. Urutan Persiapan Awal Tahun Ajaran

Kerjakan **berurutan** — langkah berikut bergantung pada langkah sebelumnya.

1. **Tahun Ajaran** (`/admin/tahun-ajaran`) → tambah, lalu klik **Aktifkan**.
   Hanya satu tahun ajaran aktif pada satu waktu.
2. **Kelas** (`/admin/siswa`) → tambah kelas (tingkat + label, mis. `1A`).
   Kelas otomatis masuk ke tahun ajaran aktif.
3. **Siswa** → tambah satu per satu, atau **Import Excel** (lihat §3).
4. **Jenis Pembayaran** (`/admin/tagihan`) → mis. SPP (centang *berulang*), Daftar Ulang.
5. **Generate Tagihan** → pilih jenis + periode → tagihan dibuat untuk semua siswa aktif.

---

## 3. Mengelola Siswa

### Import dari Excel
1. Buka `/admin/siswa` → **Unduh Template**.
2. Isi kolom: `NIS`, `Nama Lengkap`, `Kelas`, `Nama Wali`, `No HP Wali`, `Relasi`.
   - `Kelas` harus **sama persis** dengan label kelas yang sudah dibuat.
   - `Relasi` diisi `ayah`, `ibu`, atau `wali`.
   - Nomor HP boleh `08…` atau `+628…` — sistem menyeragamkan otomatis.
3. Unggah berkas → sistem memproses **baris per baris**.
   Baris yang benar tetap masuk; baris bermasalah dilaporkan dan bisa **diunduh sebagai CSV** untuk diperbaiki.

### Nomor HP wali = kunci login
Kalau orang tua tidak bisa masuk, periksa nomornya di halaman detail siswa. Satu wali bisa menaungi beberapa anak, dan satu anak bisa punya dua wali.

### Kode aktivasi wali (masuk dengan PIN)
Orang tua masuk dengan **nomor HP + PIN 6 angka**. Untuk membuat PIN pertama kali — atau saat **lupa PIN** — mereka butuh kode aktivasi dari sekolah:

1. Buka siswa di **Siswa & Kelas** → bagian **Wali terhubung**. Label **Belum aktivasi** / **Akun aktif** menunjukkan status tiap wali.
2. Tekan **Kode aktivasi** (atau **Reset PIN** untuk wali yang sudah aktif).
3. Tekan **Kirim via WhatsApp** — WhatsApp terbuka dengan pesan siap kirim ke nomor wali tsb (berisi kode + tautan aktivasi). Tekan Kirim. Alternatif: **Salin pesan**, atau tulis kodenya di kertas untuk rapat orang tua.

Aturan kode:
- Berlaku **7 hari** dan **sekali pakai**. Menerbitkan kode baru otomatis membatalkan kode lama.
- **5 kali salah** → kode terkunci; terbitkan yang baru.
- Kode **hanya tampil sekali** dan tidak bisa dilihat lagi (disimpan teracak). Jangan menyimpannya.
- Setiap penerbitan tercatat di Audit Log. **Jangan pernah** memakai kode wali untuk masuk sendiri sebagai wali.

Super admin & admin keuangan wajib sudah verifikasi 2FA untuk menerbitkan kode.

### Siswa keluar/pindah
Gunakan **Nonaktifkan Siswa** — jangan dihapus. Siswa nonaktif tidak mendapat tagihan baru, tetapi riwayatnya tetap utuh untuk pembukuan.

### Hak data wali (UU PDP)
Dari menu **Akun**, orang tua bisa memakai dua haknya sendiri — tanpa perlu bantuan admin:

- **Unduh data saya** — mengunduh salinan JSON berisi profil, anak terhubung, dan riwayat pembayarannya. Hanya datanya sendiri; data wali lain tidak ikut.
- **Hapus akun** — menghapus data pribadinya (nama, nomor HP, email, akses login). **Riwayat pembayaran tetap tersimpan** demi pembukuan (7 tahun). Pada pembayaran lama, pengirimnya akan muncul sebagai **"Akun Dihapus"**; ini normal, bukan kerusakan data. Anak yang tadinya tertaut akan kehilangan keterkaitannya — daftarkan ulang nomor wali bila diperlukan.

---

## 4. Tagihan

- **Generate massal**: aman diulang. Sistem tidak akan membuat tagihan ganda untuk siswa + jenis + periode yang sama.
- **Tagihan individual**: untuk kasus khusus satu siswa.
- **Pembebasan (waived)**: untuk beasiswa/keringanan. **Catatan wajib diisi** dan tercatat di audit log. Tagihan yang sudah menerima pembayaran tidak bisa dibebaskan.
- **Tunggakan** tampil otomatis per kelas di Dashboard dan halaman Tagihan.

---

## 5. Verifikasi Pembayaran (Pekerjaan Harian)

Buka `/admin/verifikasi`. Antrean default menampilkan yang **Menunggu**.

Klik **Periksa** untuk membuka panel:
- **Bukti transfer** tampil di panel kiri. Tautan aman berlaku **5 menit** — bila gambar gagal muncul, muat ulang halaman.
- **Riwayat pembayaran siswa** ada di panel kanan sebagai konteks (pernah ditolak? biasanya bayar berapa?).
- **Alokasi** sudah diusulkan otomatis: tagihan yang dipilih orang tua didahulukan, lalu tagihan tertua. Anda bisa mengubahnya.

Tiga aksi (pintasan keyboard **A / R / V**):

| Aksi | Kapan dipakai | Syarat |
|---|---|---|
| **Terima** (A) | Bukti sah & nominal cocok | Total alokasi **harus sama persis** dengan nominal |
| **Tolak** (R) | Bukti tidak sah / bukan ke rekening sekolah | Catatan wajib |
| **Perlu Revisi** (V) | Ada yang bisa diperbaiki orang tua | Catatan wajib — jelaskan **apa** yang salah dan **bagaimana** memperbaikinya |

Setelah **Terima**, tagihan otomatis berkurang/lunas dan orang tua mendapat notifikasi WhatsApp.

> **Perhatian:** status **Disetujui bersifat final**. Koreksi kesalahan hanya bisa lewat Super Admin dan tercatat di audit log.

---

## 6. Pengumuman & Broadcast WhatsApp

Di `/admin/pengumuman`:
1. Isi judul & isi.
2. Pilih audiens: **Semua wali** atau **Kelas tertentu**.
3. Centang **Kirim juga sebagai broadcast WhatsApp** bila perlu.

Pesan **tidak dikirim seketika**. Semua masuk **antrean** dan dikirim bertahap oleh sistem agar nomor WhatsApp sekolah tidak diblokir. Pantau statusnya di tabel *Antrean notifikasi* pada halaman yang sama:

| Status | Arti |
|---|---|
| Antre | Menunggu giliran kirim (mode manual: menunggu Anda di Kotak Keluar) |
| Terkirim | Sudah sampai gateway / ditandai terkirim manual |
| Gagal (akan diulang) | Otomatis dicoba lagi |
| Gagal permanen | Percobaan habis — periksa nomor tujuan / kuota gateway |
| Dilewati admin | Sengaja tidak dikirim lewat Kotak Keluar |

### Notifikasi aplikasi (otomatis, gratis)

Wali bisa menyalakan **Notifikasi** di menu Akun aplikasinya. Setelah aktif, kabar pembayaran disetujui/ditolak/perlu revisi dan pengumuman **langsung muncul di ponsel wali secara otomatis** — tanpa gateway WhatsApp dan tanpa kerja manual. Anjurkan semua wali menyalakannya (Android: langsung; iPhone: pasang aplikasi ke Layar Utama dulu).

Di Kotak Keluar, pesan untuk wali yang notifikasi aplikasinya terbukti sampai (≤ 30 hari terakhir) diberi tanda 📲 — WhatsApp manual untuk mereka boleh **Lewati**.

### Mode manual (belum ada gateway WhatsApp)

Selama sekolah belum memasang gateway WhatsApp, sistem berjalan dalam **mode manual**: pesan **tidak terkirim sendiri**. Ada dua jalur:

**A. Kotak Keluar WA (pesan per wali)** — ikon lonceng di kanan atas / menu **Kotak Keluar WA**. Angka pada lencana = jumlah pesan menunggu. Isinya: notifikasi pembayaran disetujui/ditolak/perlu revisi, ringkasan harian, dan pengumuman yang Anda masukkan ke Kotak Keluar.

1. Tekan **Buka WhatsApp** — WhatsApp terbuka dengan pesan siap kirim ke nomor wali.
2. Tekan Kirim di WhatsApp.
3. Kembali ke Kotak Keluar, tekan **Tandai terkirim**. (**Lewati** bila pesan memang tak perlu dikirim.)

Kerjakan dari ponsel/komputer yang memakai **WhatsApp nomor sekolah**, sekali atau dua kali sehari, supaya wali selalu menerima dari nomor yang sama.

**B. Daftar Siaran WhatsApp (pengumuman ke banyak wali)** — jauh lebih cepat daripada satu per satu:

1. Di halaman Pengumuman → **Unduh kontak wali (.vcf)** → impor ke ponsel WhatsApp sekolah (cukup sekali; ulangi bila ada wali baru).
2. Di WhatsApp: **Daftar Siaran baru** → pilih kontak wali (maks. 256 per daftar; buat beberapa daftar, mis. per kelas).
3. Pada pengumuman, tekan **Salin teks** → tempel ke daftar siaran → kirim.

Catatan: pesan siaran **hanya diterima wali yang menyimpan nomor sekolah** di kontaknya — sampaikan hal ini saat rapat orang tua. Berkas .vcf berisi data pribadi wali: jangan disebarkan, hapus setelah diimpor. Setiap unduhan tercatat di Audit Log.

---

## 7. Laporan

Di `/admin/laporan`: pilih jenis (**Pembayaran** / **Tunggakan**), saring per tanggal, kelas, dan status.

- **XLSX** / **CSV** → tombol di kanan atas (CSV siap dibuka Excel Indonesia).
- **PDF** → tombol **Cetak / PDF**, lalu pilih "Simpan sebagai PDF". Menu dan tombol otomatis disembunyikan saat dicetak.

---

## 8. Audit Log

`/admin/audit` (Super Admin & Kepala Sekolah). Mencatat setiap perubahan penting: pembayaran disetujui/ditolak, tagihan dibebaskan, siswa diubah, pengumuman dibroadcast.

Catatan audit **tidak bisa diubah atau dihapus oleh siapa pun**, termasuk administrator sistem — dijaga langsung oleh database.

---

## 9. Masalah Umum

| Gejala | Kemungkinan sebab & solusi |
|---|---|
| Orang tua tak menerima OTP | Nomor belum terdaftar, atau melebihi 3 permintaan/10 menit. Cek nomor di detail siswa, minta tunggu 10 menit. |
| "Nomor belum terdaftar" | Nomor di sistem berbeda dengan yang dipakai. Perbaiki di detail siswa. |
| Orang tua tak bisa unggah | Batas 10 unggahan/jam per akun. Atau berkas bukan JPG/PNG/WebP/PDF, atau lebih dari 5 MB. |
| Gambar bukti tak muncul | Tautan aman kedaluwarsa (5 menit) — muat ulang halaman. |
| Tombol Setujui tidak aktif | Total alokasi belum sama dengan nominal pembayaran. |
| Kelas tak bisa dihapus | Kelas masih punya siswa. Pindahkan siswa lebih dulu. |
| Broadcast tak sampai | Cek tabel antrean. Bila "Gagal permanen", hubungi pengelola sistem (kemungkinan kuota/nomor gateway). |

---

## 10. Untuk Pengelola Sistem

- **Backup**: Supabase PITR 7 hari. Jalankan `npm run backup:drill` berkala untuk membuktikan backup benar-benar bisa dipulihkan **dengan pengaman yang sama**. Simpan berkas dump ke storage terenkripsi terpisah. Saat memulihkan dari dump: `pg_restore --no-owner` **tanpa** `--no-privileges` (opsi itu membuka kembali fungsi internal untuk publik), lalu jalankan `npm run pentest` sebelum aplikasi dibuka.
- **Uji keamanan**: `npm run pentest` — memverifikasi isolasi antar-wali, storage privat, dan audit append-only.
- **Worker notifikasi**: `POST /api/jobs/notifications` dengan header `x-cron-secret`. Dijadwalkan otomatis tiap 5 menit di Vercel.
- **Retensi bukti transfer**: 7 tahun (kebutuhan pembukuan) sebelum diarsipkan.
