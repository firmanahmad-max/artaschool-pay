import type { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/modules/auth/guards";
import { getArrearsRows, getPaymentReport } from "@/modules/reports/queries";

const STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
  needs_revision: "Perlu Revisi",
  draft: "Draft",
};

function toCsv(rows: Record<string, string | number>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    headers.join(";"),
    ...rows.map((r) => headers.map((h) => escape(r[h] ?? "")).join(";")),
  ];
  // BOM agar Excel Indonesia membaca UTF-8 dengan benar
  return "﻿" + lines.join("\r\n");
}

/** Export laporan pembayaran / tunggakan ke XLSX atau CSV. */
export async function GET(request: NextRequest) {
  // Semua role admin boleh export (RBAC PRD §6.5)
  await requireAdmin();

  const sp = request.nextUrl.searchParams;
  const jenis = sp.get("jenis") === "tunggakan" ? "tunggakan" : "pembayaran";
  const format = sp.get("format") === "csv" ? "csv" : "xlsx";
  const classId = sp.get("kelas") ?? undefined;

  let rows: Record<string, string | number>[];
  let sheetName: string;

  if (jenis === "tunggakan") {
    const all = await getArrearsRows();
    const filtered = classId ? all.filter((a) => a.classId === classId) : all;
    sheetName = "Tunggakan";
    rows = filtered.map((a) => ({
      NIS: a.nis,
      Siswa: a.studentName,
      Kelas: a.classLabel,
      Jenis: a.typeName,
      Periode: a.period ? a.period.slice(0, 7) : "-",
      "Jatuh Tempo": a.due_date ?? "-",
      Tagihan: a.amount,
      Dibayar: a.paid,
      Sisa: a.remaining,
    }));
  } else {
    const report = await getPaymentReport({
      from: sp.get("from") ?? undefined,
      to: sp.get("to") ?? undefined,
      classId,
      status: sp.get("status") ?? undefined,
    });
    sheetName = "Pembayaran";
    rows = report.rows.map((r) => ({
      Tanggal: r.created_at ? r.created_at.slice(0, 10) : "-",
      NIS: r.nis,
      Siswa: r.studentName,
      Kelas: r.classLabel,
      Metode: r.method,
      Pengirim: r.sender_name ?? "-",
      Nominal: r.amount,
      Status: STATUS_LABEL[r.status] ?? r.status,
    }));
  }

  const today = new Date().toISOString().slice(0, 10);
  const filename = `laporan-${jenis}-${today}.${format}`;

  if (format === "csv") {
    return new Response(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const sheet = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, sheetName);
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
