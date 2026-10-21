import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

const LABEL_BROWSER: Record<string, string> = {
  chrome: "Chrome",
  safari: "Safari",
  firefox: "Firefox",
  samsung: "Samsung Internet",
  edge: "Edge",
  opera: "Opera",
  webview: "Browser dalam aplikasi",
  lain: "Lainnya",
};
const LABEL_OS: Record<string, string> = {
  android: "Android",
  ios: "iOS",
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  lain: "OS lain",
};

/**
 * Ringkasan statistik perangkat anonim wali (30 hari) — dasar keputusan kapan
 * aman pindah ke Tailwind 4 (CHECKLIST-GO-LIVE §6). Tak ada data pribadi.
 */
export async function StatistikPerangkatCard() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("ringkasan_statistik_perangkat", { p_hari: 30 });
  const wali = (data ?? []).filter((r) => r.area === "wali");
  const total = wali.reduce((s, r) => s + Number(r.jumlah), 0);
  const tidakSiap = wali.filter((r) => !r.tw4);
  const totalTidakSiap = tidakSiap.reduce((s, r) => s + Number(r.jumlah), 0);
  const persen = total ? Math.round((totalTidakSiap / total) * 1000) / 10 : 0;

  return (
    <Card className="print:hidden">
      <CardHeader>
        <CardTitle className="text-base">Perangkat wali (30 hari, anonim)</CardTitle>
        <CardDescription>
          Hitungan perangkat-hari tanpa identitas apa pun. Dipakai untuk memutuskan
          kapan aman memperbarui tampilan aplikasi ke Tailwind 4, yang tidak
          mendukung iOS &lt; 16.4 dan Chrome &lt; 111.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {total === 0 ? (
          <p className="text-muted-foreground">Belum ada data.</p>
        ) : (
          <>
            <p>
              <strong>{persen}%</strong> perangkat wali ({totalTidakSiap} dari {total}{" "}
              perangkat-hari) <strong>belum mendukung</strong> Tailwind 4.{" "}
              {persen <= 2
                ? "Cukup kecil — migrasi bisa dipertimbangkan."
                : "Migrasi sebaiknya ditunda."}
            </p>
            {tidakSiap.length > 0 && (
              <ul className="space-y-1 text-muted-foreground">
                {tidakSiap.slice(0, 8).map((r) => (
                  <li key={`${r.browser}-${r.versi}-${r.os}-${r.os_versi}`}>
                    {LABEL_BROWSER[r.browser] ?? r.browser} {r.versi || ""} ·{" "}
                    {LABEL_OS[r.os] ?? r.os} {r.os_versi || ""} — {Number(r.jumlah)}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
