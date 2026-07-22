import type { Metadata } from "next";
import { BillStatusBadge } from "@/components/ui/bill-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRupiah, formatTanggal } from "@/lib/utils";
import { setPaymentTypeActive, unwaiveBill } from "@/modules/billing/actions";
import {
  getActiveStudentsForSelect,
  getArrearsByClass,
  getBills,
  getOpenBillsForStudent,
  getPaymentTypes,
} from "@/modules/billing/queries";
import { getActiveYear, getClasses } from "@/modules/students/queries";
import { CashPaymentForm } from "./cash-form";
import {
  GenerateBillsForm,
  IndividualBillForm,
  PaymentTypeForm,
  WaiveBillForm,
} from "./forms";

export const metadata: Metadata = { title: "Tagihan" };

const STATUS_OPTIONS = [
  { value: "", label: "Semua status" },
  { value: "unpaid", label: "Belum Bayar" },
  { value: "partial", label: "Sebagian" },
  { value: "paid", label: "Lunas" },
  { value: "waived", label: "Dibebaskan" },
];

export default async function TagihanPage({
  searchParams,
}: {
  searchParams: { status?: string; kelas?: string; jenis?: string; tunai?: string };
}) {
  const activeYear = await getActiveYear();
  const [types, students, classes, arrears, bills] = await Promise.all([
    getPaymentTypes(),
    getActiveStudentsForSelect(),
    activeYear ? getClasses(activeYear.id) : Promise.resolve([]),
    getArrearsByClass(),
    getBills({
      status: searchParams.status || undefined,
      classId: searchParams.kelas || undefined,
      paymentTypeId: searchParams.jenis || undefined,
    }),
  ]);

  const activeTypes = types.filter((t) => t.is_active);
  const totalArrears = arrears.reduce((sum, a) => sum + a.total, 0);

  const cashStudent = searchParams.tunai
    ? students.find((s) => s.id === searchParams.tunai)
    : undefined;
  const cashBills = cashStudent ? await getOpenBillsForStudent(cashStudent.id) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tagihan</h1>
        <p className="text-sm text-muted-foreground">
          Tahun ajaran aktif: <span className="font-medium">{activeYear?.name ?? "—"}</span>
        </p>
      </div>

      {/* Tunggakan per kelas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Tunggakan per kelas — total {formatRupiah(totalArrears)}
          </CardTitle>
          <CardDescription>
            Tagihan belum/sebagian dibayar pada tahun ajaran aktif.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {arrears.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada tunggakan. 🎉</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {arrears.map((a) => (
                <div
                  key={a.classId || "none"}
                  className="rounded-lg border border-border bg-background px-4 py-3"
                >
                  <p className="text-sm font-medium">{a.classLabel}</p>
                  <p className="text-lg font-semibold">{formatRupiah(a.total)}</p>
                  <p className="text-xs text-muted-foreground">{a.count} tagihan</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Jenis pembayaran */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Jenis pembayaran</CardTitle>
          <CardDescription>
            SPP (berulang/bulanan), Daftar Ulang, Buku Paket, dll.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {types.length === 0 && (
              <p className="text-sm text-muted-foreground">Belum ada jenis pembayaran.</p>
            )}
            {types.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
              >
                <span className="font-medium">{t.name}</span>
                <span className="text-muted-foreground">
                  {formatRupiah(t.default_amount ?? 0)}
                  {t.is_recurring ? " · bulanan" : ""}
                </span>
                <form action={setPaymentTypeActive} className="inline-flex">
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="active" value={String(!t.is_active)} />
                  <button
                    type="submit"
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  >
                    {t.is_active ? "nonaktifkan" : "aktifkan"}
                  </button>
                </form>
              </span>
            ))}
          </div>
          <PaymentTypeForm />
        </CardContent>
      </Card>

      {/* Generate massal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generate tagihan massal</CardTitle>
          <CardDescription>
            Membuat tagihan untuk semua siswa aktif sekaligus. Aman diulang —
            tidak menduplikasi tagihan yang sudah ada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GenerateBillsForm types={activeTypes} />
        </CardContent>
      </Card>

      {/* Tagihan individual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tagihan individual</CardTitle>
          <CardDescription>Untuk kasus khusus satu siswa.</CardDescription>
        </CardHeader>
        <CardContent>
          <IndividualBillForm types={activeTypes} students={students} />
        </CardContent>
      </Card>

      {/* Pembayaran tunai / QRIS (K5) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pembayaran tunai / QRIS</CardTitle>
          <CardDescription>
            Uang diterima langsung di sekolah — langsung tercatat lunas tanpa
            melewati antrean verifikasi.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form method="get" className="flex flex-wrap items-end gap-3">
            {/* pertahankan filter daftar tagihan di bawah */}
            {searchParams.status && (
              <input type="hidden" name="status" value={searchParams.status} />
            )}
            {searchParams.kelas && (
              <input type="hidden" name="kelas" value={searchParams.kelas} />
            )}
            {searchParams.jenis && (
              <input type="hidden" name="jenis" value={searchParams.jenis} />
            )}
            <div className="space-y-1">
              <label htmlFor="tunai" className="text-xs text-muted-foreground">
                Siswa
              </label>
              <Select
                id="tunai"
                name="tunai"
                defaultValue={searchParams.tunai ?? ""}
                className="w-64"
              >
                <option value="">Pilih siswa…</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({s.nis})
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" variant="outline">
              Muat Tagihan
            </Button>
          </form>

          {cashStudent && (
            <CashPaymentForm
              studentId={cashStudent.id}
              studentName={cashStudent.full_name}
              bills={cashBills}
            />
          )}
        </CardContent>
      </Card>

      {/* Daftar tagihan + filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar tagihan ({bills.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label htmlFor="f_status" className="text-xs text-muted-foreground">
                Status
              </label>
              <Select id="f_status" name="status" defaultValue={searchParams.status ?? ""} className="w-40">
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <label htmlFor="f_kelas" className="text-xs text-muted-foreground">
                Kelas
              </label>
              <Select id="f_kelas" name="kelas" defaultValue={searchParams.kelas ?? ""} className="w-32">
                <option value="">Semua kelas</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <label htmlFor="f_jenis" className="text-xs text-muted-foreground">
                Jenis
              </label>
              <Select id="f_jenis" name="jenis" defaultValue={searchParams.jenis ?? ""} className="w-40">
                <option value="">Semua jenis</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" variant="outline">
              Terapkan
            </Button>
          </form>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Siswa</TableHead>
                <TableHead>Kelas</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead className="text-right">Tagihan</TableHead>
                <TableHead className="text-right">Sisa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Belum ada tagihan sesuai filter.
                  </TableCell>
                </TableRow>
              )}
              {bills.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.studentName}</TableCell>
                  <TableCell>{b.classLabel}</TableCell>
                  <TableCell>{b.typeName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {b.period ? formatTanggal(b.period).replace(/^\d+ /, "") : "—"}
                  </TableCell>
                  <TableCell className="text-right">{formatRupiah(b.amount)}</TableCell>
                  <TableCell className="text-right">
                    {b.remaining > 0 ? formatRupiah(b.remaining) : "—"}
                  </TableCell>
                  <TableCell>
                    <BillStatusBadge status={b.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {(b.status === "unpaid" || b.status === "partial") &&
                      b.amount_paid === 0 && <WaiveBillForm billId={b.id} />}
                    {b.status === "waived" && (
                      <form action={unwaiveBill} className="inline">
                        <input type="hidden" name="bill_id" value={b.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Batalkan pembebasan
                        </Button>
                      </form>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
