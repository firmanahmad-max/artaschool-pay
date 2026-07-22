# Uji Coba (UAT) — Sekolah Pilot

Panduan uji coba untuk sekolah pilot ArtaSchool Pay. Tujuannya membuktikan
sistem sanggup menjalankan **satu siklus SPP bulanan penuh tanpa perlu
menagih lewat WhatsApp manual**.

**Durasi**: 1 bulan penuh (satu siklus SPP).
**Peserta minimal**: 1 admin keuangan, 1 operator, 1 kepala sekolah, 10–20 wali murid.

---

## Sebelum Mulai

Pastikan pengelola sistem sudah menyelesaikan
[Checklist Go-Live](./CHECKLIST-GO-LIVE.md). Sekolah tidak perlu menyentuh hal teknis.

Siapkan juga:

- [ ] Data siswa dalam Excel (NIS, nama, kelas, nama wali, **nomor HP wali**)
- [ ] Nomor rekening sekolah + nama pemilik rekening
- [ ] Daftar 10–20 wali yang bersedia jadi peserta uji coba
- [ ] Satu grup WhatsApp untuk mengumpulkan keluhan peserta

> **Penting**: selama uji coba, **tetap jalankan cara lama** (WhatsApp/buku)
> sebagai cadangan. Jangan matikan proses lama sampai UAT dinyatakan lulus.

---

## Tahap 1 — Persiapan Data (Hari 1–3)

| # | Yang diuji | Langkah | Dianggap LULUS bila |
|---|---|---|---|
| 1.1 | Tahun ajaran | Buat tahun ajaran, klik **Aktifkan** | Berlabel "Aktif" |
| 1.2 | Kelas | Tambah semua kelas | Semua kelas muncul |
| 1.3 | Import siswa | Unduh template → isi → unggah | Jumlah siswa sesuai; baris gagal jelas alasannya |
| 1.4 | Perbaikan baris gagal | Unduh CSV error, perbaiki, unggah ulang | Semua siswa masuk |
| 1.5 | Cek nomor wali | Buka 5 siswa acak, periksa nomor HP wali | Nomor benar & sesuai wali |
| 1.6 | Jenis pembayaran | Tambah SPP (centang *berulang*) + jenis lain | Muncul di daftar |

**Catat**: berapa lama import? Berapa baris gagal? Apa penyebab tersering?

---

## Tahap 2 — Terbitkan Tagihan (Hari 4)

| # | Yang diuji | Langkah | Dianggap LULUS bila |
|---|---|---|---|
| 2.1 | Generate massal | Generate SPP untuk bulan berjalan | Jumlah tagihan = jumlah siswa aktif |
| 2.2 | Aman diulang | Tekan Generate lagi, periode sama | Muncul "tidak ada tagihan baru" — **tidak dobel** |
| 2.3 | Tunggakan | Buka Dashboard | Angka tunggakan masuk akal |
| 2.4 | Tagihan khusus | Buat 1 tagihan individual | Tampil hanya untuk siswa itu |
| 2.5 | Pembebasan | Bebaskan 1 tagihan (mis. beasiswa) + catatan | Status "Dibebaskan"; keluar dari tunggakan |

---

## Tahap 3 — Orang Tua Membayar (Hari 5–20)

Undang peserta lewat WhatsApp. Kalimat yang bisa disalin:

> Bapak/Ibu, mulai bulan ini bukti transfer SPP bisa dikirim lewat aplikasi
> sekolah — tidak perlu lagi kirim foto ke WhatsApp. Buka [ALAMAT APLIKASI],
> masuk dengan nomor HP ini, lalu ikuti langkahnya. Bila ada kendala, balas
> pesan ini.

| # | Yang diuji | Langkah | Dianggap LULUS bila |
|---|---|---|---|
| 3.1 | Masuk OTP | Wali masuk dengan nomornya | Kode masuk < 1 menit |
| 3.2 | Nomor asing ditolak | Coba nomor yang tidak terdaftar | Ditolak dengan pesan jelas |
| 3.3 | Lihat tagihan | Buka Beranda | Nama anak, kelas, tagihan benar |
| 3.4 | Unggah bukti | Pilih tagihan → unggah foto → kirim | Berhasil, muncul "Menunggu" |
| 3.5 | Bayar sebagian | Ubah nominal lebih kecil dari tagihan | Tetap bisa dikirim |
| 3.6 | Banyak tagihan sekaligus | Centang 2 tagihan | Nominal terjumlah otomatis |
| 3.7 | Wali beberapa anak | Wali dengan >1 anak | Semua anak tampil, bisa pilih |
| 3.8 | Bukti ganda | Kirim ulang foto yang sama persis | Ditolak dengan pesan jelas |
| 3.9 | Berkas salah | Coba unggah file Word/teks | Ditolak dengan pesan jelas |

**Catat**: berapa wali gagal masuk? Apa alasannya? Berapa yang minta dibantu?

---

## Tahap 4 — Verifikasi Admin (setiap hari kerja)

| # | Yang diuji | Langkah | Dianggap LULUS bila |
|---|---|---|---|
| 4.1 | Antrean | Buka Antrean Verifikasi | Semua kiriman hari itu tampil |
| 4.2 | Lihat bukti | Klik Periksa | Foto bukti terbaca jelas |
| 4.3 | Riwayat siswa | Lihat panel kanan | Riwayat pembayaran siswa tampil |
| 4.4 | Terima | Setujui satu pembayaran | Tagihan berkurang/lunas otomatis |
| 4.5 | Notifikasi | Tanya wali yang baru disetujui | Wali menerima WhatsApp otomatis |
| 4.6 | Minta revisi | Minta revisi + catatan | Wali menerima catatannya |
| 4.7 | Kirim ulang | Wali menekan "Kirim Ulang" | Form sudah terisi otomatis |
| 4.8 | Tolak | Tolak satu kiriman + alasan | Wali menerima alasannya |
| 4.9 | Kecepatan | Ukur waktu upload → keputusan | Rata-rata < 4 jam kerja |
| 4.10 | Tunai | Catat 1 pembayaran tunai di TU | Langsung lunas, tanpa antrean |

---

## Tahap 5 — Tutup Bulan (Hari 25–30)

| # | Yang diuji | Langkah | Dianggap LULUS bila |
|---|---|---|---|
| 5.1 | Laporan pembayaran | Buka Laporan, saring bulan berjalan | Angka cocok dengan rekening bank |
| 5.2 | Laporan tunggakan | Pilih jenis Tunggakan | Cocok dengan catatan manual sekolah |
| 5.3 | Export | Unduh XLSX & CSV | Terbuka rapi di Excel |
| 5.4 | Cetak PDF | Tekan Cetak / PDF | Rapi, tanpa menu |
| 5.5 | Digest kepsek | Tanya kepala sekolah | Ringkasan harian masuk WhatsApp |
| 5.6 | Audit log | Buka Audit Log | Semua tindakan tercatat |

---

## Kriteria LULUS UAT

Uji coba dinyatakan **lulus** bila seluruhnya terpenuhi:

- [ ] Seluruh siklus berjalan: terbitkan tagihan → wali bayar → verifikasi → laporan
- [ ] **Tidak ada bukti transfer yang perlu ditagih/dikirim lewat WhatsApp manual**
- [ ] Laporan tunggakan **cocok 100%** dengan pembukuan manual sekolah
- [ ] Waktu upload → keputusan admin, median **< 4 jam kerja**
- [ ] Rasio "Perlu Revisi" **< 10%** (bila lebih, form upload masih membingungkan)
- [ ] Minimal **80% peserta** berhasil mengirim bukti **tanpa dibantu**
- [ ] Tidak ada uang tercatat ganda atau hilang
- [ ] Tidak ada wali yang bisa melihat data anak orang lain

---

## Formulir Keluhan

Catat setiap kendala apa adanya — keluhan justru paling berharga.

| Tanggal | Siapa | Halaman | Yang terjadi | Yang diharapkan | Gawat? |
|---|---|---|---|---|---|
| | | | | | Rendah/Sedang/Tinggi |

**Gawat (Tinggi)** = uang salah catat, data bocor antar-wali, atau wali sama
sekali tak bisa membayar. Laporkan segera, jangan tunggu akhir uji coba.

---

## Setelah UAT

1. Kumpulkan seluruh keluhan, urutkan dari yang paling gawat.
2. Perbaiki yang **Tinggi** sebelum sekolah berhenti memakai cara lama.
3. Baru setelah itu matikan proses WhatsApp manual.
4. Simpan hasil pengukuran (waktu verifikasi, rasio revisi) sebagai pembanding
   saat menambah sekolah berikutnya.
