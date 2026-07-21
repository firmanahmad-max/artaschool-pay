import type { Metadata } from "next";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
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
    </div>
  );
}
