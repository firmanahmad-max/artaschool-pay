import { createClient } from "@/lib/supabase/server";
import { requireGuardian } from "@/modules/auth/guards";

/**
 * Unduh salinan data pribadi wali (hak akses UU PDP).
 * Data dirakit oleh RPC `export_my_guardian_data` yang men-scope ke wali
 * pemanggil — mustahil mengekspor data wali lain.
 */
export async function GET() {
  await requireGuardian(); // redirect ke /login bila bukan sesi wali

  const supabase = createClient();
  const { data, error } = await supabase.rpc("export_my_guardian_data");
  if (error || !data) {
    return new Response(
      JSON.stringify({ error: "Gagal mengekspor data. Coba lagi." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const tanggal = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="data-saya-artaschool-${tanggal}.json"`,
      // Berisi data pribadi — jangan sampai tersimpan di cache mana pun.
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
