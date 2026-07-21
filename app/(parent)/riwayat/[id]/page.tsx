import { ArrowLeft, CheckCircle2, Clock, RotateCcw, Send, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, type PaymentStatus } from "@/components/ui/status-badge";
import { cn, formatRupiah, formatTanggal } from "@/lib/utils";
import { requireGuardian } from "@/modules/auth/guards";
import { getParentPaymentDetail } from "@/modules/payments/queries";

export const metadata: Metadata = { title: "Detail Pembayaran" };

export default async function DetailPembayaranPage({
  params,
}: {
  params: { id: string };
}) {
  await requireGuardian();
  const p = await getParentPaymentDetail(params.id);
  if (!p) notFound();

  // Timeline status sederhana: dikirim → hasil review (bila ada)
  const timeline: { icon: typeof Send; label: string; date: string | null }[] = [
    { icon: Send, label: "Bukti dikirim", date: p.created_at },
  ];
  if (p.status === "pending") {
    timeline.push({ icon: Clock, label: "Menunggu verifikasi admin", date: null });
  } else if (p.status === "approved") {
    timeline.push({ icon: CheckCircle2, label: "Disetujui — alokasi dieksekusi", date: p.reviewed_at });
  } else if (p.status === "rejected") {
    timeline.push({ icon: XCircle, label: "Ditolak", date: p.reviewed_at });
  } else if (p.status === "needs_revision") {
    timeline.push({ icon: RotateCcw, label: "Diminta revisi", date: p.reviewed_at });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/riwayat"
          className="text-muted-foreground hover:text-foreground"
          aria-label="Kembali ke riwayat"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <h1 className="text-xl font-semibold">{formatRupiah(p.amount)}</h1>
        <StatusBadge status={p.status as PaymentStatus} />
      </div>

      {p.revision_of && (
        <p className="rounded-md bg-background px-3 py-2 text-xs text-muted-foreground">
          Kiriman ulang (revisi dari kiriman sebelumnya).
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {timeline.map(({ icon: Icon, label, date }) => (
              <li key={label} className="flex items-start gap-3 text-sm">
                <Icon className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
                <div>
                  <p className="font-medium">{label}</p>
                  {date && (
                    <p className="text-xs text-muted-foreground">{formatTanggal(date)}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {p.review_note && (
            <p className="mt-3 rounded-md bg-background p-3 text-sm">
              <span className="text-muted-foreground">Catatan admin: </span>
              {p.review_note}
            </p>
          )}
          {p.status === "needs_revision" && (
            <Link
              href={`/upload?revisi=${p.id}`}
              className={cn(buttonVariants(), "mt-3 w-full")}
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Kirim Ulang
            </Link>
          )}
        </CardContent>
      </Card>

      {p.allocations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dialokasikan ke tagihan</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {p.allocations.map((a) => (
                <li
                  key={a.label}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span>{a.label}</span>
                  <span className="font-medium">{formatRupiah(a.amount)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detail</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Anak</dt>
            <dd>
              {p.studentName} ({p.nis})
            </dd>
            <dt className="text-muted-foreground">Metode</dt>
            <dd>{p.method}</dd>
            <dt className="text-muted-foreground">Bank tujuan</dt>
            <dd>{p.bank_name ?? "—"}</dd>
            <dt className="text-muted-foreground">Pengirim</dt>
            <dd>{p.sender_name ?? "—"}</dd>
            <dt className="text-muted-foreground">Tanggal transfer</dt>
            <dd>{p.transferred_at ? formatTanggal(p.transferred_at) : "—"}</dd>
          </dl>
        </CardContent>
      </Card>

      {p.proofUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bukti transfer</CardTitle>
          </CardHeader>
          <CardContent>
            {p.isPdf ? (
              <a
                href={p.proofUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                Buka bukti PDF
              </a>
            ) : (
              // Bukti selalu backdrop putih, tidak di-invert (PRD §7.4)
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.proofUrl}
                alt="Bukti transfer"
                className="max-h-80 rounded-md border border-border bg-white object-contain p-2"
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
