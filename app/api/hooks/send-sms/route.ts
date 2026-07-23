import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sendWhatsApp } from "@/modules/notifications/gateway";

export const dynamic = "force-dynamic";

/**
 * Auth hook `send_sms` (Supabase). Dipanggil setiap Supabase perlu mengirim
 * OTP login orang tua → kita teruskan ke gateway WhatsApp. Inilah jembatan
 * yang membuat OTP WA benar-benar terkirim di produksi (PRD §6.1).
 *
 * Payload: { user: { phone }, sms: { otp } }
 * Ditandatangani Standard Webhooks memakai `SEND_SMS_HOOK_SECRET`
 * (format Supabase: "v1,whsec_<base64>").
 */

/** Verifikasi tanda tangan Standard Webhooks; timing-safe. */
function verifySignature(
  secret: string,
  id: string,
  timestamp: string,
  body: string,
  signatureHeader: string,
): boolean {
  const base64Secret = secret.replace(/^v1,whsec_/, "");
  let key: Buffer;
  try {
    key = Buffer.from(base64Secret, "base64");
  } catch {
    return false;
  }

  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");

  // Header bisa memuat beberapa tanda tangan dipisah spasi: "v1,<sig> v1,<sig>"
  for (const part of signatureHeader.split(" ")) {
    const sig = part.includes(",") ? part.split(",")[1]! : part;
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

export async function POST(request: NextRequest) {
  const secret = process.env.SEND_SMS_HOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: { message: "SEND_SMS_HOOK_SECRET belum dikonfigurasi" } },
      { status: 500 },
    );
  }

  const raw = await request.text();
  const id = request.headers.get("webhook-id") ?? "";
  const timestamp = request.headers.get("webhook-timestamp") ?? "";
  const signature = request.headers.get("webhook-signature") ?? "";

  if (!verifySignature(secret, id, timestamp, raw, signature)) {
    return NextResponse.json(
      { error: { message: "Tanda tangan hook tidak valid" } },
      { status: 401 },
    );
  }

  let phone: string | undefined;
  let otp: string | undefined;
  try {
    const payload = JSON.parse(raw) as {
      user?: { phone?: string };
      sms?: { otp?: string };
    };
    phone = payload.user?.phone;
    otp = payload.sms?.otp;
  } catch {
    return NextResponse.json(
      { error: { message: "Payload tidak valid" } },
      { status: 400 },
    );
  }

  if (!phone || !otp) {
    return NextResponse.json(
      { error: { message: "Nomor atau kode OTP kosong" } },
      { status: 400 },
    );
  }

  const body =
    `Kode masuk ArtaSchool Pay Anda: *${otp}*\n` +
    `Berlaku 5 menit. Jangan bagikan kode ini kepada siapa pun.`;

  const result = await sendWhatsApp(phone, body);
  if (!result.ok) {
    // Supabase akan menganggap OTP gagal terkirim dan menampilkan error ke user
    return NextResponse.json(
      { error: { message: `Gagal mengirim OTP: ${result.error}` } },
      { status: 502 },
    );
  }

  // 200 kosong = Supabase menganggap OTP terkirim
  return NextResponse.json({});
}
