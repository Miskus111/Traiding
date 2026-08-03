import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hasDatabase, query } from "./db";
import type { AuthUser } from "./types";

const SESSION_COOKIE = "trader_cost_session";
const SESSION_DAYS = 30;
const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

type SessionPayload = {
  userId: string;
  exp: number;
};

function secret() {
  return (
    process.env.SESSION_SECRET ??
    process.env.AUTH_SECRET ??
    "dev-only-change-this-secret-before-production"
  );
}

function sign(value: string) {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

function encodeSession(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeSession(token: string): SessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature || sign(body) !== signature) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (!payload.userId || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashPassword(
  password: string,
  salt: Buffer | string = crypto.randomBytes(16),
) {
  const passwordSalt = Buffer.isBuffer(salt) ? salt : Buffer.from(salt, "hex");
  const hash = crypto.scryptSync(password, passwordSalt, 64).toString("hex");
  return {
    hash,
    salt: passwordSalt.toString("hex"),
  };
}

export function verifyPassword(
  password: string,
  expectedHash: string,
  salt: string,
) {
  const { hash } = hashPassword(password, salt);
  return crypto.timingSafeEqual(
    Buffer.from(hash, "hex"),
    Buffer.from(expectedHash, "hex"),
  );
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (!hasDatabase()) return null;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = decodeSession(token);
  if (!payload) return null;

  const result = await query<AuthUser>(
    "SELECT id, email, name, role, blocked FROM users WHERE id = $1 LIMIT 1",
    [payload.userId],
  );

  const user = result.rows[0];
  return user && !user.blocked ? user : null;
}

export function setSessionCookie(response: NextResponse, userId: string) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  response.cookies.set(SESSION_COOKIE, encodeSession({ userId, exp }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function unauthorized() {
  return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: "You do not have permission for this action." }, { status: 403 });
}
