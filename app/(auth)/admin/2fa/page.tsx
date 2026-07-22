import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoutButton } from "@/components/logout-button";
import { requireAdminBasic } from "@/modules/auth/guards";
import { MfaVerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "Verifikasi 2FA" };

export default async function Admin2faPage() {
  const admin = await requireAdminBasic();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
          Verifikasi Dua Langkah
        </CardTitle>
        <CardDescription>
          Masuk sebagai {admin.full_name}. Masukkan kode 6 angka dari aplikasi
          authenticator Anda.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <MfaVerifyForm />
        <div className="flex justify-center">
          <LogoutButton target="admin" label="Masuk akun lain" />
        </div>
      </CardContent>
    </Card>
  );
}
