import type { Metadata } from "next";
import Link from "next/link";
import { ParentLoginForm } from "./parent-login-form";

export const metadata: Metadata = { title: "Masuk" };

export default function LoginPage() {
  return (
    <div className="space-y-4">
      <ParentLoginForm />
      <p className="text-center text-sm text-muted-foreground">
        Staf sekolah?{" "}
        <Link href="/admin/login" className="text-primary underline-offset-4 hover:underline">
          Masuk sebagai admin
        </Link>
      </p>
    </div>
  );
}
