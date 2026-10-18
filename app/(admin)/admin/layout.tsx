import { AdminShell } from "@/components/admin-shell";
import { LogoutButton } from "@/components/logout-button";
import { requireAdmin } from "@/modules/auth/guards";
import { countKotakKeluar } from "@/modules/notifications/queries";

/** Peran yang boleh mengelola Kotak Keluar WA (sama dgn RPC 020). */
const OUTBOX_ROLES = ["super_admin", "admin_keuangan", "operator"];

/** Guard sesi admin di server, lalu render shell client (sidebar + header). */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();
  const kotakKeluar = OUTBOX_ROLES.includes(admin.role) ? await countKotakKeluar() : 0;
  return (
    <AdminShell
      adminName={admin.full_name}
      adminRole={admin.role}
      logoutSlot={<LogoutButton target="admin" />}
      kotakKeluar={kotakKeluar}
    >
      {children}
    </AdminShell>
  );
}
