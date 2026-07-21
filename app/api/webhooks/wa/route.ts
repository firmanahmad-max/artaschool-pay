import { NextResponse } from "next/server";

/**
 * Placeholder callback WhatsApp gateway (Fonnte/Wablas).
 * Implementasi nyata di Sprint 8 (modul notifications).
 */
export async function POST() {
  return NextResponse.json(
    { error: "Belum diimplementasikan" },
    { status: 501 },
  );
}
