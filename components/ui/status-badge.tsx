import {
  CheckCircle2,
  Clock,
  RotateCcw,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type PaymentStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "needs_revision";

/**
 * Badge status pembayaran — kontras AA di kedua tema, selalu ikon + label,
 * tidak pernah warna saja (PRD §7.4 & §8 aksesibilitas).
 * Label id-ID sesuai CONTEXT.md Konvensi #5.
 */
const STATUS: Record<
  PaymentStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  pending: {
    label: "Menunggu",
    icon: Clock,
    className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  approved: {
    label: "Disetujui",
    icon: CheckCircle2,
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  rejected: {
    label: "Ditolak",
    icon: XCircle,
    className: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  },
  needs_revision: {
    label: "Perlu Revisi",
    icon: RotateCcw,
    className:
      "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  },
};

export function StatusBadge({
  status,
  className,
}: {
  status: PaymentStatus;
  className?: string;
}) {
  const { label, icon: Icon, className: statusClass } = STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        statusClass,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  );
}
