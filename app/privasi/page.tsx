import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kebijakan Privasi & Data",
  description:
    "Data apa yang dikumpulkan ArtaSchool Pay, untuk apa, berapa lama disimpan, dan hak Anda atas data pribadi (UU PDP).",
};

// Diperbarui saat isi kebijakan berubah — ditampilkan ke pengguna.
const TERAKHIR_DIPERBARUI = "23 September 2026";

function Bagian({
  judul,
  children,
}: {
  judul: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-foreground">{judul}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export default function PrivasiPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div className="space-y-1">
        <Link
          href="/akun"
          className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Kembali
        </Link>
        <h1 className="text-xl font-semibold">Kebijakan Privasi &amp; Data</h1>
        <p className="text-sm text-muted-foreground">
          Terakhir diperbarui: {TERAKHIR_DIPERBARUI}
        </p>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        ArtaSchool Pay membantu sekolah mengelola pembayaran. Halaman ini
        menjelaskan data pribadi yang diproses, tujuannya, lama penyimpanan, dan
        hak Anda — sesuai Undang-Undang Pelindungan Data Pribadi (UU PDP).
        Pengendali data adalah <strong>sekolah tempat anak Anda terdaftar</strong>;
        aplikasi ini adalah alat yang dipakai sekolah.
      </p>

      <Bagian judul="1. Data yang dikumpulkan">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Wali:</strong> nama, nomor HP (dipakai sebagai kunci login),
            dan email bila diisi.
          </li>
          <li>
            <strong>Siswa:</strong> nama, NIS, dan kelas — didaftarkan oleh
            sekolah.
          </li>
          <li>
            <strong>Pembayaran:</strong> nominal, tanggal, metode, nama
            pengirim, dan bukti transfer yang Anda unggah.
          </li>
        </ul>
        <p>
          Kami tidak meminta data yang tidak diperlukan (mis. NIK, data
          rekening di luar yang tertera pada bukti transfer).
        </p>
        <p>
          <strong>Statistik teknis anonim:</strong> paling banyak sekali sehari,
          aplikasi mencatat jenis &amp; versi browser serta sistem operasi
          (mis. &quot;Chrome 129, Android 13&quot;) sebagai hitungan gabungan —
          tanpa nama, nomor HP, alamat IP, atau halaman yang dibuka — agar
          sekolah tahu kapan pembaruan tampilan aman untuk semua ponsel. Tidak
          dicatat bila browser Anda mengaktifkan &quot;Do Not Track&quot; atau
          &quot;Global Privacy Control&quot;.
        </p>
      </Bagian>

      <Bagian judul="2. Tujuan penggunaan">
        <p>
          Data dipakai semata untuk administrasi pembayaran sekolah: mencatat
          dan memverifikasi pembayaran, menagih, mengirim notifikasi status
          serta pengumuman, dan menyusun laporan keuangan sekolah.
        </p>
        <p>
          Data <strong>tidak</strong> dijual dan <strong>tidak</strong> dibagikan
          ke pihak ketiga untuk pemasaran.
        </p>
      </Bagian>

      <Bagian judul="3. Siapa yang dapat mengakses">
        <p>
          Hanya staf sekolah yang berwenang (mis. admin keuangan) sesuai
          perannya. Antar-wali tidak dapat melihat data satu sama lain. Bukti
          transfer disimpan privat — tidak dapat diakses lewat tautan publik.
        </p>
      </Bagian>

      <Bagian judul="4. Berapa lama disimpan">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Bukti transfer &amp; catatan pembayaran:</strong> disimpan{" "}
            <strong>7 tahun</strong> untuk kebutuhan pembukuan, meski akun Anda
            dihapus (dalam bentuk tanpa identitas Anda).
          </li>
          <li>
            <strong>Data pribadi wali:</strong> selama Anda menjadi wali aktif,
            atau hingga Anda menghapus akun.
          </li>
        </ul>
      </Bagian>

      <Bagian judul="5. Hak Anda">
        <p>Melalui menu <strong>Akun</strong> di aplikasi, Anda dapat:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Mengunduh data Anda</strong> — salinan JSON berisi profil,
            anak terhubung, dan riwayat pembayaran Anda.
          </li>
          <li>
            <strong>Menghapus akun</strong> — data pribadi Anda dihapus; catatan
            keuangan tetap disimpan tanpa identitas Anda (lihat poin 4).
          </li>
        </ul>
        <p>
          <strong>Nama dan email</strong> dapat Anda perbaiki sendiri lewat menu
          Akun. Untuk data lain yang keliru (mis. nomor HP atau data siswa),
          hubungi pihak sekolah.
        </p>
      </Bagian>

      <Bagian judul="6. Keamanan">
        <p>
          Koneksi dienkripsi (HTTPS). Akses ke data dibatasi sesuai peran, dan
          seluruh perubahan pada data keuangan tercatat pada jejak audit.
        </p>
      </Bagian>

      <Bagian judul="7. Kontak">
        <p>
          Untuk pertanyaan atau permintaan terkait data pribadi, hubungi pihak
          sekolah tempat anak Anda terdaftar.
        </p>
      </Bagian>

      <div className="border-t border-border pt-4">
        <Link
          href="/akun"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          ← Kembali ke aplikasi
        </Link>
      </div>
    </div>
  );
}
