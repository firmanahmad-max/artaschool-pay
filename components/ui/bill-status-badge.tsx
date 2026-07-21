import { Ban, CircleDollarSign, CircleSlash, Clock, HandCoins } from "lucide-react";
import { cn } from "@/lib/utils";

type LucideIcon = typeof Clock;

/** Badge status tagihan — ikon + label, kontras AA di kedua tema (PRD §7.4). */
const STATUS: Record<string, { label: string; icon: LucideIcon; className: string }> = {
  unpaid: {
    label: "Belum Bayar",
    icon: Clock,
    className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  partial: {
    label: "Sebagian",
    icon: HandCoins,
    className: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  paid: {
    label: "Lunas",
    icon: CircleDollarSign,
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  waived: {
    label: "Dibebaskan",
    icon: CircleSlash,
    className: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  cancelled: {
    label: "Dibatalkan",
    icon: Ban,
    className: "bg-border text-muted-foreground",
  },
};

export function BillStatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.unpaid!;
  const Icon = s.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        s.className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {s.label}
    </span>
  );
}
