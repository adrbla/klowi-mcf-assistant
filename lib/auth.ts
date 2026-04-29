/**
 * Edge-compatible HMAC-signed session cookie.
 *
 * Cookie value format: `<expiryEpochMs>.<hexSignature>`
 * Signature: HMAC-SHA256(AUTH_SECRET, expiryEpochMs) — re-computed at verify time.
 *
 * Used by middleware.ts (gates the app) and /api/login (sets the cookie).
 * No `import "server-only"` here: middleware runs in Edge runtime, and Web Crypto
 * is the only crypto API available there.
 */

export const AUTH_COOKIE_NAME = "klowi-auth";
export const ADMIN_COOKIE_NAME = "klowi-admin";
export const AUTH_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET is not set or too short (need ≥ 16 chars). Generate via `openssl rand -hex 32`.",
    );
  }
  return secret;
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return bytesToHex(sig);
}

/** Constant-time string compare (avoids timing oracles on signature match). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Build a fresh signed token valid for AUTH_COOKIE_MAX_AGE_S. */
export async function issueToken(): Promise<string> {
  const expiry = Date.now() + AUTH_COOKIE_MAX_AGE_S * 1000;
  const payload = String(expiry);
  const sig = await hmac(payload);
  return `${payload}.${sig}`;
}

/** Verify a cookie value. Returns true iff signature matches and not expired. */
export async function verifyToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expiry = Number(payload);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false;
  let expected: string;
  try {
    expected = await hmac(payload);
  } catch {
    return false;
  }
  return safeEqual(sig, expected);
}

/** Compare provided passcode to APP_PASSCODE in constant time. */
export function checkPasscode(provided: string): boolean {
  const expected = process.env.APP_PASSCODE;
  if (!expected) return false;
  return safeEqual(provided, expected);
}

/* ───────────────────────── Admin auth (separate gate) ───────────────────────── */

/** Build a fresh signed admin token. Same secret, distinct payload prefix. */
export async function issueAdminToken(): Promise<string> {
  const expiry = Date.now() + AUTH_COOKIE_MAX_AGE_S * 1000;
  const payload = `admin.${expiry}`;
  const sig = await hmac(payload);
  return `${payload}.${sig}`;
}

/** Verify an admin cookie value. */
export async function verifyAdminToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const lastDot = token.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === token.length - 1) return false;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  if (!payload.startsWith("admin.")) return false;
  const expiry = Number(payload.slice("admin.".length));
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false;
  let expected: string;
  try {
    expected = await hmac(payload);
  } catch {
    return false;
  }
  return safeEqual(sig, expected);
}

/** Compare provided passcode to ADMIN_PASSCODE in constant time. */
export function checkAdminPasscode(provided: string): boolean {
  const expected = process.env.ADMIN_PASSCODE;
  if (!expected) return false;
  return safeEqual(provided, expected);
}
