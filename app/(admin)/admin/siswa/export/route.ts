import * as XLSX from "xlsx";
import { requireAdmin } from "@/modules/auth/guards";
import { getStudents } from "@/modules/students/queries";

/** Export seluruh siswa (beserta kelas & wali) ke .xlsx. */
export async function GET() {
  await requireAdmin(["super_admin", "operator", "admin_keuangan", "kepala_sekolah", "viewer"]);

  const students = await getStudents();
  const rows = students.map((s) => ({
    NIS: s.nis,
    "Nama Lengkap": s.full_name,
    Kelas: s.classLabel,
    Status: s.is_active ? "Aktif" : "Nonaktif",
    Wali: s.guardians.map((g) => `${g.name} (${g.relation})`).join(", "),
    "No HP Wali": s.guardians.map((g) => g.phone).join(", "),
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = [{ wch: 12 }, { wch: 24 }, { wch: 8 }, { wch: 10 }, { wch: 28 }, { wch: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Siswa");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const today = new Date().toISOString().slice(0, 10);
  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="siswa-${today}.xlsx"`,
    },
  });
}
