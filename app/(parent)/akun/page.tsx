import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DeleteAccountSection } from "@/components/delete-account";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireGuardian } from "@/modules/auth/guards";

export const metadata: Metadata = { title: "Akun" };

export default async function AkunPage() {
  const guardian = await requireGuardian();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Akun</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{guardian.full_name}</CardTitle>
          <CardDescription>{guardian.phone}</CardDescription>
        </CardHeader>
        <CardContent>
          <LogoutButton target="parent" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tampilan</CardTitle>
          <CardDescription>
            Pilih tema aplikasi. &quot;Sistem&quot; mengikuti pengaturan
            perangkat.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Anak Terhubung</CardTitle>
          <CardDescription>
            Daftar anak dan kelasnya — hadir di Sprint 3 (master data siswa).
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data Pribadi</CardTitle>
          <CardDescription>
            Unduh salinan data yang sekolah simpan tentang Anda (profil, anak
            terhubung, dan riwayat pembayaran) dalam berkas JSON.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <a
            href="/akun/ekspor"
            download
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Download className="h-4 w-4" aria-hidden />
            Unduh data saya
          </a>
          <p className="text-sm text-muted-foreground">
            Pelajari{" "}
            <Link
              href="/privasi"
              className="text-primary underline-offset-4 hover:underline"
            >
              Kebijakan Privasi &amp; Data
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hapus Akun</CardTitle>
          <CardDescription>
            Hak Anda menghapus data pribadi (UU PDP). Riwayat pembayaran tetap
            disimpan sekolah untuk pembukuan, tanpa identitas Anda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountSection />
        </CardContent>
      </Card>
    </div>
  );
}
