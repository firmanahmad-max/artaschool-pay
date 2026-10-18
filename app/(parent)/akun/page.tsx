import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DeleteAccountSection } from "@/components/delete-account";
import { EditProfileForm } from "@/components/edit-profile-form";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PinForm } from "@/components/pin-form";
import { createClient } from "@/lib/supabase/server";
import { requireGuardian } from "@/modules/auth/guards";
import { getGuardianChildren } from "@/modules/payments/queries";

export const metadata: Metadata = { title: "Akun" };

export default async function AkunPage() {
  const guardian = await requireGuardian();
  const [children, { data: punyaPin }] = await Promise.all([
    getGuardianChildren(guardian.id),
    createClient().rpc("my_pin_is_set"),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Akun</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profil</CardTitle>
          <CardDescription>
            Perbarui nama dan email Anda kapan saja.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <EditProfileForm
            fullName={guardian.full_name}
            email={guardian.email}
            phone={guardian.phone}
          />
          <div className="border-t border-border pt-4">
            <LogoutButton target="parent" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">PIN Masuk</CardTitle>
          <CardDescription>
            {punyaPin
              ? "Ubah PIN 6 angka yang Anda pakai untuk masuk."
              : "Buat PIN 6 angka agar bisa masuk dengan nomor HP + PIN."}{" "}
            Lupa PIN? Minta kode aktivasi baru ke sekolah.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PinForm punyaPin={!!punyaPin} />
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
            Anak yang tertaut ke akun Anda. Untuk perubahan, hubungi sekolah.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {children.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada anak yang tertaut. Hubungi pihak sekolah bila ini
              keliru.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {children.map((child) => (
                <li
                  key={child.id}
                  className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {child.full_name}
                      {!child.is_active && (
                        <span className="ml-2 rounded bg-border px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                          nonaktif
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      NIS {child.nis} · {child.relation}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {child.classLabel}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
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
