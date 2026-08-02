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
import type { Invoice } from "@/lib/types";

export const runtime = "nodejs";

type InvoiceRow = {
  id: string;
  account_id: string | null;
  prop_firm: string;
  program: string;
  amount: string;
  currency: Invoice["currency"];
  date: string;
  file_name: string | null;
  note: string | null;
};

function mapInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    accountId: row.account_id,
    propFirm: row.prop_firm,
    program: row.program,
    amount: Number(row.amount),
    currency: row.currency,
    date: row.date,
    fileName: row.file_name,
    note: row.note,
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const result = await query<InvoiceRow>(
    `SELECT id, account_id, prop_firm, program, amount::text AS amount, currency, invoice_date::text AS date, file_name, note
     FROM invoices
     WHERE user_id = $1
     ORDER BY invoice_date DESC, created_at DESC`,
    [user.id],
  );

  return NextResponse.json({ invoices: result.rows.map(mapInvoice) });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  const propFirm = requiredText(body?.propFirm);
  const amount = numberValue(body?.amount);
  const accountId = optionalText(body?.accountId, 80);

  if (!propFirm || amount <= 0) {
    return NextResponse.json(
      { error: "Doplň prop firmu a částku větší než 0." },
      { status: 400 },
    );
  }

  if (accountId) {
    const account = await query<{ id: string }>(
      "SELECT id FROM accounts WHERE id = $1 AND user_id = $2 LIMIT 1",
      [accountId, user.id],
    );
    if (!account.rows[0]) {
      return NextResponse.json(
        { error: "Vybraný účet neexistuje nebo ti nepatří." },
        { status: 400 },
      );
    }
  }

  const result = await query<InvoiceRow>(
    `INSERT INTO invoices
       (id, user_id, account_id, prop_firm, program, amount, currency, invoice_date, file_name, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, account_id, prop_firm, program, amount::text AS amount, currency, invoice_date::text AS date, file_name, note`,
    [
      crypto.randomUUID(),
      user.id,
      accountId,
      propFirm,
      requiredText(body?.program),
      amount,
      currencyValue(body?.currency),
      dateValue(body?.date),
      optionalText(body?.fileName),
      optionalText(body?.note, 600),
    ],
  );

  return NextResponse.json({ invoice: mapInvoice(result.rows[0]) });
}
