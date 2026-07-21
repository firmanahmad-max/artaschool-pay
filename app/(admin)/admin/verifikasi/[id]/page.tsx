import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, type PaymentStatus } from "@/components/ui/status-badge";
import { formatRupiah, formatTanggal } from "@/lib/utils";
import { requireAdmin } from "@/modules/auth/guards";
import { getPaymentDetail, proposeAllocations } from "@/modules/verification/queries";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "Periksa Pembayaran" };

export default async function PeriksaPembayaranPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin(); // semua role admin boleh MELIHAT; aksi dibatasi RPC
  const detail = await getPaymentDetail(params.id);
  if (!detail) notFound();

  const { proposal, leftover } = proposeAllocations(detail.amount, detail.openBills);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/verifikasi"
          className="text-muted-foreground hover:text-foreground"
          aria-label="Kembali ke antrean"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <h1 className="text-xl font-semibold">
          {detail.studentName}{" "}
          <span className="text-base font-normal text-muted-foreground">
            · {formatRupiah(detail.amount)}
          </span>
        </h1>
        <StatusBadge status={detail.status as PaymentStatus} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {/* Bukti transfer — selalu backdrop putih, tidak di-invert (PRD §7.4) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bukti transfer</CardTitle>
              <CardDescription>
                Tautan aman berlaku 5 menit — muat ulang halaman bila kedaluwarsa.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!detail.proofUrl ? (
                <p className="text-sm text-muted-foreground">
                  Tidak ada berkas bukti (mis. input tunai oleh admin).
                </p>
              ) : detail.isPdf ? (
                <a
                  href={detail.proofUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  Buka bukti PDF di tab baru
                </a>
              ) : (
                <a href={detail.proofUrl} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={detail.proofUrl}
                    alt={`Bukti transfer ${detail.studentName}`}
                    className="max-h-[480px] rounded-md border border-border bg-white object-contain p-2"
                  />
                </a>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detail kiriman</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Siswa</dt>
                <dd>
                  {detail.studentName} ({detail.nis}) · {detail.classLabel}
                </dd>
                <dt className="text-muted-foreground">Dikirim oleh</dt>
                <dd>
                  {detail.guardianName}
                  {detail.guardianPhone ? ` · ${detail.guardianPhone}` : ""}
                </dd>
                <dt className="text-muted-foreground">Nominal</dt>
                <dd className="font-medium">{formatRupiah(detail.amount)}</dd>
                <dt className="text-muted-foreground">Metode</dt>
                <dd>{detail.method}</dd>
                <dt className="text-muted-foreground">Bank tujuan</dt>
                <dd>{detail.bank_name ?? "—"}</dd>
                <dt className="text-muted-foreground">Nama pengirim</dt>
                <dd>{detail.sender_name ?? "—"}</dd>
                <dt className="text-muted-foreground">Tanggal transfer</dt>
                <dd>{detail.transferred_at ? formatTanggal(detail.transferred_at) : "—"}</dd>
                <dt className="text-muted-foreground">Masuk sistem</dt>
                <dd>{detail.created_at ? formatTanggal(detail.created_at) : "—"}</dd>
              </dl>
              {detail.review_note && (
                <p className="mt-3 rounded-md bg-background p-3 text-sm">
                  <span className="text-muted-foreground">Catatan review: </span>
                  {detail.review_note}
                </p>
              )}
            </CardContent>
          </Card>

          {detail.status === "pending" ? (
            <VerifyForm
              paymentId={detail.id}
              amount={detail.amount}
              bills={detail.openBills}
              proposal={proposal}
              leftover={leftover}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sudah diproses</CardTitle>
                <CardDescription>
                  Pembayaran ini tidak lagi berstatus Menunggu — tidak ada aksi
                  yang tersedia.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>

        {/* Riwayat siswa di sisi kanan (PRD §7.2) */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Riwayat pembayaran siswa</CardTitle>
            <CardDescription>5 kiriman terakhir selain yang sedang diperiksa.</CardDescription>
          </CardHeader>
          <CardContent>
            {detail.history.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada riwayat lain untuk siswa ini.
              </p>
            ) : (
              <ul className="space-y-3">
                {detail.history.map((h) => (
                  <li key={h.id} className="rounded-md border border-border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{formatRupiah(h.amount)}</span>
                      <StatusBadge status={h.status as PaymentStatus} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {h.created_at ? formatTanggal(h.created_at) : "—"}
                    </p>
                    {h.review_note && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Catatan: {h.review_note}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
