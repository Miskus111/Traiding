"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { AuthUser, Currency, Invoice, Payout } from "@/lib/types";

type UserData = {
  invoices: Invoice[];
  payouts: Payout[];
};

type AuthMode = "login" | "register";
type RecognitionKind = "cost" | "payout" | "unknown";

type PropFirmHint = {
  name: string;
  aliases: string[];
};

type RecognitionResult = {
  kind: RecognitionKind;
  propFirm: string;
  program: string;
  amount: string;
  currency: Currency;
  date?: string;
  confidence: number;
  signals: string[];
  sourceName?: string;
};

const exchangeToCzk: Record<Currency, number> = {
  CZK: 1,
  EUR: 25.1,
  USD: 23.1,
};

const propFirmCatalog: PropFirmHint[] = [
  { name: "Alpha Capital", aliases: ["alpha capital", "alpha capital group"] },
  { name: "Apex Trader Funding", aliases: ["apex", "apex trader", "apex trader funding"] },
  { name: "Audacity Capital", aliases: ["audacity", "audacity capital"] },
  { name: "Blue Guardian", aliases: ["blue guardian", "blueguardian"] },
  { name: "BrightFunded", aliases: ["brightfunded", "bright funded"] },
  { name: "Bulenox", aliases: ["bulenox"] },
  { name: "City Traders Imperium", aliases: ["city traders imperium", "cti"] },
  { name: "DNA Funded", aliases: ["dna funded"] },
  { name: "E8 Markets", aliases: ["e8", "e8 markets", "e8 funding"] },
  { name: "Earn2Trade", aliases: ["earn2trade", "earn 2 trade"] },
  { name: "Finotive Funding", aliases: ["finotive", "finotive funding"] },
  { name: "FTMO", aliases: ["ftmo"] },
  { name: "FunderPro", aliases: ["funderpro", "funder pro"] },
  { name: "Funded Engineer", aliases: ["funded engineer"] },
  { name: "Funded Trading Plus", aliases: ["funded trading plus", "ftp prop"] },
  { name: "FundedNext", aliases: ["fundednext", "funded next"] },
  { name: "Funding Pips", aliases: ["funding pips", "fundingpips"] },
  { name: "FXIFY", aliases: ["fxify"] },
  { name: "Goat Funded Trader", aliases: ["goat funded", "goat funded trader"] },
  { name: "Hola Prime", aliases: ["hola prime", "holaprime"] },
  { name: "Instant Funding", aliases: ["instant funding"] },
  { name: "Karma Prop Traders", aliases: ["karma prop", "karma prop traders"] },
  { name: "Leeloo Trading", aliases: ["leeloo", "leeloo trading"] },
  { name: "Lucid Trading", aliases: ["lucid", "lucid trading", "lucid prop"] },
  { name: "Lux Trading Firm", aliases: ["lux trading", "lux trading firm"] },
  { name: "Maven Trading", aliases: ["maven", "maven trading"] },
  { name: "Ment Funding", aliases: ["ment funding"] },
  { name: "MyFundedFutures", aliases: ["myfundedfutures", "my funded futures"] },
  { name: "MyFundedFX", aliases: ["myfundedfx", "my funded fx"] },
  { name: "OANDA Prop Trader", aliases: ["oanda prop", "oanda prop trader"] },
  { name: "OneUp Trader", aliases: ["oneup", "oneup trader"] },
  { name: "Take Profit Trader", aliases: ["take profit trader", "tpt"] },
  { name: "The Trading Pit", aliases: ["the trading pit", "trading pit"] },
  { name: "The5ers", aliases: ["the5ers", "the 5ers", "5ers"] },
  { name: "Topstep", aliases: ["topstep", "topstep trader"] },
  { name: "TopTier Trader", aliases: ["toptier", "top tier trader", "toptier trader"] },
  { name: "Trade The Pool", aliases: ["trade the pool", "ttp"] },
  { name: "True Forex Funds", aliases: ["true forex funds", "trueforexfunds"] },
];

const propFirmHints = propFirmCatalog.map((firm) => firm.name);

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
  program: "",
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

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseMoney(value: string) {
  const cleaned = value.replace(/[^\d,.\s]/g, "").replace(/\s/g, "");
  if (!cleaned) return "";

  const comma = cleaned.lastIndexOf(",");
  const dot = cleaned.lastIndexOf(".");
  const decimalSeparator = comma > dot ? "," : dot > comma ? "." : "";
  const thousandsSeparator = decimalSeparator === "," ? "." : ",";
  const normalized = decimalSeparator
    ? cleaned
        .split(thousandsSeparator)
        .join("")
        .replace(decimalSeparator, ".")
    : cleaned;
  const amount = Number(normalized);

  return Number.isFinite(amount) && amount > 0 ? amount.toFixed(2) : "";
}

function inferCurrency(text: string, nearby = ""): Currency {
  const sample = `${nearby} ${text}`;
  if (/czk|kč|kc/i.test(sample)) return "CZK";
  if (/usd|\$|usdt/i.test(sample)) return "USD";
  return "EUR";
}

function normalizeDate(value?: string) {
  if (!value) return undefined;
  const clean = value.trim();
  const iso = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return clean;

  const local = clean.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!local) return undefined;

  const day = local[1].padStart(2, "0");
  const month = local[2].padStart(2, "0");
  const year = local[3].length === 2 ? `20${local[3]}` : local[3];
  return `${year}-${month}-${day}`;
}

function detectPropFirm(text: string) {
  const normalized = normalizeText(text);
  return (
    propFirmCatalog.find((firm) =>
      firm.aliases.some((alias) => normalized.includes(normalizeText(alias))),
    )?.name ?? ""
  );
}

function detectProgram(text: string) {
  const clean = text.replace(/\s+/g, " ");
  const explicit = clean.match(
    /(?:program|account|challenge|evaluation|funded account|účet|ucet)[^\w$€]{0,18}([$€]?\s?\d{1,3}(?:[.,\s]?\d{3})?\s?k?)/i,
  );
  const accountSize = clean.match(
    /(?:^|\s)(5k|10k|25k|50k|100k|150k|200k|250k|300k|400k|500k|1m|\d{2,3}\s?000)(?:\s|$)/i,
  );
  const value = explicit?.[1] ?? accountSize?.[1];

  return value ? `Account ${value.replace(/\s+/g, "").toUpperCase()}` : "";
}

function keywordScore(text: string, keywords: string[]) {
  const normalized = normalizeText(text);
  return keywords.reduce(
    (score, keyword) => score + (normalized.includes(normalizeText(keyword)) ? 1 : 0),
    0,
  );
}

function extractAmount(text: string, kind: RecognitionKind) {
  const clean = text.replace(/\s+/g, " ");
  const payoutKeywords =
    "payout|withdrawal|withdrawn|profit split|profit share|performance fee|distribution|vyplata|vyplaceno|vyplacena castka|vyber";
  const costKeywords =
    "total|amount due|amount paid|paid|price|fee|challenge fee|reset fee|activation fee|invoice total|celkem|castka|cena|uhrazeno|faktura";
  const preferred = kind === "payout" ? payoutKeywords : costKeywords;
  const secondary = kind === "payout" ? costKeywords : payoutKeywords;
  const money =
    "([$€]?\\s?\\d{1,3}(?:[\\s.,]?\\d{3})*(?:[,.]\\d{1,2})?|[$€]?\\s?\\d{2,6}(?:[,.]\\d{1,2})?)\\s?(CZK|Kč|KC|EUR|USD|€|\\$)?";
  const patterns = [
    new RegExp(`(?:${preferred})[^\\d$€]{0,60}${money}`, "i"),
    new RegExp(`${money}[^\\w$€]{0,30}(?:${preferred})`, "i"),
    new RegExp(`(?:${secondary})[^\\d$€]{0,60}${money}`, "i"),
  ];

  for (const pattern of patterns) {
    const match = clean.match(pattern);
    const amount = parseMoney(match?.[1] ?? "");
    if (amount) {
      return {
        amount,
        currency: inferCurrency(clean, `${match?.[0] ?? ""} ${match?.[2] ?? ""}`),
      };
    }
  }

  const allAmounts = [...clean.matchAll(new RegExp(money, "gi"))]
    .map((match) => ({
      amount: parseMoney(match[1]),
      currency: inferCurrency(clean, `${match[0]} ${match[2] ?? ""}`),
    }))
    .filter((candidate) => candidate.amount && Number(candidate.amount) > 0)
    .sort((a, b) => Number(b.amount) - Number(a.amount));

  return allAmounts[0] ?? { amount: "", currency: inferCurrency(clean) };
}

function parseTradingDocument(text: string, sourceName?: string): RecognitionResult {
  const clean = `${sourceName ?? ""} ${text}`.replace(/\s+/g, " ");
  const payoutScore = keywordScore(clean, [
    "payout",
    "withdrawal",
    "withdrawn",
    "profit split",
    "profit share",
    "performance fee",
    "distribution",
    "výplata",
    "vyplaceno",
    "výběr",
  ]);
  const costScore = keywordScore(clean, [
    "invoice",
    "receipt",
    "challenge fee",
    "reset fee",
    "activation fee",
    "payment",
    "paid",
    "order",
    "faktura",
    "uhrazeno",
    "celkem",
  ]);
  const kind: RecognitionKind =
    payoutScore > costScore ? "payout" : costScore > 0 ? "cost" : "unknown";
  const fallback = parseInvoiceText(clean);
  const amount = extractAmount(clean, kind);
  const detectedAmount = amount.amount || fallback.amount;
  const detectedCurrency = amount.amount ? amount.currency : fallback.currency;
  const date = normalizeDate(
    clean.match(/(\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/)?.[1],
  ) ?? normalizeDate(fallback.date);
  const propFirm = detectPropFirm(clean) || fallback.propFirm;
  const program = detectProgram(clean);
  const signals = [
    propFirm ? `Prop firma: ${propFirm}` : "",
    detectedAmount ? `Částka: ${formatMoney(Number(detectedAmount), detectedCurrency)}` : "",
    date ? `Datum: ${date}` : "",
    program ? `Program: ${program}` : "",
    kind === "payout" ? "Typ: payout/výplata" : "",
    kind === "cost" ? "Typ: náklad/faktura" : "",
  ].filter(Boolean);
  const confidence = Math.min(
    98,
    25 +
      (propFirm ? 22 : 0) +
      (detectedAmount ? 24 : 0) +
      (date ? 12 : 0) +
      (program ? 8 : 0) +
      (kind !== "unknown" ? 9 : 0),
  );

  return {
    kind,
    propFirm,
    program,
    amount: detectedAmount,
    currency: detectedCurrency,
    date,
    confidence,
    signals,
    sourceName,
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
  const [documentText, setDocumentText] = useState("");
  const [recognition, setRecognition] = useState<RecognitionResult | null>(null);
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
          setMessage(
            "Databáze zatím není nastavená. Ve Vercelu přidej Neon/Postgres proměnnou a SESSION_SECRET.",
          );
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
    const byFirm: Record<string, { costs: number; payouts: number }> = {};
    const byAccount: Record<string, { costs: number; payouts: number }> = {};
    const monthly: Record<string, { costs: number; payouts: number }> = {};

    data.invoices.forEach((invoice) => {
      const firm = invoice.propFirm || "Nezařazeno";
      const account = `${firm} • ${invoice.program || "Účet neuveden"}`;
      const month = monthLabel(invoice.date);
      const amount = toCzk(invoice.amount, invoice.currency);

      byFirm[firm] ??= { costs: 0, payouts: 0 };
      byFirm[firm].costs += amount;
      byAccount[account] ??= { costs: 0, payouts: 0 };
      byAccount[account].costs += amount;
      monthly[month] ??= { costs: 0, payouts: 0 };
      monthly[month].costs += amount;
    });

    data.payouts.forEach((payout) => {
      const firm = payout.propFirm || "Nezařazeno";
      const account = `${firm} • ${payout.program || "Účet neuveden"}`;
      const month = monthLabel(payout.date);
      const amount = toCzk(payout.amount, payout.currency);

      byFirm[firm] ??= { costs: 0, payouts: 0 };
      byFirm[firm].payouts += amount;
      byAccount[account] ??= { costs: 0, payouts: 0 };
      byAccount[account].payouts += amount;
      monthly[month] ??= { costs: 0, payouts: 0 };
      monthly[month].payouts += amount;
    });

    return {
      costs,
      payouts,
      net,
      roi,
      byFirm: Object.entries(byFirm),
      byAccount: Object.entries(byAccount),
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

  function applyRecognition(parsed: RecognitionResult, target?: Exclude<RecognitionKind, "unknown">) {
    const kind = target ?? (parsed.kind === "payout" ? "payout" : "cost");
    const note = parsed.signals.length
      ? `Rozpoznáno: ${parsed.signals.join(" • ")}`
      : "Rozpoznáno z dokladu.";

    if (kind === "payout") {
      setPayoutDraft((current) => ({
        ...current,
        propFirm: parsed.propFirm || current.propFirm,
        program: parsed.program || current.program,
        amount: parsed.amount || current.amount,
        currency: parsed.currency,
        date: parsed.date || current.date,
        note: current.note || note,
      }));
    } else {
      setInvoiceDraft((current) => ({
        ...current,
        propFirm: parsed.propFirm || current.propFirm,
        program: parsed.program || current.program,
        amount: parsed.amount || current.amount,
        currency: parsed.currency,
        date: parsed.date || current.date,
        fileName: parsed.sourceName || current.fileName,
        note: current.note || note,
      }));
    }
  }

  function recognizeText(text: string, sourceName?: string) {
    const parsed = parseTradingDocument(text, sourceName);
    setRecognition(parsed);
    applyRecognition(parsed);
    setMessage(
      parsed.signals.length
        ? `Rozpoznáno ${parsed.confidence}%: ${parsed.signals.join(" • ")}. Zkontroluj a ulož.`
        : "Z dokladu se nepodařilo najít jasná data. Zkus vložit delší text z faktury nebo payout e-mailu.",
    );
  }

  function handleSmartImport() {
    recognizeText(documentText);
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setInvoiceDraft((current) => ({ ...current, fileName: file.name }));
    if (file.type.includes("text") || file.name.match(/\.(txt|csv|pdf)$/i)) {
      const reader = new FileReader();
      reader.onload = () => {
        recognizeText(String(reader.result ?? ""), file.name);
      };
      reader.readAsText(file);
    } else {
      const parsed = parseTradingDocument(file.name, file.name);
      setRecognition(parsed);
      applyRecognition(parsed, "cost");
      setMessage(
        "U obrázku teď umím přečíst hlavně název souboru. Pro přesnější rozpoznání vlož text faktury nebo payout e-mailu do Smart importu.",
      );
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
            <p className="eyebrow">Launch-ready finance OS • Neon • Vercel</p>
            <h1>Profesionální dashboard pro každý funded účet.</h1>
            <p>
              Registrace, bezpečné přihlášení, oddělená data pro každého
              tradera, challenge fees, resety, faktury, payouty, ROI a cashflow.
              Všechno v jednom čistém systému připraveném na produkční provoz.
            </p>
            <div className="hero-stats">
              <span>Multi-user účty</span>
              <span>Neon Postgres</span>
              <span>Prop firm katalog</span>
              <span>Vercel launch</span>
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
                    Ve Vercelu přidej Neon/Postgres databázi a nastav jednu z
                    podporovaných databázových proměnných.
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

                <div className="smart-import">
                  <div className="section-title compact">
                    <div>
                      <p className="eyebrow">Smart import</p>
                      <h3>Vložit text faktury nebo payout e-mailu</h3>
                    </div>
                    <span className="soft-pill">auto detect</span>
                  </div>
                  <textarea
                    value={documentText}
                    onChange={(event) => setDocumentText(event.target.value)}
                    placeholder="Sem vlož text z faktury, potvrzení platby, payout e-mailu nebo PDF. Např. Lucid Trading, payout, 1 250 USD, 20.07.2026..."
                    rows={5}
                  />
                  <button
                    className="ghost-button full"
                    disabled={!documentText.trim()}
                    type="button"
                    onClick={handleSmartImport}
                  >
                    Rozpoznat a předvyplnit
                  </button>
                </div>

                {recognition ? (
                  <RecognitionPanel
                    recognition={recognition}
                    onUseCost={() => applyRecognition(recognition, "cost")}
                    onUsePayout={() => applyRecognition(recognition, "payout")}
                  />
                ) : null}

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
                    Program / účet
                    <input
                      value={payoutDraft.program}
                      onChange={(event) =>
                        setPayoutDraft({
                          ...payoutDraft,
                          program: event.target.value,
                        })
                      }
                      placeholder="Challenge 100k"
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

            <section className="panel account-panel">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Podle účtu</p>
                  <h2>Náklady vs payouty na konkrétní account</h2>
                </div>
                <span className="soft-pill">firma + program</span>
              </div>
              <div className="account-grid">
                {summary.byAccount.length === 0 ? (
                  <p className="muted">Až přidáš náklad nebo payout, uvidíš tady výsledek po účtech.</p>
                ) : (
                  summary.byAccount.map(([account, values]) => (
                    <article className="firm-card account-card" key={account}>
                      <span>{account}</span>
                      <strong>{formatCzk(values.payouts - values.costs)}</strong>
                      <small>
                        Účet stál {formatCzk(values.costs)} • Payout{" "}
                        {formatCzk(values.payouts)}
                      </small>
                    </article>
                  ))
                )}
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
                  detail: `${payout.program || "Účet neuveden"} • ${payout.split}% split`,
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
              title="Smart import dokladů"
              text="Vložíš text faktury nebo payout e-mailu a systém zkusí rozpoznat firmu, účet, částku, měnu i datum."
            />
            <Feature
              title="Výsledek podle účtu"
              text="Dashboard spojuje náklady a payouty podle prop firmy a programu, třeba Lucid Trading • Account 100K."
            />
            <Feature
              title="Připravené na spuštění"
              text="Multi-user účty, Neon/Postgres databáze, serverové cookies a katalog prop firem pro reálný provoz."
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

function RecognitionPanel({
  recognition,
  onUseCost,
  onUsePayout,
}: {
  recognition: RecognitionResult;
  onUseCost: () => void;
  onUsePayout: () => void;
}) {
  const kindLabel =
    recognition.kind === "payout"
      ? "Payout"
      : recognition.kind === "cost"
        ? "Náklad"
        : "Nejisté";

  return (
    <div className={`recognition-card recognition-${recognition.kind}`}>
      <div className="recognition-head">
        <div>
          <p className="eyebrow">Rozpoznáno z dokladu</p>
          <h3>{kindLabel}</h3>
        </div>
        <span className="confidence">{recognition.confidence}% jistota</span>
      </div>

      <div className="recognition-grid">
        <span>Firma</span>
        <strong>{recognition.propFirm || "nenalezeno"}</strong>
        <span>Částka</span>
        <strong>
          {recognition.amount
            ? formatMoney(Number(recognition.amount), recognition.currency)
            : "nenalezeno"}
        </strong>
        <span>Datum</span>
        <strong>{recognition.date || "nenalezeno"}</strong>
        <span>Program</span>
        <strong>{recognition.program || "nenalezeno"}</strong>
      </div>

      {recognition.signals.length ? (
        <div className="signal-row">
          {recognition.signals.map((signal) => (
            <span key={signal}>{signal}</span>
          ))}
        </div>
      ) : null}

      <div className="recognition-actions">
        <button className="ghost-button" type="button" onClick={onUseCost}>
          Použít jako náklad
        </button>
        <button className="ghost-button" type="button" onClick={onUsePayout}>
          Použít jako payout
        </button>
      </div>
    </div>
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
