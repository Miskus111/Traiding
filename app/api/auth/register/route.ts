import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { hashPassword, normalizeEmail, setSessionCookie } from "@/lib/auth";
import { hasDatabase, query } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json(
      { error: "Databáze není nastavená. Ve Vercelu přidej POSTGRES_URL." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const email = normalizeEmail(String(body?.email ?? ""));
  const name = String(body?.name ?? "").trim() || email.split("@")[0] || "Trader";
  const password = String(body?.password ?? "");

  if (!email.includes("@") || password.length < 8) {
    return NextResponse.json(
      { error: "Zadej platný e-mail a heslo alespoň na 8 znaků." },
      { status: 400 },
    );
  }

  const { hash, salt } = hashPassword(password);
  const userId = crypto.randomUUID();

  try {
    const result = await query<{ id: string; email: string; name: string }>(
      `INSERT INTO users (id, email, name, password_hash, password_salt)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name`,
      [userId, email, name.slice(0, 120), hash, salt],
    );

    const response = NextResponse.json({ user: result.rows[0] });
    setSessionCookie(response, userId);
    return response;
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "Účet s tímto e-mailem už existuje." },
        { status: 409 },
      );
    }
    throw error;
  }
}
