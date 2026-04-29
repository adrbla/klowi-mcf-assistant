import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth";

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - /login (the login page)
     * - /api/login (login submission)
     * - /api/logout (clears cookie, no need to gate)
     * - /_next/* (static assets, fonts, css, js chunks)
     * - /favicon.ico
     */
    "/((?!login|api/login|api/logout|_next/|favicon\\.ico).*)",
  ],
};

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const isAuthed = await verifyToken(token);
  if (isAuthed) return NextResponse.next();

  const isApi = req.nextUrl.pathname.startsWith("/api/");
  if (isApi) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  const next = req.nextUrl.pathname + req.nextUrl.search;
  if (next && next !== "/") loginUrl.searchParams.set("next", next);
  return NextResponse.redirect(loginUrl);
}
