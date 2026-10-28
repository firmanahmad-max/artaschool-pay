import { NextResponse, type NextRequest } from "next/server";
import { periksaCron } from "@/lib/cron-auth";

/** Respons penolakan bila request bukan dari penjadwal sah; `null` = lanjut. */
export function tolakBilaBukanCron(request: NextRequest): NextResponse | null {
  const hasil = periksaCron(
    {
      authorization: request.headers.get("authorization"),
      xCronSecret: request.headers.get("x-cron-secret"),
    },
    process.env.CRON_SECRET,
  );
  if (hasil === "belum-dikonfigurasi") {
    return NextResponse.json({ error: "CRON_SECRET belum dikonfigurasi" }, { status: 500 });
  }
  if (hasil === "ditolak") {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  }
  return null;
}
