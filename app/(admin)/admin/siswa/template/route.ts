import * as XLSX from "xlsx";
import { requireAdmin } from "@/modules/auth/guards";

/** Template import siswa (.xlsx) dengan header + satu baris contoh. */
export async function GET() {
  await requireAdmin(["super_admin", "operator"]);

  const rows = [
    {
      NIS: "2026010",
      "Nama Lengkap": "Contoh Nama Siswa",
      Kelas: "1A",
      "Nama Wali": "Contoh Nama Wali",
      "No HP Wali": "081200000000",
      Relasi: "ibu",
    },
  ];
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = [{ wch: 12 }, { wch: 24 }, { wch: 8 }, { wch: 24 }, { wch: 16 }, { wch: 8 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Siswa");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template-import-siswa.xlsx"',
    },
  });
}
