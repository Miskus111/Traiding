import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail, setSessionCookie, verifyPassword } from "@/lib/auth";
import { hasDatabase, query } from "@/lib/db";

export const runtime = "nodejs";

type LoginRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  password_salt: string;
};

export async function POST(request: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json(
      {
        error:
          "Databáze není nastavená. Ve Vercelu přidej Neon/Postgres proměnnou a SESSION_SECRET.",
      },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const email = normalizeEmail(String(body?.email ?? ""));
  const password = String(body?.password ?? "");

  const result = await query<LoginRow>(
    "SELECT id, email, name, password_hash, password_salt FROM users WHERE email = $1 LIMIT 1",
    [email],
  );
  const user = result.rows[0];

  if (!user || !verifyPassword(password, user.password_hash, user.password_salt)) {
    return NextResponse.json(
      { error: "Nesprávný e-mail nebo heslo." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
  });
  setSessionCookie(response, user.id);
  return response;
}
