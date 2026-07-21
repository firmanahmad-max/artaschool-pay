import type { Metadata } from "next";
import Link from "next/link";
import { AdminLoginForm } from "./admin-login-form";

export const metadata: Metadata = { title: "Masuk Admin" };

export default function AdminLoginPage() {
  return (
    <div className="space-y-4">
      <AdminLoginForm />
      <p className="text-center text-sm text-muted-foreground">
        Orang tua / wali?{" "}
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          Masuk di sini
        </Link>
      </p>
    </div>
  );
}
