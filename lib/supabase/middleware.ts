import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PARENT_PREFIXES = ["/beranda", "/upload", "/riwayat", "/pengumuman", "/akun"];

/**
 * Refresh sesi Supabase di setiap request + guard rute lapis kedua
 * (lapis utama otorisasi tetap RLS — PRD §3.1). Cek role detail ada di layout.
 *
 * `requestHeaders` membawa `x-nonce` & CSP ke server component; Next.js
 * membaca header CSP dari request untuk menempelkan nonce ke skrip miliknya.
 */
export async function updateSession(
  request: NextRequest,
  requestHeaders: Headers,
) {
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminLogin = pathname === "/admin/login";
  const isParentArea = PARENT_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const isParentLogin = pathname === "/login";

  if (!user) {
    if (isAdminArea && !isAdminLogin) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    if (isParentArea) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  } else {
    if (isParentLogin) {
      return NextResponse.redirect(new URL("/beranda", request.url));
    }
    if (isAdminLogin) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  return response;
}
