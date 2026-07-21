"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAdmin } from "@/modules/auth/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Memproses…" : "Masuk"}
    </Button>
  );
}

export function AdminLoginForm() {
  const [state, action] = useFormState(loginAdmin, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Masuk Admin Sekolah</CardTitle>
        <CardDescription>
          Gunakan akun yang diberikan super admin sekolah Anda.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="nama@sekolah.sch.id"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Kata Sandi</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {state && !state.ok && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {state.error}
            </p>
          )}
          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
