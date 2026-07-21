import { Megaphone } from "lucide-react";
import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { formatTanggal } from "@/lib/utils";
import { getAnnouncementsForGuardian } from "@/modules/announcements/queries";
import { requireGuardian } from "@/modules/auth/guards";

export const metadata: Metadata = { title: "Pengumuman" };

export default async function PengumumanPage() {
  const guardian = await requireGuardian();
  const items = await getAnnouncementsForGuardian(guardian.id);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Pengumuman</h1>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Belum ada pengumuman dari sekolah.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {items.map((a) => (
            <li key={a.id}>
              <Card>
                <CardContent className="space-y-1 p-4">
                  <div className="flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-primary" aria-hidden />
                    <p className="font-medium">{a.title}</p>
                  </div>
                  {a.body && <p className="text-sm text-muted-foreground">{a.body}</p>}
                  {a.publish_at && (
                    <p className="text-xs text-muted-foreground">
                      {formatTanggal(a.publish_at)}
                    </p>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
