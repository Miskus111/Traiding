import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type MoneyRow = {
  prop_firm: string;
  program: string;
  amount: string;
  currency: "CZK" | "EUR" | "USD";
};

const exchangeToCzk: Record<MoneyRow["currency"], number> = {
  CZK: 1,
  EUR: 25.1,
  USD: 23.1,
};

function toCzk(row: MoneyRow) {
  return Number(row.amount) * (exchangeToCzk[row.currency] ?? 1);
}

function total(rows: MoneyRow[]) {
  return rows.reduce((sum, row) => sum + toCzk(row), 0);
}

function rank(rows: MoneyRow[], kind: "costs" | "payouts") {
  const grouped = rows.reduce<Record<string, number>>((acc, row) => {
    const key = `${row.prop_firm || "Nezařazeno"} • ${row.program || "Účet neuveden"}`;
    acc[key] = (acc[key] ?? 0) + toCzk(row);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([name, value]) => ({ name, [kind]: value }))
    .sort((a, b) => Number(b[kind]) - Number(a[kind]));
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const month = new URL(request.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Měsíc musí být ve formátu YYYY-MM." }, { status: 400 });
  }

  const [invoiceResult, payoutResult] = await Promise.all([
    query<MoneyRow>(
      `SELECT prop_firm, program, amount::text AS amount, currency
       FROM invoices
       WHERE user_id = $1 AND to_char(invoice_date, 'YYYY-MM') = $2`,
      [user.id, month],
    ),
    query<MoneyRow>(
      `SELECT prop_firm, program, amount::text AS amount, currency
       FROM payouts
       WHERE user_id = $1 AND to_char(payout_date, 'YYYY-MM') = $2`,
      [user.id, month],
    ),
  ]);

  const costs = total(invoiceResult.rows);
  const payouts = total(payoutResult.rows);
  const net = payouts - costs;
  const roi = costs > 0 ? (net / costs) * 100 : 0;
  const costRanking = rank(invoiceResult.rows, "costs");
  const payoutRanking = rank(payoutResult.rows, "payouts");
  const accounts = new Map<string, { costs: number; payouts: number }>();
  costRanking.forEach((item) =>
    accounts.set(item.name, { costs: Number(item.costs), payouts: 0 }),
  );
  payoutRanking.forEach((item) => {
    const current = accounts.get(item.name) ?? { costs: 0, payouts: 0 };
    current.payouts += Number(item.payouts);
    accounts.set(item.name, current);
  });
  const accountRanking = [...accounts.entries()]
    .map(([name, values]) => ({
      name,
      costs: values.costs,
      payouts: values.payouts,
      net: values.payouts - values.costs,
      roi: values.costs > 0 ? ((values.payouts - values.costs) / values.costs) * 100 : 0,
    }))
    .sort((a, b) => b.net - a.net);

  return NextResponse.json({
    report: {
      month,
      costs,
      payouts,
      net,
      roi,
      bestAccount: accountRanking[0] ?? null,
      worstAccount: [...accountRanking].sort((a, b) => a.net - b.net)[0] ?? null,
      bestPropFirm: payoutRanking[0]?.name.split(" • ")[0] ?? null,
      recommendation:
        net >= 0
          ? "Měsíc je v plusu. Zvaž navýšit pozornost účtům s nejlepším ROI."
          : "Měsíc je ve ztrátě. Zkontroluj resety, failed účty a firmy s nulovým payoutem.",
      accounts: accountRanking,
    },
  });
}
