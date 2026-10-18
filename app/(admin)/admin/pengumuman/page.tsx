import { Download, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatTanggal } from "@/lib/utils";
import { deleteAnnouncement } from "@/modules/announcements/actions";
import {
  getAnnouncementsForAdmin,
  getNotificationSummary,
} from "@/modules/announcements/queries";
import { waMode } from "@/modules/notifications/mode";
import { getActiveYear, getClasses } from "@/modules/students/queries";
import { AnnouncementForm, BroadcastButton, SalinTeksButton } from "./forms";

export const metadata: Metadata = { title: "Pengumuman & Broadcast" };

const STATUS_LABEL: Record<string, string> = {
  queued: "Antre",
  sending: "Mengirim",
  sent: "Terkirim",
  failed: "Gagal (akan diulang)",
  dead: "Gagal permanen",
  skipped: "Dilewati admin",
};

export default async function AdminPengumumanPage() {
  const manual = waMode() === "manual";
  const activeYear = await getActiveYear();
  const [announcements, notif, classes] = await Promise.all([
    getAnnouncementsForAdmin(),
    getNotificationSummary(),
    activeYear ? getClasses(activeYear.id) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Pengumuman &amp; Broadcast</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buat pengumuman</CardTitle>
          <CardDescription>
            {manual
              ? "Mode manual (gateway WhatsApp belum aktif). Pengumuman tampil di aplikasi wali. Untuk WhatsApp: salin teksnya ke Daftar Siaran / grup sekolah, atau masukkan ke Kotak Keluar untuk dikirim satu per satu."
              : "Broadcast WhatsApp masuk antrean dan dikirim worker ber-throttle — tidak dikirim langsung saat tombol ditekan (PRD §7.3)."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AnnouncementForm
            classes={classes.map(({ id, label }) => ({ id, label }))}
            manual={manual}
          />
        </CardContent>
      </Card>

      {manual && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kirim ke banyak wali tanpa gateway</CardTitle>
            <CardDescription>
              1) Unduh kontak wali (.vcf) dan impor ke ponsel WhatsApp sekolah.
              2) Di WhatsApp: Daftar Siaran → buat daftar (maks. 256 kontak per
              daftar). 3) Tekan <strong>Salin teks</strong> pada pengumuman,
              tempel, kirim. Catatan: pesan siaran hanya diterima wali yang
              menyimpan nomor sekolah — minta wali menyimpannya.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <a
              href="/admin/pengumuman/kontak"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Download className="h-4 w-4" aria-hidden />
              Unduh kontak wali (.vcf)
            </a>
            <Link
              href="/admin/kotak-keluar"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Buka Kotak Keluar WA
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Daftar pengumuman ({announcements.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Judul</TableHead>
                <TableHead>Audiens</TableHead>
                <TableHead>Tayang</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {announcements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Belum ada pengumuman.
                  </TableCell>
                </TableRow>
              )}
              {announcements.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <p className="font-medium">{a.title}</p>
                    {a.body && (
                      <p className="line-clamp-1 text-xs text-muted-foreground">{a.body}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    {a.scope === "all" ? "Semua wali" : `${a.classCount} kelas`}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.publish_at ? formatTanggal(a.publish_at) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <SalinTeksButton
                        teks={`[Pengumuman] ${a.title}${a.body ? `\n${a.body}` : ""}`}
                      />
                      <BroadcastButton id={a.id} manual={manual} />
                      <form action={deleteAnnouncement}>
                        <input type="hidden" name="id" value={a.id} />
                        <button
                          type="submit"
                          aria-label={`Hapus ${a.title}`}
                          className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Antrean notifikasi WhatsApp</CardTitle>
          <CardDescription>
            {Object.entries(notif.counts)
              .map(([k, v]) => `${STATUS_LABEL[k] ?? k}: ${v}`)
              .join(" · ") || "Antrean kosong"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tujuan</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Pesan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Percobaan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notif.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Belum ada notifikasi.
                  </TableCell>
                </TableRow>
              )}
              {notif.rows.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="font-mono text-xs">{j.recipient_phone}</TableCell>
                  <TableCell className="text-xs">{j.template}</TableCell>
                  <TableCell className="max-w-sm">
                    <p className="line-clamp-2 text-xs text-muted-foreground">{j.body}</p>
                    {j.last_error && (
                      <p className="text-xs text-red-600 dark:text-red-400">{j.last_error}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {STATUS_LABEL[j.status] ?? j.status}
                  </TableCell>
                  <TableCell className="text-right text-xs">{j.attempts}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
