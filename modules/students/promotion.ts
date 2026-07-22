"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/modules/auth/guards";

export type PromotionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const MASTER_ROLES = ["super_admin", "operator"];

/** Jalankan kenaikan kelas massal dari tahun ajaran aktif ke tahun tujuan. */
export async function runPromotion(
  _prev: PromotionResult | null,
  formData: FormData,
): Promise<PromotionResult> {
  await requireAdmin(MASTER_ROLES);

  const fromYear = String(formData.get("from_year") ?? "");
  const toYear = String(formData.get("to_year") ?? "");
  const deactivate = formData.get("deactivate_graduates") === "on";

  if (!fromYear || !toYear) {
    return { ok: false, error: "Tahun ajaran asal/tujuan tidak lengkap." };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("promote_students", {
    p_from_year: fromYear,
    p_to_year: toYear,
    p_deactivate_graduates: deactivate,
  });
  if (error) {
    return { ok: false, error: error.message ?? "Kenaikan kelas gagal." };
  }

  const r = (data ?? {}) as {
    promoted?: number;
    created_classes?: number;
    graduated?: number;
  };
  revalidatePath("/admin/tahun-ajaran");
  revalidatePath("/admin/siswa");
  return {
    ok: true,
    message:
      `${r.promoted ?? 0} siswa naik kelas · ${r.created_classes ?? 0} kelas baru dibuat` +
      (r.graduated ? ` · ${r.graduated} siswa lulus (dinonaktifkan)` : ""),
  };
}
