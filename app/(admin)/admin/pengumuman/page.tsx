import { Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatTanggal } from "@/lib/utils";
import { deleteAnnouncement } from "@/modules/announcements/actions";
import {
  getAnnouncementsForAdmin,
  getNotificationSummary,
} from "@/modules/announcements/queries";
import { getActiveYear, getClasses } from "@/modules/students/queries";
import { AnnouncementForm, BroadcastButton } from "./forms";

export const metadata: Metadata = { title: "Pengumuman & Broadcast" };

const STATUS_LABEL: Record<string, string> = {
  queued: "Antre",
  sending: "Mengirim",
  sent: "Terkirim",
  failed: "Gagal (akan diulang)",
  dead: "Gagal permanen",
};

export default async function AdminPengumumanPage() {
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
            Broadcast WhatsApp masuk antrean dan dikirim worker ber-throttle —
            tidak dikirim langsung saat tombol ditekan (PRD §7.3).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AnnouncementForm classes={classes.map(({ id, label }) => ({ id, label }))} />
        </CardContent>
      </Card>

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
                      <BroadcastButton id={a.id} />
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
