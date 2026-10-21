import { createClient } from "@/lib/supabase/server";
import { buatVcard, type KontakWali } from "@/modules/announcements/vcard";
import { requireAdmin } from "@/modules/auth/guards";
import { getStudents } from "@/modules/students/queries";

/**
 * Unduh kontak wali siswa aktif (.vcf) untuk Daftar Siaran WhatsApp — jalur
 * pengumuman massal di mode manual. Data pribadi → peran terbatas (sama dgn
 * broadcast), tidak di-cache, dan tercatat di audit.
 */
export async function GET() {
  await requireAdmin(["super_admin", "operator"]);

  const students = await getStudents();
  const perNomor = new Map<string, { nama: string; anak: string[] }>();
  for (const s of students) {
    if (!s.is_active) continue;
    for (const g of s.guardians) {
      if (!g.phone.startsWith("+")) continue; // lewati nomor tombstone akun terhapus
      const entri = perNomor.get(g.phone) ?? { nama: g.name, anak: [] };
      entri.anak.push(`${s.full_name} (${s.classLabel})`);
      perNomor.set(g.phone, entri);
    }
  }

  const kontak: KontakWali[] = Array.from(perNomor.entries()).map(([phone, e]) => ({
    nama: e.nama,
    phone,
    keterangan: `Wali ${e.anak.join(", ")}`,
  }));

  await (await createClient()).rpc("log_audit", {
    p_action: "guardian.contacts_exported",
    p_entity: "guardian",
    p_after: { jumlah: kontak.length },
  });

  const today = new Date().toISOString().slice(0, 10);
  return new Response(buatVcard(kontak), {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="kontak-wali-${today}.vcf"`,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
