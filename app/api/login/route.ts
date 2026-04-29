import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_MAX_AGE_S,
  checkPasscode,
  issueToken,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeNext(input: string | null): string {
  if (!input) return "/";
  // Only allow same-origin relative paths starting with a single "/".
  if (!input.startsWith("/") || input.startsWith("//")) return "/";
  return input;
}

async function handle(req: NextRequest, passcode: string, next: string | null) {
  const dest = safeNext(next);
  if (!checkPasscode(passcode)) {
    const url = new URL("/login", req.url);
    url.searchParams.set("error", "1");
    if (dest !== "/") url.searchParams.set("next", dest);
    return NextResponse.redirect(url, 303);
  }

  const token = await issueToken();
  const res = NextResponse.redirect(new URL(dest, req.url), 303);
  res.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_S,
  });
  return res;
}

export async function POST(req: NextRequest) {
  const ct = req.headers.get("content-type") ?? "";
  let passcode = "";
  let next: string | null = null;

  if (ct.includes("application/json")) {
    try {
      const body = (await req.json()) as { passcode?: string; next?: string };
      passcode = body.passcode ?? "";
      next = body.next ?? null;
    } catch {
      /* ignore */
    }
  } else {
    const form = await req.formData();
    passcode = String(form.get("passcode") ?? "");
    next = form.get("next") ? String(form.get("next")) : null;
  }

  return handle(req, passcode, next);
}
