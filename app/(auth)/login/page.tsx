import type { Metadata } from "next";
import Link from "next/link";
import { otpWaTersedia } from "@/modules/notifications/mode";
import { ParentLoginForm } from "./parent-login-form";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ dihapus?: string; aktivasi?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  return (
    <div className="space-y-4">
      {searchParams.dihapus === "1" && (
        <p
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          Akun Anda telah dihapus. Terima kasih.
        </p>
      )}
      <ParentLoginForm
        otpTersedia={otpWaTersedia()}
        awal={searchParams.aktivasi === "1" ? "aktivasi" : "pin"}
      />
      <p className="text-center text-sm text-muted-foreground">
        Staf sekolah?{" "}
        <Link href="/admin/login" className="text-primary underline-offset-4 hover:underline">
          Masuk sebagai admin
        </Link>
      </p>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/privasi" className="underline-offset-4 hover:underline">
          Kebijakan Privasi &amp; Data
        </Link>
      </p>
    </div>
  );
}
