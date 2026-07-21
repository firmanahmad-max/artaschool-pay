"use client";

import {
  Bell,
  CalendarRange,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Megaphone,
  Receipt,
  ScrollText,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/verifikasi", label: "Antrean Verifikasi", icon: ClipboardCheck },
  { href: "/admin/tagihan", label: "Tagihan", icon: Receipt },
  { href: "/admin/siswa", label: "Siswa & Kelas", icon: Users },
  { href: "/admin/tahun-ajaran", label: "Tahun Ajaran", icon: CalendarRange },
  { href: "/admin/pengumuman", label: "Pengumuman", icon: Megaphone },
  { href: "/admin/laporan", label: "Laporan", icon: FileText },
  { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
];

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin_keuangan: "Admin Keuangan",
  operator: "Operator",
  kepala_sekolah: "Kepala Sekolah",
  viewer: "Viewer",
};

/** Shell dashboard admin: sidebar desktop-first + header (ThemeToggle, profil, keluar). */
export function AdminShell({
  children,
  adminName,
  adminRole,
  logoutSlot,
}: {
  children: React.ReactNode;
  adminName: string;
  adminRole: string;
  logoutSlot: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            A
          </span>
          <span className="font-semibold">ArtaSchool Pay</span>
        </div>
        <nav aria-label="Menu admin" className="flex-1 space-y-1 p-3">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-background hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-3 border-b border-border bg-surface px-6">
          <h1 className="text-sm font-medium text-muted-foreground lg:hidden">
            ArtaSchool Pay — Admin
          </h1>
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              aria-label="Notifikasi"
              className="rounded-md p-2 text-muted-foreground hover:text-foreground"
            >
              <Bell className="h-5 w-5" aria-hidden />
            </button>
            <ThemeToggle />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{adminName}</p>
              <p className="text-xs text-muted-foreground">
                {ROLE_LABEL[adminRole] ?? adminRole}
              </p>
            </div>
            {logoutSlot}
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
