import { cn } from "@/lib/utils";

/**
 * Grafik ringan berbasis SVG — sengaja tanpa pustaka chart agar bundle kecil
 * dan warna murni mengikuti token tema (PRD §7.4: grafik ikut tema, tidak
 * hardcode hex).
 */

export function BarChart30({
  data,
  className,
}: {
  data: { date: string; count: number }[];
  className?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex h-32 items-end gap-1" role="img" aria-label="Grafik upload 30 hari terakhir">
        {data.map((d) => (
          <div
            key={d.date}
            className="group relative flex-1 rounded-t bg-primary/80 transition-colors hover:bg-primary"
            style={{ height: `${Math.max(2, (d.count / max) * 100)}%` }}
            title={`${d.date}: ${d.count} upload`}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{data[0]?.date.slice(5) ?? ""}</span>
        <span>puncak {max}/hari</span>
        <span>{data[data.length - 1]?.date.slice(5) ?? ""}</span>
      </div>
    </div>
  );
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: "Menunggu", className: "text-amber-500" },
  approved: { label: "Disetujui", className: "text-emerald-500" },
  rejected: { label: "Ditolak", className: "text-red-500" },
  needs_revision: { label: "Perlu Revisi", className: "text-orange-500" },
  draft: { label: "Draft", className: "text-muted-foreground" },
};

/** Donut status — `currentColor` per segmen agar ikut tema. */
export function StatusDonut({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts).filter(([, v]) => v > 0);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);

  if (total === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada pembayaran.</p>;
  }

  const R = 60;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 160 160" className="h-36 w-36 -rotate-90" role="img" aria-label="Komposisi status pembayaran">
        {entries.map(([status, count]) => {
          const len = (count / total) * C;
          const seg = (
            <circle
              key={status}
              cx="80"
              cy="80"
              r={R}
              fill="none"
              strokeWidth="20"
              stroke="currentColor"
              className={STATUS_META[status]?.className ?? "text-muted-foreground"}
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return seg;
        })}
      </svg>
      <ul className="space-y-1.5 text-sm">
        {entries.map(([status, count]) => (
          <li key={status} className="flex items-center gap-2">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full bg-current",
                STATUS_META[status]?.className ?? "text-muted-foreground",
              )}
              aria-hidden
            />
            <span>{STATUS_META[status]?.label ?? status}</span>
            <span className="text-muted-foreground">{count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
