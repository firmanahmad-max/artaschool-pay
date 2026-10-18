import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/modules/auth/guards";
import { waMode } from "@/modules/notifications/mode";
import { getKotakKeluar } from "@/modules/notifications/queries";
import { tautanWa } from "@/modules/notifications/wa-link";
import { OutboxRow } from "./outbox-row";

export const metadata: Metadata = { title: "Kotak Keluar WA" };

// Tanggal & jam dalam SATU zona (WITA, sama dgn jadwal digest) — memakai
// formatTanggal (zona server/UTC) + jam WITA bisa beda hari menjelang tengah malam.
const WAKTU = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Makassar",
});

export default async function KotakKeluarPage() {
  await requireAdmin(["super_admin", "admin_keuangan", "operator"]);
  const mode = waMode();
  const items = await getKotakKeluar();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Kotak Keluar WA</h1>
        <p className="text-sm text-muted-foreground">
          {mode === "manual"
            ? "Mode manual: gateway WhatsApp belum aktif. Kirim tiap pesan dari WhatsApp sekolah, lalu tandai terkirim."
            : "Gateway WhatsApp aktif — pesan terkirim otomatis. Di sini hanya pesan yang gagal permanen, untuk dikirim manual."}
        </p>
      </div>

      {mode === "manual" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cara kerja</CardTitle>
            <CardDescription>
              1) Tekan <strong>Buka WhatsApp</strong> — pesan sudah terisi untuk
              nomor tujuan. 2) Tekan Kirim di WhatsApp. 3) Kembali ke sini, tekan{" "}
              <strong>Tandai terkirim</strong>. Pakai satu nomor WhatsApp sekolah
              yang sama agar wali mengenali pengirimnya. Pengumuman untuk semua
              wali lebih praktis lewat daftar siaran (lihat halaman Pengumuman).
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {items.length === 0
              ? "Tidak ada pesan menunggu"
              : `${items.length} pesan menunggu (terlama di atas)`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Semua pesan sudah diproses. 🎉</p>
          ) : (
            <ul className="space-y-3">
              {items.map((j) => (
                <OutboxRow
                  key={j.id}
                  item={{
                    ...j,
                    waktu: j.createdAt
                      ? `${WAKTU.format(new Date(j.createdAt))} WITA`
                      : "—",
                    tautan: tautanWa(j.phone, j.body),
                  }}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
