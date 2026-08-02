"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

type Currency = "CZK" | "EUR" | "USD";

type Invoice = {
  id: string;
  propFirm: string;
  program: string;
  amount: number;
  currency: Currency;
  date: string;
  fileName?: string;
  note?: string;
};

type Payout = {
  id: string;
  propFirm: string;
  amount: number;
  currency: Currency;
  date: string;
  split: number;
  note?: string;
};

type UserData = {
  invoices: Invoice[];
  payouts: Payout[];
};

const DEMO_INVOICES: Invoice[] = [
  {
    id: "inv-demo-1",
    propFirm: "FTMO",
    program: "Challenge 100k",
    amount: 540,
    currency: "EUR",
    date: "2026-07-08",
    fileName: "ftmo-challenge-demo.pdf",
    note: "Ukázková faktura",
  },
  {
    id: "inv-demo-2",
    propFirm: "The5ers",
    program: "High Stakes",
    amount: 312,
    currency: "USD",
    date: "2026-07-21",
    fileName: "the5ers-demo.pdf",
  },
];

const DEMO_PAYOUTS: Payout[] = [
  {
    id: "pay-demo-1",
    propFirm: "FTMO",
    amount: 1680,
    currency: "EUR",
    date: "2026-07-31",
    split: 80,
    note: "První payout",
  },
];

const exchangeToCzk: Record<Currency, number> = {
  CZK: 1,
  EUR: 25.1,
  USD: 23.1,
};

const propFirmHints = [
  "FTMO",
  "The5ers",
  "FundedNext",
  "Alpha Capital",
  "Apex Trader Funding",
  "Topstep",
  "E8 Markets",
  "Funding Pips",
  "MyFundedFX",
];

const emptyInvoice: Omit<Invoice, "id"> = {
  propFirm: "",
  program: "",
  amount: 0,
  currency: "EUR",
  date: new Date().toISOString().slice(0, 10),
  fileName: "",
  note: "",
};

const emptyPayout: Omit<Payout, "id"> = {
  propFirm: "",
  amount: 0,
  currency: "EUR",
  date: new Date().toISOString().slice(0, 10),
  split: 80,
  note: "",
};

function czk(value: number) {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(value);
}

function money(value: number, currency: Currency) {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "CZK" ? 0 : 2,
  }).format(value);
}

function toCzk(value: number, currency: Currency) {
  return value * exchangeToCzk[currency];
}

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function storageKey(email: string) {
  return `trader-cost-hub:${email.trim().toLowerCase()}`;
}

function monthLabel(date: string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function parseInvoiceText(text: string) {
  const clean = text.replace(/\s+/g, " ");
  const firm = propFirmHints.find((hint) =>
    clean.toLowerCase().includes(hint.toLowerCase()),
  );
  const amountMatch = clean.match(
    /(?:total|amount|celkem|částka|price|paid)[^\d]{0,24}(\d{1,6}(?:[,.]\d{1,2})?)/i,
  );
  const dateMatch = clean.match(
    /(\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/,
  );
  const currency =
    clean.includes("CZK") || clean.includes("Kč")
      ? "CZK"
      : clean.includes("USD") || clean.includes("$")
        ? "USD"
        : "EUR";

  return {
    propFirm: firm ?? "",
    amount: amountMatch
      ? Number(amountMatch[1].replace(",", "."))
      : undefined,
    currency: currency as Currency,
    date: dateMatch?.[1],
  };
}

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activeUser, setActiveUser] = useState("");
  const [invoiceDraft, setInvoiceDraft] =
    useState<Omit<Invoice, "id">>(emptyInvoice);
  const [payoutDraft, setPayoutDraft] = useState<Omit<Payout, "id">>(emptyPayout);
  const [data, setData] = useState<UserData>({
    invoices: DEMO_INVOICES,
    payouts: DEMO_PAYOUTS,
  });
  const [message, setMessage] = useState(
    "Přihlas se demo účtem nebo napiš vlastní e-mail. Data se v této verzi ukládají jen v tvém prohlížeči.",
  );

  useEffect(() => {
    const session = window.localStorage.getItem("trader-cost-hub:session");
    if (session) {
      setActiveUser(session);
    }
  }, []);

  useEffect(() => {
    if (!activeUser) return;
    const saved = window.localStorage.getItem(storageKey(activeUser));
    setData(saved ? JSON.parse(saved) : { invoices: [], payouts: [] });
  }, [activeUser]);

  useEffect(() => {
    if (!activeUser) return;
    window.localStorage.setItem(storageKey(activeUser), JSON.stringify(data));
  }, [activeUser, data]);

  const summary = useMemo(() => {
    const costs = data.invoices.reduce(
      (sum, invoice) => sum + toCzk(invoice.amount, invoice.currency),
      0,
    );
    const payouts = data.payouts.reduce(
      (sum, payout) => sum + toCzk(payout.amount, payout.currency),
      0,
    );
    const net = payouts - costs;
    const roi = costs > 0 ? (net / costs) * 100 : 0;
    const byFirm = [...data.invoices, ...data.payouts].reduce<
      Record<string, { costs: number; payouts: number }>
    >((acc, item) => {
      const firm = item.propFirm || "Nezařazeno";
      acc[firm] ??= { costs: 0, payouts: 0 };
      if ("program" in item) {
        acc[firm].costs += toCzk(item.amount, item.currency);
      } else {
        acc[firm].payouts += toCzk(item.amount, item.currency);
      }
      return acc;
    }, {});
    const monthly = [...data.invoices, ...data.payouts]
      .reduce<Record<string, { costs: number; payouts: number }>>((acc, item) => {
        const label = monthLabel(item.date);
        acc[label] ??= { costs: 0, payouts: 0 };
        if ("program" in item) {
          acc[label].costs += toCzk(item.amount, item.currency);
        } else {
          acc[label].payouts += toCzk(item.amount, item.currency);
        }
        return acc;
      }, {});

    return {
      costs,
      payouts,
      net,
      roi,
      byFirm: Object.entries(byFirm),
      monthly: Object.entries(monthly).slice(-6),
    };
  }, [data]);

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.includes("@") || password.length < 4) {
      setMessage("Zadej e-mail a heslo alespoň na 4 znaky.");
      return;
    }
    const normalized = email.trim().toLowerCase();
    window.localStorage.setItem("trader-cost-hub:session", normalized);
    setActiveUser(normalized);
    setMessage("Jsi přihlášený. Každý e-mail má oddělená lokální data.");
  }

  function logout() {
    window.localStorage.removeItem("trader-cost-hub:session");
    setActiveUser("");
    setEmail("");
    setPassword("");
    setData({ invoices: DEMO_INVOICES, payouts: DEMO_PAYOUTS });
    setMessage("Odhlášeno. Ukazuji jen demo data.");
  }

  function addInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invoiceDraft.propFirm || invoiceDraft.amount <= 0) {
      setMessage("U faktury doplň prop firmu a částku.");
      return;
    }
    setData((current) => ({
      ...current,
      invoices: [
        {
          ...invoiceDraft,
          id: makeId("invoice"),
          amount: Number(invoiceDraft.amount),
        },
        ...current.invoices,
      ],
    }));
    setInvoiceDraft(emptyInvoice);
    setMessage("Náklad z faktury je uložený v přehledu.");
  }

  function addPayout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!payoutDraft.propFirm || payoutDraft.amount <= 0) {
      setMessage("U payoutu doplň prop firmu a vyplacenou částku.");
      return;
    }
    setData((current) => ({
      ...current,
      payouts: [
        {
          ...payoutDraft,
          id: makeId("payout"),
          amount: Number(payoutDraft.amount),
          split: Number(payoutDraft.split),
        },
        ...current.payouts,
      ],
    }));
    setPayoutDraft(emptyPayout);
    setMessage("Payout je přidaný. Souhrny se přepočítaly.");
  }

  function removeInvoice(id: string) {
    setData((current) => ({
      ...current,
      invoices: current.invoices.filter((invoice) => invoice.id !== id),
    }));
  }

  function removePayout(id: string) {
    setData((current) => ({
      ...current,
      payouts: current.payouts.filter((payout) => payout.id !== id),
    }));
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setInvoiceDraft((current) => ({ ...current, fileName: file.name }));
    if (file.type.includes("text") || file.name.match(/\.(txt|csv)$/i)) {
      const reader = new FileReader();
      reader.onload = () => {
        const parsed = parseInvoiceText(String(reader.result ?? ""));
        setInvoiceDraft((current) => ({
          ...current,
          propFirm: parsed.propFirm || current.propFirm,
          amount: parsed.amount ?? current.amount,
          currency: parsed.currency || current.currency,
          date: parsed.date || current.date,
          fileName: file.name,
        }));
        setMessage("Z textové faktury jsem zkusil vytáhnout prop firmu, částku a měnu.");
      };
      reader.readAsText(file);
    } else {
      setMessage("Soubor je připojený. U PDF zatím doplň částku ručně.");
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "trader-cost-hub-export.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  const maxMonthly = Math.max(
    1,
    ...summary.monthly.map(([, values]) => values.costs + values.payouts),
  );

  return (
    <main className="min-h-screen overflow-hidden bg-[#060915] text-white">
      <div className="glow glow-one" />
      <div className="glow glow-two" />

      <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10">
        <nav className="glass flex flex-col gap-4 rounded-[2rem] px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="eyebrow">Prop trading finance tracker</p>
            <h1 className="text-2xl font-black tracking-tight md:text-3xl">
              Trader Cost Hub
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
            <span className="status-dot" />
            {activeUser ? (
              <>
                <span>{activeUser}</span>
                <button className="ghost-button" onClick={logout}>
                  Odhlásit
                </button>
              </>
            ) : (
              <span>Demo režim</span>
            )}
          </div>
        </nav>

        <header className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="hero-card">
            <p className="eyebrow">Náklady • faktury • payouty • ROI</p>
            <h2>
              Přehled, který ti ukáže, jestli prop trading opravdu vydělává.
            </h2>
            <p>
              Nahraj fakturu nebo vlož challenge fee ručně, přidej payouty a
              sleduj čistý výsledek po prop firmách i měsících. První verze je
              připravená pro více lokálních uživatelů podle e-mailu.
            </p>
            <div className="hero-actions">
              <a href="#invoice" className="primary-button">
                Přidat fakturu
              </a>
              <a href="#payout" className="secondary-button">
                Přidat payout
              </a>
            </div>
          </div>

          <form className="login-card" onSubmit={handleLogin}>
            <div>
              <p className="eyebrow">Přihlášení</p>
              <h3>Oddělený prostor pro každého tradera</h3>
              <p>{message}</p>
            </div>
            <label>
              E-mail
              <input
                type="email"
                placeholder="trader@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label>
              Heslo pro prototyp
              <input
                type="password"
                placeholder="min. 4 znaky"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button className="primary-button w-full" type="submit">
              Přihlásit / vytvořit lokální účet
            </button>
          </form>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Náklady na prop firmy" value={czk(summary.costs)} />
          <Metric label="Payouty celkem" value={czk(summary.payouts)} />
          <Metric
            label="Čistý výsledek"
            value={czk(summary.net)}
            positive={summary.net >= 0}
          />
          <Metric
            label="ROI po nákladech"
            value={`${summary.roi.toFixed(1)} %`}
            positive={summary.roi >= 0}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <form id="invoice" className="panel" onSubmit={addInvoice}>
            <div className="section-title">
              <div>
                <p className="eyebrow">Faktury a challenge fees</p>
                <h3>Přidat náklad</h3>
              </div>
              <span className="pill">PDF / CSV / ručně</span>
            </div>
            <label className="file-drop">
              <input
                type="file"
                accept=".pdf,.txt,.csv,image/*"
                onChange={handleFile}
              />
              <span>Nahraj fakturu z prop firmy</span>
              <small>
                Text/CSV zkusím předvyplnit. PDF v další verzi napojíme na OCR.
              </small>
            </label>
            <div className="form-grid">
              <label>
                Prop firma
                <input
                  list="prop-firms"
                  value={invoiceDraft.propFirm}
                  onChange={(event) =>
                    setInvoiceDraft({
                      ...invoiceDraft,
                      propFirm: event.target.value,
                    })
                  }
                  placeholder="FTMO, The5ers..."
                />
              </label>
              <label>
                Program
                <input
                  value={invoiceDraft.program}
                  onChange={(event) =>
                    setInvoiceDraft({
                      ...invoiceDraft,
                      program: event.target.value,
                    })
                  }
                  placeholder="Challenge 100k"
                />
              </label>
              <label>
                Částka
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={invoiceDraft.amount || ""}
                  onChange={(event) =>
                    setInvoiceDraft({
                      ...invoiceDraft,
                      amount: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                Měna
                <select
                  value={invoiceDraft.currency}
                  onChange={(event) =>
                    setInvoiceDraft({
                      ...invoiceDraft,
                      currency: event.target.value as Currency,
                    })
                  }
                >
                  <option>CZK</option>
                  <option>EUR</option>
                  <option>USD</option>
                </select>
              </label>
              <label>
                Datum
                <input
                  type="date"
                  value={invoiceDraft.date}
                  onChange={(event) =>
                    setInvoiceDraft({ ...invoiceDraft, date: event.target.value })
                  }
                />
              </label>
              <label>
                Poznámka
                <input
                  value={invoiceDraft.note}
                  onChange={(event) =>
                    setInvoiceDraft({ ...invoiceDraft, note: event.target.value })
                  }
                  placeholder="refund, reset, extra účet..."
                />
              </label>
            </div>
            <button className="primary-button" type="submit">
              Uložit náklad
            </button>
          </form>

          <form id="payout" className="panel" onSubmit={addPayout}>
            <div className="section-title">
              <div>
                <p className="eyebrow">Výplaty z prop firem</p>
                <h3>Přidat payout</h3>
              </div>
              <span className="pill">Net / Gross podle zadání</span>
            </div>
            <div className="form-grid">
              <label>
                Prop firma
                <input
                  list="prop-firms"
                  value={payoutDraft.propFirm}
                  onChange={(event) =>
                    setPayoutDraft({
                      ...payoutDraft,
                      propFirm: event.target.value,
                    })
                  }
                  placeholder="FTMO, Topstep..."
                />
              </label>
              <label>
                Vyplacená částka
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={payoutDraft.amount || ""}
                  onChange={(event) =>
                    setPayoutDraft({
                      ...payoutDraft,
                      amount: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                Měna
                <select
                  value={payoutDraft.currency}
                  onChange={(event) =>
                    setPayoutDraft({
                      ...payoutDraft,
                      currency: event.target.value as Currency,
                    })
                  }
                >
                  <option>CZK</option>
                  <option>EUR</option>
                  <option>USD</option>
                </select>
              </label>
              <label>
                Profit split %
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={payoutDraft.split}
                  onChange={(event) =>
                    setPayoutDraft({
                      ...payoutDraft,
                      split: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                Datum
                <input
                  type="date"
                  value={payoutDraft.date}
                  onChange={(event) =>
                    setPayoutDraft({ ...payoutDraft, date: event.target.value })
                  }
                />
              </label>
              <label>
                Poznámka
                <input
                  value={payoutDraft.note}
                  onChange={(event) =>
                    setPayoutDraft({ ...payoutDraft, note: event.target.value })
                  }
                  placeholder="withdrawal, bank fee..."
                />
              </label>
            </div>
            <button className="primary-button" type="submit">
              Uložit payout
            </button>
          </form>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="panel">
            <div className="section-title">
              <div>
                <p className="eyebrow">Měsíční vývoj</p>
                <h3>Cashflow</h3>
              </div>
              <button className="ghost-button" onClick={exportJson}>
                Export JSON
              </button>
            </div>
            <div className="chart">
              {summary.monthly.length === 0 ? (
                <p className="muted">Zatím nejsou žádná data.</p>
              ) : (
                summary.monthly.map(([month, values]) => (
                  <div className="chart-row" key={month}>
                    <span>{month}</span>
                    <div className="bar-track">
                      <div
                        className="bar bar-cost"
                        style={{ width: `${(values.costs / maxMonthly) * 100}%` }}
                      />
                      <div
                        className="bar bar-pay"
                        style={{
                          width: `${(values.payouts / maxMonthly) * 100}%`,
                        }}
                      />
                    </div>
                    <strong>{czk(values.payouts - values.costs)}</strong>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="panel">
            <div className="section-title">
              <div>
                <p className="eyebrow">Podle prop firmy</p>
                <h3>Kde peníze tečou dovnitř a ven</h3>
              </div>
            </div>
            <div className="firm-grid">
              {summary.byFirm.length === 0 ? (
                <p className="muted">Přidej první fakturu nebo payout.</p>
              ) : (
                summary.byFirm.map(([firm, values]) => (
                  <article className="firm-card" key={firm}>
                    <span>{firm}</span>
                    <strong>{czk(values.payouts - values.costs)}</strong>
                    <small>
                      Náklady {czk(values.costs)} • Payouty {czk(values.payouts)}
                    </small>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <RecordsTable
            title="Náklady"
            empty="Zatím žádné uložené faktury."
            rows={data.invoices.map((invoice) => ({
              id: invoice.id,
              name: invoice.propFirm,
              detail: invoice.program || invoice.fileName || "Faktura",
              amount: money(invoice.amount, invoice.currency),
              date: invoice.date,
              note: invoice.note,
            }))}
            onRemove={removeInvoice}
          />
          <RecordsTable
            title="Payouty"
            empty="Zatím žádné uložené payouty."
            rows={data.payouts.map((payout) => ({
              id: payout.id,
              name: payout.propFirm,
              detail: `${payout.split}% split`,
              amount: money(payout.amount, payout.currency),
              date: payout.date,
              note: payout.note,
            }))}
            onRemove={removePayout}
          />
        </section>

        <section className="roadmap">
          <p className="eyebrow">Další produkční krok</p>
          <h3>Napojení na skutečný backend</h3>
          <p>
            Pro veřejné použití přidáme opravdové účty, databázi, bezpečné
            ukládání faktur a OCR čtení PDF. Tato první verze slouží jako přesný
            návrh workflow a vzhledu, abychom věděli, co má být v ostré appce.
          </p>
        </section>

        <datalist id="prop-firms">
          {propFirmHints.map((firm) => (
            <option value={firm} key={firm} />
          ))}
        </datalist>
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong className={positive === false ? "negative" : ""}>{value}</strong>
    </article>
  );
}

function RecordsTable({
  title,
  empty,
  rows,
  onRemove,
}: {
  title: string;
  empty: string;
  rows: {
    id: string;
    name: string;
    detail: string;
    amount: string;
    date: string;
    note?: string;
  }[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="panel table-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">Historie</p>
          <h3>{title}</h3>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <div className="records">
          {rows.map((row) => (
            <article className="record" key={row.id}>
              <div>
                <strong>{row.name}</strong>
                <span>{row.detail}</span>
                {row.note ? <small>{row.note}</small> : null}
              </div>
              <div className="record-side">
                <strong>{row.amount}</strong>
                <span>{row.date}</span>
                <button onClick={() => onRemove(row.id)}>Smazat</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
