import { NextRequest, NextResponse } from "next/server";
import { forbidden, getCurrentUser, unauthorized } from "@/lib/auth";
import { query } from "@/lib/db";
import { requiredText } from "@/lib/validators";
import type { AdminUserSummary, UserRole } from "@/lib/types";

export const runtime = "nodejs";

type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  blocked: boolean;
  created_at: string;
  accounts: string;
  invoices: string;
  payouts: string;
  documents: string;
};

function mapUser(row: AdminUserRow): AdminUserSummary {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    blocked: row.blocked,
    createdAt: row.created_at,
    accounts: Number(row.accounts),
    invoices: Number(row.invoices),
    payouts: Number(row.payouts),
    documents: Number(row.documents),
  };
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { response: unauthorized() };
  if (user.role !== "admin") return { response: forbidden() };
  return { user };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const result = await query<AdminUserRow>(`
    SELECT
      u.id,
      u.email,
      u.name,
      u.role,
      u.blocked,
      u.created_at::text AS created_at,
      COUNT(DISTINCT a.id)::text AS accounts,
      COUNT(DISTINCT i.id)::text AS invoices,
      COUNT(DISTINCT p.id)::text AS payouts,
      COUNT(DISTINCT d.id)::text AS documents
    FROM users u
    LEFT JOIN accounts a ON a.user_id = u.id
    LEFT JOIN invoices i ON i.user_id = u.id
    LEFT JOIN payouts p ON p.user_id = u.id
    LEFT JOIN documents d ON d.user_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at ASC
  `);

  return NextResponse.json({ users: result.rows.map(mapUser) });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const userId = requiredText(body?.id, 80);
  const role: UserRole = body?.role === "admin" ? "admin" : "user";
  const blocked = Boolean(body?.blocked);

  if (!userId) {
    return NextResponse.json({ error: "Chybí ID uživatele." }, { status: 400 });
  }
  if (userId === auth.user.id && blocked) {
    return NextResponse.json(
      { error: "Nemůžeš zablokovat vlastní admin účet." },
      { status: 400 },
    );
  }
  if (userId === auth.user.id && role !== "admin") {
    return NextResponse.json(
      { error: "Nemůžeš odebrat admin roli vlastnímu účtu." },
      { status: 400 },
    );
  }

  await query(
    "UPDATE users SET role = $2, blocked = $3 WHERE id = $1",
    [userId, role, blocked],
  );

  const result = await query<AdminUserRow>(
    `SELECT
      u.id,
      u.email,
      u.name,
      u.role,
      u.blocked,
      u.created_at::text AS created_at,
      COUNT(DISTINCT a.id)::text AS accounts,
      COUNT(DISTINCT i.id)::text AS invoices,
      COUNT(DISTINCT p.id)::text AS payouts,
      COUNT(DISTINCT d.id)::text AS documents
    FROM users u
    LEFT JOIN accounts a ON a.user_id = u.id
    LEFT JOIN invoices i ON i.user_id = u.id
    LEFT JOIN payouts p ON p.user_id = u.id
    LEFT JOIN documents d ON d.user_id = u.id
    WHERE u.id = $1
    GROUP BY u.id
    LIMIT 1`,
    [userId],
  );

  return NextResponse.json({ user: mapUser(result.rows[0]) });
}
