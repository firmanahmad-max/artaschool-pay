import { AdminShell } from "@/components/admin-shell";
import { LogoutButton } from "@/components/logout-button";
import { requireAdmin } from "@/modules/auth/guards";

/** Guard sesi admin di server, lalu render shell client (sidebar + header). */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();
  return (
    <AdminShell
      adminName={admin.full_name}
      adminRole={admin.role}
      logoutSlot={<LogoutButton target="admin" />}
    >
      {children}
    </AdminShell>
  );
}
