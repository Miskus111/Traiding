import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  currencyValue,
  dateValue,
  numberValue,
  optionalText,
  requiredText,
} from "@/lib/validators";
import type { Payout } from "@/lib/types";

export const runtime = "nodejs";

type PayoutRow = {
  id: string;
  prop_firm: string;
  program: string;
  amount: string;
  currency: Payout["currency"];
  date: string;
  split: number;
  note: string | null;
};

function mapPayout(row: PayoutRow): Payout {
  return {
    id: row.id,
    propFirm: row.prop_firm,
    program: row.program,
    amount: Number(row.amount),
    currency: row.currency,
    date: row.date,
    split: Number(row.split),
    note: row.note,
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const result = await query<PayoutRow>(
    `SELECT id, prop_firm, program, amount::text AS amount, currency, payout_date::text AS date, split, note
     FROM payouts
     WHERE user_id = $1
     ORDER BY payout_date DESC, created_at DESC`,
    [user.id],
  );

  return NextResponse.json({ payouts: result.rows.map(mapPayout) });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  const propFirm = requiredText(body?.propFirm);
  const program = requiredText(body?.program);
  const amount = numberValue(body?.amount);
  const split = Math.max(0, Math.min(100, Math.round(numberValue(body?.split))));

  if (!propFirm || amount <= 0) {
    return NextResponse.json(
      { error: "Doplň prop firmu a částku větší než 0." },
      { status: 400 },
    );
  }

  const result = await query<PayoutRow>(
    `INSERT INTO payouts
       (id, user_id, prop_firm, program, amount, currency, payout_date, split, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, prop_firm, program, amount::text AS amount, currency, payout_date::text AS date, split, note`,
    [
      crypto.randomUUID(),
      user.id,
      propFirm,
      program,
      amount,
      currencyValue(body?.currency),
      dateValue(body?.date),
      split,
      optionalText(body?.note, 600),
    ],
  );

  return NextResponse.json({ payout: mapPayout(result.rows[0]) });
}
