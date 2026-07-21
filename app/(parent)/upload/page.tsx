import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireGuardian } from "@/modules/auth/guards";
import {
  getChildrenWithBills,
  getPaymentForResubmit,
  getSchoolBankAccounts,
} from "@/modules/payments/queries";
import { UploadForm } from "./upload-form";

export const metadata: Metadata = { title: "Upload Pembayaran" };

export default async function UploadPage({
  searchParams,
}: {
  searchParams: { anak?: string; revisi?: string };
}) {
  const guardian = await requireGuardian();
  const [children, bankAccounts, resubmit] = await Promise.all([
    getChildrenWithBills(guardian.id),
    getSchoolBankAccounts(),
    searchParams.revisi
      ? getPaymentForResubmit(searchParams.revisi)
      : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">
        {resubmit ? "Kirim Ulang Pembayaran" : "Upload Pembayaran"}
      </h1>
      {resubmit && (
        <p className="rounded-md bg-orange-100 px-3 py-2 text-sm text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
          Form sudah terisi dari kiriman sebelumnya — perbaiki sesuai catatan
          admin lalu lampirkan bukti yang benar.
        </p>
      )}
      {children.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Belum ada anak terhubung</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Hubungi pihak sekolah untuk menautkan data anak.
            </p>
          </CardContent>
        </Card>
      ) : (
        <UploadForm
          students={children.map((c) => ({
            id: c.id,
            full_name: c.full_name,
            classLabel: c.classLabel,
            bills: c.bills.map((b) => ({
              id: b.id,
              label: `${b.typeName}${b.period ? " " + b.period.slice(0, 7) : ""}`,
              remaining: b.remaining,
            })),
          }))}
          bankAccounts={bankAccounts}
          preselectedChildId={resubmit?.student_id ?? searchParams.anak}
          revision={
            resubmit
              ? {
                  paymentId: resubmit.id,
                  billIds: resubmit.requested_bill_ids,
                  amount: resubmit.amount,
                  senderName: resubmit.sender_name ?? "",
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
