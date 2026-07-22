import type { NextRequest } from "next/server";
import { buildCsp } from "@/lib/csp";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Nonce baru untuk SETIAP request — inti dari CSP berbasis nonce
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");

  // Next.js membaca header CSP dari REQUEST untuk menempelkan nonce
  // ke skrip hidrasi yang ia suntikkan sendiri.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = await updateSession(request, requestHeaders);
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Semua rute kecuali aset statis & webhook publik
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
