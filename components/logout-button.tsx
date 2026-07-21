import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/modules/auth/actions";

/** Tombol keluar (server component — memanggil Server Action logout). */
export function LogoutButton({
  target,
  label = "Keluar",
}: {
  target: "parent" | "admin";
  label?: string;
}) {
  const logoutWithTarget = logout.bind(null, target);
  return (
    <form action={logoutWithTarget}>
      <Button variant="outline" size="sm" type="submit">
        <LogOut className="h-4 w-4" aria-hidden />
        {label}
      </Button>
    </form>
  );
}
