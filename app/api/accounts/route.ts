import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  accountStatusValue,
  optionalDate,
  optionalText,
  requiredText,
} from "@/lib/validators";
import type { TradingAccount } from "@/lib/types";

export const runtime = "nodejs";

type AccountRow = {
  id: string;
  prop_firm: string;
  program: string;
  account_size: string;
  account_type: string;
  market: string;
  strategy: string;
  status: TradingAccount["status"];
  purchase_date: string | null;
  ended_date: string | null;
  note: string | null;
  created_at: string;
  costs: string;
  payouts: string;
};

function mapAccount(row: AccountRow): TradingAccount {
  const costs = Number(row.costs);
  const payouts = Number(row.payouts);
  const net = payouts - costs;

  return {
    id: row.id,
    propFirm: row.prop_firm,
    program: row.program,
    accountSize: row.account_size,
    accountType: row.account_type,
    market: row.market,
    strategy: row.strategy,
    status: row.status,
    purchaseDate: row.purchase_date,
    endedDate: row.ended_date,
    note: row.note,
    createdAt: row.created_at,
    costs,
    payouts,
    net,
    roi: costs > 0 ? (net / costs) * 100 : 0,
  };
}

const accountSelect = `
  SELECT
    a.id,
    a.prop_firm,
    a.program,
    a.account_size,
    a.account_type,
    a.market,
    a.strategy,
    a.status,
    a.purchase_date::text AS purchase_date,
    a.ended_date::text AS ended_date,
    a.note,
    a.created_at::text AS created_at,
    COALESCE((
      SELECT SUM(
        i.amount * CASE i.currency
          WHEN 'CZK' THEN 1
          WHEN 'EUR' THEN 25.1
          WHEN 'USD' THEN 23.1
          ELSE 1
        END
      )
      FROM invoices i
      WHERE i.user_id = a.user_id
        AND (
          i.account_id = a.id
          OR (
            i.account_id IS NULL
            AND LOWER(i.prop_firm) = LOWER(a.prop_firm)
            AND LOWER(i.program) = LOWER(a.program)
          )
        )
    ), 0)::text AS costs,
    COALESCE((
      SELECT SUM(
        p.amount * CASE p.currency
          WHEN 'CZK' THEN 1
          WHEN 'EUR' THEN 25.1
          WHEN 'USD' THEN 23.1
          ELSE 1
        END
      )
      FROM payouts p
      WHERE p.user_id = a.user_id
        AND (
          p.account_id = a.id
          OR (
            p.account_id IS NULL
            AND LOWER(p.prop_firm) = LOWER(a.prop_firm)
            AND LOWER(p.program) = LOWER(a.program)
          )
        )
    ), 0)::text AS payouts
  FROM accounts a
`;

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "";
  const firm = searchParams.get("firm") ?? "";
  const strategy = searchParams.get("strategy") ?? "";
  const market = searchParams.get("market") ?? "";

  const params: string[] = [user.id];
  const filters = ["a.user_id = $1"];
  if (status) {
    params.push(status);
    filters.push(`a.status = $${params.length}`);
  }
  if (firm) {
    params.push(`%${firm}%`);
    filters.push(`a.prop_firm ILIKE $${params.length}`);
  }
  if (strategy) {
    params.push(`%${strategy}%`);
    filters.push(`a.strategy ILIKE $${params.length}`);
  }
  if (market) {
    params.push(`%${market}%`);
    filters.push(`a.market ILIKE $${params.length}`);
  }

  const result = await query<AccountRow>(
    `${accountSelect}
     WHERE ${filters.join(" AND ")}
     ORDER BY a.created_at DESC`,
    params,
  );

  return NextResponse.json({ accounts: result.rows.map(mapAccount) });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  const propFirm = requiredText(body?.propFirm);
  const program = requiredText(body?.program);

  if (!propFirm) {
    return NextResponse.json(
      { error: "Doplň prop firmu účtu." },
      { status: 400 },
    );
  }

  const accountId = crypto.randomUUID();
  const result = await query<AccountRow>(
    `INSERT INTO accounts
       (id, user_id, prop_firm, program, account_size, account_type, market, strategy, status, purchase_date, ended_date, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      accountId,
      user.id,
      propFirm,
      program,
      requiredText(body?.accountSize, 80),
      requiredText(body?.accountType, 80),
      requiredText(body?.market, 80),
      requiredText(body?.strategy, 120),
      accountStatusValue(body?.status),
      optionalDate(body?.purchaseDate),
      optionalDate(body?.endedDate),
      optionalText(body?.note, 600),
    ],
  ).then(() =>
    query<AccountRow>(
      `${accountSelect} WHERE a.id = $1 AND a.user_id = $2 LIMIT 1`,
      [accountId, user.id],
    ),
  );

  return NextResponse.json({ account: mapAccount(result.rows[0]) });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  const accountId = requiredText(body?.id, 80);
  if (!accountId) {
    return NextResponse.json({ error: "Chybí ID účtu." }, { status: 400 });
  }

  const current = await query<{ id: string }>(
    "SELECT id FROM accounts WHERE id = $1 AND user_id = $2 LIMIT 1",
    [accountId, user.id],
  );
  if (!current.rows[0]) {
    return NextResponse.json(
      { error: "Účet neexistuje nebo ti nepatří." },
      { status: 404 },
    );
  }

  await query(
    `UPDATE accounts
     SET prop_firm = $3,
         program = $4,
         account_size = $5,
         account_type = $6,
         market = $7,
         strategy = $8,
         status = $9,
         purchase_date = $10,
         ended_date = $11,
         note = $12
     WHERE id = $1 AND user_id = $2`,
    [
      accountId,
      user.id,
      requiredText(body?.propFirm),
      requiredText(body?.program),
      requiredText(body?.accountSize, 80),
      requiredText(body?.accountType, 80),
      requiredText(body?.market, 80),
      requiredText(body?.strategy, 120),
      accountStatusValue(body?.status),
      optionalDate(body?.purchaseDate),
      optionalDate(body?.endedDate),
      optionalText(body?.note, 600),
    ],
  );

  const result = await query<AccountRow>(
    `${accountSelect} WHERE a.id = $1 AND a.user_id = $2 LIMIT 1`,
    [accountId, user.id],
  );

  return NextResponse.json({ account: mapAccount(result.rows[0]) });
}
