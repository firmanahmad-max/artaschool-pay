"use client";

import { History, Home, Megaphone, Upload, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/beranda", label: "Beranda", icon: Home },
  { href: "/riwayat", label: "Riwayat", icon: History },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/pengumuman", label: "Pengumuman", icon: Megaphone },
  { href: "/akun", label: "Akun", icon: User },
];

/** Shell PWA orang tua: mobile-first + bottom navigation (PRD §7.1). */
export function ParentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <main className="flex-1 px-4 pb-24 pt-6">{children}</main>

      <nav
        aria-label="Navigasi utama"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface"
      >
        <div className="mx-auto grid max-w-md grid-cols-5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px]",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
