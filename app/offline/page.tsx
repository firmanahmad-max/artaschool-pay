import { WifiOff } from "lucide-react";
import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Tidak Ada Koneksi" };

/** Ditampilkan service worker saat halaman diminta tetapi perangkat offline. */
export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <WifiOff className="h-12 w-12 text-muted-foreground" aria-hidden />
          <p className="font-medium">Tidak ada koneksi internet</p>
          <p className="text-sm text-muted-foreground">
            Halaman yang pernah Anda buka masih bisa dilihat. Untuk mengirim
            bukti pembayaran, sambungkan kembali internet Anda.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
