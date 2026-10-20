"use client";

import {
  Bell,
  CalendarRange,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Receipt,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

/** Peran yang boleh mengirim pesan dari Kotak Keluar (sama dgn RPC 020). */
const OUTBOX_ROLES = ["super_admin", "admin_keuangan", "operator"];

const NAV: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  roles?: string[];
  badge?: boolean;
}[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/verifikasi", label: "Antrean Verifikasi", icon: ClipboardCheck },
  { href: "/admin/tagihan", label: "Tagihan", icon: Receipt },
  { href: "/admin/siswa", label: "Siswa & Kelas", icon: Users },
  { href: "/admin/tahun-ajaran", label: "Tahun Ajaran", icon: CalendarRange },
  { href: "/admin/pengumuman", label: "Pengumuman", icon: Megaphone },
  {
    href: "/admin/kotak-keluar",
    label: "Kotak Keluar WA",
    icon: MessageCircle,
    roles: OUTBOX_ROLES,
    badge: true,
  },
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
  kotakKeluar = 0,
}: {
  children: React.ReactNode;
  adminName: string;
  adminRole: string;
  logoutSlot: React.ReactNode;
  /** Jumlah pesan WA menunggu tindakan (lencana). */
  kotakKeluar?: number;
}) {
  const bolehOutbox = OUTBOX_ROLES.includes(adminRole);
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
          {NAV.filter((n) => !n.roles || n.roles.includes(adminRole)).map(
            ({ href, label, icon: Icon, exact, badge }) => {
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
                {badge && kotakKeluar > 0 && (
                  <span className="ml-auto rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-amber-950">
                    {kotakKeluar}
                  </span>
                )}
              </Link>
            );
            },
          )}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-3 border-b border-border bg-surface px-6">
          <h1 className="text-sm font-medium text-muted-foreground lg:hidden">
            ArtaSchool Pay — Admin
          </h1>
          <div className="ml-auto flex items-center gap-3">
            {bolehOutbox && (
              <Link
                href="/admin/kotak-keluar"
                aria-label={`Kotak Keluar WA: ${kotakKeluar} pesan menunggu`}
                title="Kotak Keluar WA"
                className="relative rounded-md p-2 text-muted-foreground hover:text-foreground"
              >
                <Bell className="h-5 w-5" aria-hidden />
                {kotakKeluar > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 min-w-[1.25rem] rounded-full bg-amber-500 px-1 text-center text-[0.65rem] font-semibold leading-5 text-amber-950">
                    {kotakKeluar > 99 ? "99+" : kotakKeluar}
                  </span>
                )}
              </Link>
            )}
            <ThemeToggle />
            <Link
              href="/admin/keamanan"
              aria-label="Keamanan akun"
              title="Keamanan akun (2FA)"
              className="rounded-md p-2 text-muted-foreground hover:text-foreground"
            >
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </Link>
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
