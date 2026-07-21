import { ParentShell } from "@/components/parent-shell";
import { requireGuardian } from "@/modules/auth/guards";

/** Guard sesi wali di server, lalu render shell client (bottom nav). */
export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireGuardian();
  return <ParentShell>{children}</ParentShell>;
}
