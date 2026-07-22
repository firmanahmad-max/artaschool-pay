import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requireAdminBasic } from "@/modules/auth/guards";
import { MfaActive, MfaEnroll } from "./enroll";

export const metadata: Metadata = { title: "Keamanan Akun" };

export default async function KeamananPage({
  searchParams,
}: {
  searchParams: { wajib?: string };
}) {
  const admin = await requireAdminBasic();
  const supabase = createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp?.find((f) => f.status === "verified");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Keamanan Akun</CardTitle>
        <CardDescription>
          {admin.full_name} · verifikasi dua langkah (2FA)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {verified ? (
          <MfaActive factorId={verified.id} />
        ) : (
          <MfaEnroll wajib={searchParams.wajib === "1"} />
        )}
        <p className="text-center text-sm">
          <Link href="/admin" className="text-primary underline-offset-4 hover:underline">
            Kembali ke dashboard
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
