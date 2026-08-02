"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { AuthUser, Currency, Invoice, Payout } from "@/lib/types";

type UserData = {
  invoices: Invoice[];
  payouts: Payout[];
};

type AuthMode = "login" | "register";

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

const defaultInvoice = () => ({
  propFirm: "",
  program: "",
  amount: "",
  currency: "EUR" as Currency,
  date: new Date().toISOString().slice(0, 10),
  fileName: "",
  note: "",
});

const defaultPayout = () => ({
  propFirm: "",
  amount: "",
  currency: "EUR" as Currency,
  date: new Date().toISOString().slice(0, 10),
  split: "80",
  note: "",
});

function formatCzk(value: number) {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMoney(value: number, currency: Currency) {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "CZK" ? 0 : 2,
  }).format(value);
}

function toCzk(value: number, currency: Currency) {
  return value * exchangeToCzk[currency];
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
    amount: amountMatch?.[1]?.replace(",", ".") ?? "",
    currency: currency as Currency,
    date: dateMatch?.[1],
  };
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    headers,
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error ?? "Něco se nepovedlo. Zkus to prosím znovu.");
  }

  return payload as T;
}

export default function Home() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [databaseReady, setDatabaseReady] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [invoiceDraft, setInvoiceDraft] = useState(defaultInvoice);
  const [payoutDraft, setPayoutDraft] = useState(defaultPayout);
  const [data, setData] = useState<UserData>({ invoices: [], payouts: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState(
    "Přihlas se nebo si vytvoř účet. Každý trader má vlastní oddělená data.",
  );

  useEffect(() => {
    async function boot() {
      try {
        const result = await api<{ user: AuthUser | null; databaseReady: boolean }>(
          "/api/auth/me",
        );
        setUser(result.user);
        setDatabaseReady(result.databaseReady);
        if (result.user) {
          await loadData();
          setMessage("Data jsou načtená z databáze.");
        } else if (!result.databaseReady) {
          setMessage("Databáze zatím není nastavená. Přidej POSTGRES_URL ve Vercelu.");
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Aplikaci se nepodařilo načíst.");
      } finally {
        setIsLoading(false);
      }
    }
    boot();
  }, []);

  async function loadData() {
    const [invoiceResult, payoutResult] = await Promise.all([
      api<{ invoices: Invoice[] }>("/api/invoices"),
      api<{ payouts: Payout[] }>("/api/payouts"),
    ]);
    setData({
      invoices: invoiceResult.invoices,
      payouts: payoutResult.payouts,
    });
  }

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
    const monthly = [...data.invoices, ...data.payouts].reduce<
      Record<string, { costs: number; payouts: number }>
    >((acc, item) => {
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

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const endpoint =
        authMode === "register" ? "/api/auth/register" : "/api/auth/login";
      const result = await api<{ user: AuthUser }>(endpoint, {
        method: "POST",
        body: JSON.stringify(authForm),
      });
      setUser(result.user);
      setAuthForm({ name: "", email: "", password: "" });
      await loadData();
      setMessage(
        authMode === "register"
          ? "Účet je vytvořený. Vítej v dashboardu."
          : "Přihlášení proběhlo úspěšně.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Přihlášení se nepovedlo.");
    } finally {
      setIsSaving(false);
    }
  }

  async function logout() {
    await api<{ ok: true }>("/api/auth/logout", { method: "POST" });
    setUser(null);
    setData({ invoices: [], payouts: [] });
    setMessage("Odhlášeno. Můžeš se přihlásit pod jiným účtem.");
  }

  async function addInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const result = await api<{ invoice: Invoice }>("/api/invoices", {
        method: "POST",
        body: JSON.stringify({
          ...invoiceDraft,
          amount: Number(invoiceDraft.amount),
        }),
      });
      setData((current) => ({
        ...current,
        invoices: [result.invoice, ...current.invoices],
      }));
      setInvoiceDraft(defaultInvoice());
      setMessage("Náklad je uložený v databázi.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Náklad se nepodařilo uložit.");
    } finally {
      setIsSaving(false);
    }
  }

  async function addPayout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const result = await api<{ payout: Payout }>("/api/payouts", {
        method: "POST",
        body: JSON.stringify({
          ...payoutDraft,
          amount: Number(payoutDraft.amount),
          split: Number(payoutDraft.split),
        }),
      });
      setData((current) => ({
        ...current,
        payouts: [result.payout, ...current.payouts],
      }));
      setPayoutDraft(defaultPayout());
      setMessage("Payout je uložený v databázi.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payout se nepodařilo uložit.");
    } finally {
      setIsSaving(false);
    }
  }

  async function removeInvoice(id: string) {
    await api<{ ok: true }>(`/api/invoices/${id}`, { method: "DELETE" });
    setData((current) => ({
      ...current,
      invoices: current.invoices.filter((invoice) => invoice.id !== id),
    }));
  }

  async function removePayout(id: string) {
    await api<{ ok: true }>(`/api/payouts/${id}`, { method: "DELETE" });
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
          amount: parsed.amount || current.amount,
          currency: parsed.currency,
          date: parsed.date || current.date,
          fileName: file.name,
        }));
        setMessage("Z textové faktury jsem zkusil předvyplnit firmu, částku a měnu.");
      };
      reader.readAsText(file);
    } else {
      setMessage("Soubor je připojený jako název faktury. Pro ukládání PDF přidáme Vercel Blob v dalším kroku.");
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
    <main className="app-shell">
      <div className="aurora aurora-a" />
      <div className="aurora aurora-b" />
      <div className="noise" />

      <section className="page-wrap">
        <nav className="topbar">
          <div className="brand">
            <span className="brand-mark">T</span>
            <div>
              <p>Trader Cost Hub</p>
              <small>Prop trading finance OS</small>
            </div>
          </div>
          <div className="topbar-actions">
            <span className={databaseReady ? "live-pill" : "live-pill warning"}>
              {databaseReady ? "DB online" : "DB missing"}
            </span>
            {user ? (
              <>
                <span className="user-pill">{user.name}</span>
                <button className="ghost-button" onClick={logout}>
                  Odhlásit
                </button>
              </>
            ) : null}
          </div>
        </nav>

        <header className="hero-grid">
          <section className="hero-panel">
            <p className="eyebrow">Multi-user dashboard • účty • databáze</p>
            <h1>Tvůj trading byznys v jednom čistém přehledu.</h1>
            <p>
              Registrace, bezpečné přihlášení, oddělená data pro každého
              tradera, náklady z prop firem, payouty, ROI a cashflow. Bez
              tabulek rozházených po disku — konečně jeden systém.
            </p>
            <div className="hero-stats">
              <span>Serverové účty</span>
              <span>Postgres databáze</span>
              <span>Vercel ready</span>
            </div>
          </section>

          <section className="auth-card">
            {!user ? (
              <form onSubmit={handleAuth}>
                <div className="auth-switch">
                  <button
                    type="button"
                    className={authMode === "login" ? "active" : ""}
                    onClick={() => setAuthMode("login")}
                  >
                    Přihlášení
                  </button>
                  <button
                    type="button"
                    className={authMode === "register" ? "active" : ""}
                    onClick={() => setAuthMode("register")}
                  >
                    Registrace
                  </button>
                </div>

                <h2>
                  {authMode === "register"
                    ? "Vytvořit nový účet"
                    : "Přihlásit se do účtu"}
                </h2>
                <p className="muted">{message}</p>

                {authMode === "register" ? (
                  <label>
                    Jméno
                    <input
                      value={authForm.name}
                      onChange={(event) =>
                        setAuthForm({ ...authForm, name: event.target.value })
                      }
                      placeholder="Miskus"
                    />
                  </label>
                ) : null}

                <label>
                  E-mail
                  <input
                    type="email"
                    value={authForm.email}
                    onChange={(event) =>
                      setAuthForm({ ...authForm, email: event.target.value })
                    }
                    placeholder="trader@example.com"
                    autoComplete="email"
                  />
                </label>

                <label>
                  Heslo
                  <input
                    type="password"
                    value={authForm.password}
                    onChange={(event) =>
                      setAuthForm({ ...authForm, password: event.target.value })
                    }
                    placeholder="min. 8 znaků"
                    autoComplete={
                      authMode === "register" ? "new-password" : "current-password"
                    }
                  />
                </label>

                <button
                  className="primary-button full"
                  disabled={isSaving || isLoading || !databaseReady}
                  type="submit"
                >
                  {isSaving
                    ? "Pracuju..."
                    : authMode === "register"
                      ? "Registrovat"
                      : "Přihlásit"}
                </button>

                {!databaseReady ? (
                  <p className="setup-note">
                    Ve Vercelu přidej Postgres databázi a nastav proměnnou
                    <code>POSTGRES_URL</code>.
                  </p>
                ) : null}
              </form>
            ) : (
              <div className="welcome-card">
                <p className="eyebrow">Přihlášený účet</p>
                <h2>{user.name}</h2>
                <p>{user.email}</p>
                <p className="muted">{message}</p>
                <div className="welcome-grid">
                  <span>{data.invoices.length} nákladů</span>
                  <span>{data.payouts.length} payoutů</span>
                </div>
              </div>
            )}
          </section>
        </header>

        {user ? (
          <>
            <section className="metrics-grid">
              <Metric label="Náklady na prop firmy" value={formatCzk(summary.costs)} />
              <Metric label="Payouty celkem" value={formatCzk(summary.payouts)} />
              <Metric
                label="Čistý výsledek"
                value={formatCzk(summary.net)}
                positive={summary.net >= 0}
              />
              <Metric
                label="ROI po nákladech"
                value={`${summary.roi.toFixed(1)} %`}
                positive={summary.roi >= 0}
              />
            </section>

            <section className="workspace-grid">
              <form id="invoice" className="panel form-panel" onSubmit={addInvoice}>
                <div className="section-title">
                  <div>
                    <p className="eyebrow">Faktury a challenge fees</p>
                    <h2>Přidat náklad</h2>
                  </div>
                  <span className="soft-pill">DB save</span>
                </div>

                <label className="file-drop">
                  <input
                    type="file"
                    accept=".pdf,.txt,.csv,image/*"
                    onChange={handleFile}
                  />
                  <strong>Nahrát fakturu</strong>
                  <small>
                    Teď ukládám název souboru a metadata. Pro reálné PDF úložiště
                    přidáme Vercel Blob.
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
                      value={invoiceDraft.amount}
                      onChange={(event) =>
                        setInvoiceDraft({
                          ...invoiceDraft,
                          amount: event.target.value,
                        })
                      }
                    />
                  </label>
                  <CurrencySelect
                    value={invoiceDraft.currency}
                    onChange={(currency) =>
                      setInvoiceDraft({ ...invoiceDraft, currency })
                    }
                  />
                  <label>
                    Datum
                    <input
                      type="date"
                      value={invoiceDraft.date}
                      onChange={(event) =>
                        setInvoiceDraft({
                          ...invoiceDraft,
                          date: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Poznámka
                    <input
                      value={invoiceDraft.note}
                      onChange={(event) =>
                        setInvoiceDraft({
                          ...invoiceDraft,
                          note: event.target.value,
                        })
                      }
                      placeholder="refund, reset, extra účet..."
                    />
                  </label>
                </div>
                <button className="primary-button" disabled={isSaving} type="submit">
                  Uložit náklad
                </button>
              </form>

              <form id="payout" className="panel form-panel" onSubmit={addPayout}>
                <div className="section-title">
                  <div>
                    <p className="eyebrow">Výplaty z prop firem</p>
                    <h2>Přidat payout</h2>
                  </div>
                  <span className="soft-pill">Profit split</span>
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
                      value={payoutDraft.amount}
                      onChange={(event) =>
                        setPayoutDraft({
                          ...payoutDraft,
                          amount: event.target.value,
                        })
                      }
                    />
                  </label>
                  <CurrencySelect
                    value={payoutDraft.currency}
                    onChange={(currency) =>
                      setPayoutDraft({ ...payoutDraft, currency })
                    }
                  />
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
                          split: event.target.value,
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
                        setPayoutDraft({
                          ...payoutDraft,
                          date: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Poznámka
                    <input
                      value={payoutDraft.note}
                      onChange={(event) =>
                        setPayoutDraft({
                          ...payoutDraft,
                          note: event.target.value,
                        })
                      }
                      placeholder="withdrawal, bank fee..."
                    />
                  </label>
                </div>
                <button className="primary-button" disabled={isSaving} type="submit">
                  Uložit payout
                </button>
              </form>
            </section>

            <section className="analytics-grid">
              <div className="panel">
                <div className="section-title">
                  <div>
                    <p className="eyebrow">Měsíční vývoj</p>
                    <h2>Cashflow</h2>
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
                            style={{
                              width: `${(values.costs / maxMonthly) * 100}%`,
                            }}
                          />
                          <div
                            className="bar bar-pay"
                            style={{
                              width: `${(values.payouts / maxMonthly) * 100}%`,
                            }}
                          />
                        </div>
                        <strong>{formatCzk(values.payouts - values.costs)}</strong>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="panel">
                <div className="section-title">
                  <div>
                    <p className="eyebrow">Podle prop firmy</p>
                    <h2>Výsledek podle zdroje</h2>
                  </div>
                </div>
                <div className="firm-grid">
                  {summary.byFirm.length === 0 ? (
                    <p className="muted">Přidej první fakturu nebo payout.</p>
                  ) : (
                    summary.byFirm.map(([firm, values]) => (
                      <article className="firm-card" key={firm}>
                        <span>{firm}</span>
                        <strong>{formatCzk(values.payouts - values.costs)}</strong>
                        <small>
                          Náklady {formatCzk(values.costs)} · Payouty{" "}
                          {formatCzk(values.payouts)}
                        </small>
                      </article>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="records-grid">
              <RecordsTable
                title="Náklady"
                empty="Zatím žádné uložené faktury."
                rows={data.invoices.map((invoice) => ({
                  id: invoice.id,
                  name: invoice.propFirm,
                  detail: invoice.program || invoice.fileName || "Faktura",
                  amount: formatMoney(invoice.amount, invoice.currency),
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
                  amount: formatMoney(payout.amount, payout.currency),
                  date: payout.date,
                  note: payout.note,
                }))}
                onRemove={removePayout}
              />
            </section>
          </>
        ) : (
          <section className="feature-grid">
            <Feature
              title="Více uživatelů"
              text="Každý účet má vlastní záznamy. Data se už nemíchají v jednom prohlížeči."
            />
            <Feature
              title="Databáze účtů"
              text="Uživatelé, faktury i payouty se ukládají do Postgres databáze."
            />
            <Feature
              title="Vercel ready"
              text="Next.js API routes, serverové cookies a produkční build pro Vercel."
            />
          </section>
        )}

        <datalist id="prop-firms">
          {propFirmHints.map((firm) => (
            <option value={firm} key={firm} />
          ))}
        </datalist>
      </section>
    </main>
  );
}

function CurrencySelect({
  value,
  onChange,
}: {
  value: Currency;
  onChange: (currency: Currency) => void;
}) {
  return (
    <label>
      Měna
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as Currency)}
      >
        <option>CZK</option>
        <option>EUR</option>
        <option>USD</option>
      </select>
    </label>
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

function Feature({ title, text }: { title: string; text: string }) {
  return (
    <article className="feature-card">
      <span />
      <h3>{title}</h3>
      <p>{text}</p>
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
    note?: string | null;
  }[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">Historie</p>
          <h2>{title}</h2>
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
                <button type="button" onClick={() => onRemove(row.id)}>
                  Smazat
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
