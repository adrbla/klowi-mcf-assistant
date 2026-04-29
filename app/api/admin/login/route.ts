import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  AUTH_COOKIE_MAX_AGE_S,
  checkAdminPasscode,
  issueAdminToken,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let passcode = "";
  try {
    const body = (await req.json()) as { passcode?: string };
    passcode = String(body?.passcode ?? "");
  } catch {
    /* empty body, treated as wrong passcode */
  }

  if (!checkAdminPasscode(passcode)) {
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }

  const token = await issueAdminToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_S,
  });
  return res;
}
