import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { samarkanTeks } from "@/lib/sentry-scrub";

export const dynamic = "force-dynamic";

/**
 * Menerima laporan galat render dari browser lalu meneruskannya ke Sentry
 * DARI SERVER.
 *
 * Alasannya bukan gaya-gayaan: SDK Sentry sisi browser menambah ~62 KB pada
 * setiap muatan halaman, sehingga seluruh rute orang tua melewati ambang
 * NFR PRD §8 (<150 KB gz, LCP <2,5 dtk di 3G cepat). Pengguna kita adalah
 * orang tua dengan koneksi seadanya — beban itu tidak sepadan, sementara
 * galat yang benar-benar berisiko (pembayaran, verifikasi, unggah) semuanya
 * terjadi di server dan sudah tertangkap di sana.
 *
 * Isi laporan tetap melewati penyaring UU PDP sebelum dikirim.
 */
const MAKS = 4000;

export async function POST(request: NextRequest) {
  // Tanpa DSN, tidak ada yang perlu dikerjakan
  if (!process.env.SENTRY_DSN) {
    return NextResponse.json({ ok: true, diteruskan: false });
  }

  let pesan = "Galat render tanpa keterangan";
  let jejak: string | undefined;
  let jalur: string | undefined;

  try {
    const body = (await request.json()) as {
      pesan?: unknown;
      jejak?: unknown;
      jalur?: unknown;
    };
    if (typeof body.pesan === "string") pesan = body.pesan.slice(0, 500);
    if (typeof body.jejak === "string") jejak = body.jejak.slice(0, MAKS);
    if (typeof body.jalur === "string") jalur = body.jalur.slice(0, 300);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  Sentry.captureException(new Error(samarkanTeks(pesan)), {
    tags: { sumber: "render-browser" },
    extra: {
      jejak: jejak ? samarkanTeks(jejak) : undefined,
      jalur: jalur ? samarkanTeks(jalur) : undefined,
    },
  });

  return NextResponse.json({ ok: true, diteruskan: true });
}
