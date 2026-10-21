import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { AREA, BROWSER, OS } from "@/lib/statistik-perangkat";

export const dynamic = "force-dynamic";

/**
 * Penerima statistik perangkat ANONIM (lihat lib/statistik-perangkat.ts).
 * Hanya kategori dari daftar tertutup yang diterima; apa pun di luar itu
 * (mis. string user-agent utuh) ditolak. Tidak membaca/menyimpan IP, cookie,
 * atau identitas — hanya menaikkan penghitung harian.
 */
const skema = z
  .object({
    area: z.enum(AREA),
    browser: z.enum(BROWSER),
    versi: z.number().int().min(0).max(999),
    os: z.enum(OS),
    osVersi: z.number().int().min(0).max(99),
    tw4: z.boolean(),
  })
  .strict();

export async function POST(request: NextRequest) {
  // Hanya dari halaman aplikasi sendiri (penyaring kasar spam lintas situs).
  const asal = request.headers.get("origin");
  if (asal && asal !== request.nextUrl.origin) {
    return new NextResponse(null, { status: 403 });
  }

  let data: z.infer<typeof skema>;
  try {
    data = skema.parse(await request.json());
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  await createAdminClient().rpc("catat_statistik_perangkat", {
    p_area: data.area,
    p_browser: data.browser,
    p_versi: data.versi,
    p_os: data.os,
    p_os_versi: data.osVersi,
    p_tw4: data.tw4,
  });
  return new NextResponse(null, { status: 204 });
}
