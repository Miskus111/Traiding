"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type {
  AccountStatus,
  AdminUserSummary,
  AuthUser,
  Currency,
  DocumentAnalysis,
  Invoice,
  Payout,
  TradingAccount,
  TradingDocument,
} from "@/lib/types";

type UserData = {
  invoices: Invoice[];
  payouts: Payout[];
  accounts: TradingAccount[];
  documents: TradingDocument[];
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

type MonthlyReport = {
  month: string;
  costs: number;
  payouts: number;
  net: number;
  roi: number;
  bestAccount: { name: string; net: number; roi: number } | null;
  worstAccount: { name: string; net: number; roi: number } | null;
  bestPropFirm: string | null;
  recommendation: string;
  accounts: Array<{
    name: string;
    costs: number;
    payouts: number;
    net: number;
    roi: number;
  }>;
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
  accountId: "",
  amount: "",
  currency: "EUR" as Currency,
  date: new Date().toISOString().slice(0, 10),
  fileName: "",
  note: "",
});

const defaultPayout = () => ({
  propFirm: "",
  program: "",
  accountId: "",
  amount: "",
  currency: "EUR" as Currency,
  date: new Date().toISOString().slice(0, 10),
  split: "80",
  note: "",
});

const defaultAccount = () => ({
  propFirm: "",
  program: "",
  accountSize: "",
  accountType: "challenge",
  market: "Forex",
  strategy: "",
  status: "challenge" as AccountStatus,
  purchaseDate: new Date().toISOString().slice(0, 10),
  endedDate: "",
  note: "",
});

const accountStatuses: AccountStatus[] = [
  "challenge",
  "verification",
  "funded",
  "failed",
  "payout received",
  "refunded",
  "archived",
];

const statusLabels: Record<AccountStatus, string> = {
  challenge: "Challenge",
  verification: "Verification",
  funded: "Funded",
  failed: "Failed",
  "payout received": "Payout received",
  refunded: "Refunded",
  archived: "Archived",
};

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
  const [accountDraft, setAccountDraft] = useState(defaultAccount);
  const [accountFilters, setAccountFilters] = useState({
    firm: "",
    status: "",
    strategy: "",
    market: "",
  });
  const [documentText, setDocumentText] = useState("");
  const [recognition, setRecognition] = useState<RecognitionResult | null>(null);
  const [documentAnalysis, setDocumentAnalysis] = useState<DocumentAnalysis | null>(null);
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUserSummary[]>([]);
  const [data, setData] = useState<UserData>({
    invoices: [],
    payouts: [],
    accounts: [],
    documents: [],
  });
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

  useEffect(() => {
    if (user?.role === "admin") {
      void loadAdminUsers();
    }
  }, [user?.role]);

  async function loadData() {
    const [invoiceResult, payoutResult, accountResult, documentResult] = await Promise.all([
      api<{ invoices: Invoice[] }>("/api/invoices"),
      api<{ payouts: Payout[] }>("/api/payouts"),
      api<{ accounts: TradingAccount[] }>("/api/accounts"),
      api<{ documents: TradingDocument[] }>("/api/documents"),
    ]);
    setData({
      invoices: invoiceResult.invoices,
      payouts: payoutResult.payouts,
      accounts: accountResult.accounts,
      documents: documentResult.documents,
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
    setData({ invoices: [], payouts: [], accounts: [], documents: [] });
    setAdminUsers([]);
    setMonthlyReport(null);
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

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const result = await api<{ account: TradingAccount }>("/api/accounts", {
        method: "POST",
        body: JSON.stringify(accountDraft),
      });
      setData((current) => ({
        ...current,
        accounts: [result.account, ...current.accounts],
      }));
      setAccountDraft(defaultAccount());
      setMessage("Prop účet je uložený a připravený na párování nákladů a payoutů.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Účet se nepodařilo uložit.");
    } finally {
      setIsSaving(false);
    }
  }

  async function uploadDocument(file: File) {
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      if (invoiceDraft.accountId || payoutDraft.accountId) {
        formData.set("accountId", invoiceDraft.accountId || payoutDraft.accountId);
      }
      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Upload se nepovedl.");
      const document = payload.document as TradingDocument;
      setData((current) => ({
        ...current,
        documents: [document, ...current.documents],
      }));
      setInvoiceDraft((current) => ({ ...current, fileName: document.fileName }));
      setMessage("Dokument je uložený ve Vercel Blob. Teď můžeš spustit AI analýzu.");
      return document;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Dokument se nepodařilo nahrát.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function analyzeDocument(documentId: string) {
    setIsSaving(true);
    try {
      const result = await api<{
        document?: TradingDocument;
        analysis: DocumentAnalysis;
        warning?: string;
      }>(`/api/documents/${documentId}/analyze`, { method: "POST" });
      setDocumentAnalysis(result.analysis);
      if (result.document) {
        setData((current) => ({
          ...current,
          documents: current.documents.map((document) =>
            document.id === result.document?.id ? result.document : document,
          ),
        }));
      }
      setMessage(
        result.warning ??
          "AI analýza je hotová. Nic jsem nevyplnil automaticky — údaje zkontroluj a zadej ručně.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI analýza se nepodařila.");
    } finally {
      setIsSaving(false);
    }
  }

  async function removeDocument(documentId: string) {
    setIsSaving(true);
    try {
      await api<{ ok: true }>(`/api/documents/${documentId}`, { method: "DELETE" });
      setData((current) => ({
        ...current,
        documents: current.documents.filter((document) => document.id !== documentId),
      }));
      setMessage("Dokument je smazaný z Blobu i databáze.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Dokument se nepodařilo smazat.");
    } finally {
      setIsSaving(false);
    }
  }

  async function loadMonthlyReport() {
    const month = new Date().toISOString().slice(0, 7);
    try {
      const result = await api<{ report: MonthlyReport }>(
        `/api/reports/monthly?month=${month}`,
      );
      setMonthlyReport(result.report);
      setMessage(`Měsíční report pro ${month} je načtený.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Report se nepodařilo načíst.");
    }
  }

  async function loadAdminUsers() {
    if (user?.role !== "admin") return;
    try {
      const result = await api<{ users: AdminUserSummary[] }>("/api/admin/users");
      setAdminUsers(result.users);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Admin panel se nepodařilo načíst.");
    }
  }

  async function updateAdminUser(summary: AdminUserSummary, patch: Partial<AdminUserSummary>) {
    const result = await api<{ user: AdminUserSummary }>("/api/admin/users", {
      method: "PATCH",
      body: JSON.stringify({
        id: summary.id,
        role: patch.role ?? summary.role,
        blocked: patch.blocked ?? summary.blocked,
      }),
    });
    setAdminUsers((current) =>
      current.map((item) => (item.id === result.user.id ? result.user : item)),
    );
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

  function recognizeText(text: string, sourceName?: string) {
    const parsed = parseTradingDocument(text, sourceName);
    setRecognition(parsed);
    setMessage(
      parsed.signals.length
        ? `Rozpoznáno ${parsed.confidence}%: ${parsed.signals.join(" • ")}. Formulář zůstává ruční.`
        : "Z dokladu se nepodařilo najít jasná data. Zkus vložit delší text z faktury nebo payout e-mailu.",
    );
  }

  function handleSmartImport() {
    recognizeText(documentText);
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    void uploadDocument(file);
    setInvoiceDraft((current) => ({ ...current, fileName: file.name }));
    setMessage("Soubor jsem jen nahrál. Náklad nebo payout vyplň ručně a připoj ho k účtu.");
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
  const filteredAccounts = data.accounts.filter((account) => {
    return (
      (!accountFilters.firm ||
        account.propFirm.toLowerCase().includes(accountFilters.firm.toLowerCase())) &&
      (!accountFilters.status || account.status === accountFilters.status) &&
      (!accountFilters.strategy ||
        account.strategy.toLowerCase().includes(accountFilters.strategy.toLowerCase())) &&
      (!accountFilters.market ||
        account.market.toLowerCase().includes(accountFilters.market.toLowerCase()))
    );
  });
  const rankedAccounts = [...data.accounts].sort((a, b) => b.net - a.net);
  const topAccounts = rankedAccounts.slice(0, 3);
  const worstAccounts = [...data.accounts].sort((a, b) => a.net - b.net).slice(0, 3);
  const challengeAccounts = data.accounts.filter((account) => account.status === "challenge");
  const activeAccounts = data.accounts.filter((account) =>
    ["challenge", "verification", "funded"].includes(account.status),
  );
  const nextAction =
    data.accounts.length === 0
      ? {
          title: "Založ první challenge účet",
          text: "Začni účtem. Teprve potom k němu ručně přidávej náklady a payouty.",
          href: "#accounts",
          cta: "Přidat účet",
        }
      : data.invoices.length === 0
        ? {
            title: "Přidej první náklad",
            text: "Vyber založený účet a zapiš challenge fee nebo reset podle faktury.",
            href: "#invoice",
            cta: "Přidat náklad",
          }
        : data.payouts.length === 0
          ? {
              title: "Čekáš na první payout",
              text: "Až přijde výplata, napoj ji na stejný účet. ROI se spočítá samo.",
              href: "#payout",
              cta: "Přidat payout",
            }
          : {
              title: "Sleduj, co se vyplatí",
              text: "Účty už mají náklady i payouty. Teď porovnávej ROI a slabé účty.",
              href: "#history",
              cta: "Zobrazit historii",
            };

  return (
    <main className="app-shell">
      <div className="aurora aurora-a" />
      <div className="aurora aurora-b" />
      <div className="noise" />

      <section className="page-wrap">
        <nav className="topbar">
          <div className="brand">
            <span className="brand-mark">TC</span>
            <div>
              <p>Trader Cost Hub</p>
              <small>Modern prop trading command center</small>
            </div>
          </div>
          <div className="topbar-actions">
            {user ? (
              <div className="nav-links" aria-label="Rychlá navigace">
                <a href="#overview">Přehled</a>
                <a href="#accounts">Účty</a>
                <a href="#import">Náklady / payouty</a>
                <a href="#history">Historie</a>
              </div>
            ) : null}
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
            <div className="hero-copy">
              <p className="eyebrow">Launch-ready finance OS • Neon • Vercel</p>
              <h1>Profesionální dashboard pro funded účty.</h1>
              <p>
                Sleduj challenge fees, resety, faktury, payouty a čistý výsledek
                podle prop firmy i konkrétního účtu. Jeden moderní systém místo
                chaosu v tabulkách, e-mailech a poznámkách.
              </p>
              <div className="hero-stats">
                <span>Smart import</span>
                <span>Account P/L</span>
                <span>Multi-user</span>
                <span>Vercel ready</span>
              </div>
            </div>

            <div className="hero-preview" aria-hidden="true">
              <div className="preview-topline">
                <span>Live overview</span>
                <strong>+24.8%</strong>
              </div>
              <div className="preview-metric">
                <span>Net result</span>
                <strong>42 850 Kč</strong>
              </div>
              <div className="preview-bars">
                <span style={{ height: "42%" }} />
                <span style={{ height: "68%" }} />
                <span style={{ height: "54%" }} />
                <span style={{ height: "84%" }} />
                <span style={{ height: "72%" }} />
              </div>
              <div className="preview-list">
                <span>Lucid Trading • Account 100K</span>
                <b>+18 400 Kč</b>
                <span>FTMO • Challenge 50K</span>
                <b>-3 250 Kč</b>
              </div>
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
            <section id="overview" className="dashboard-header">
              <div>
                <p className="eyebrow">Command center</p>
                <h2>Finanční cockpit pro prop trading</h2>
                <p>
                  Nejdřív vidíš výsledek, potom detaily. Náklady, payouty a
                  účty jsou oddělené tak, aby bylo hned jasné, co funguje.
                </p>
              </div>
              <div className="header-actions">
                <a className="ghost-button" href="#import">
                  Přidat záznam
                </a>
                <a className="primary-button" href="#accounts">
                  Zobrazit účty
                </a>
              </div>
            </section>

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

            <section className="focus-board" aria-label="Co udělat dál">
              <article className="focus-card focus-card-main">
                <p className="eyebrow">Další krok</p>
                <h3>{nextAction.title}</h3>
                <p>{nextAction.text}</p>
                <a className="primary-button" href={nextAction.href}>
                  {nextAction.cta}
                </a>
              </article>
              <article className="focus-card">
                <span>Aktivní účty</span>
                <strong>{activeAccounts.length}</strong>
                <small>{challengeAccounts.length} ve statusu Challenge</small>
              </article>
              <article className="focus-card">
                <span>Doklady</span>
                <strong>{data.documents.length}</strong>
                <small>uložené faktury / payout potvrzení</small>
              </article>
              <article className="focus-card quick-links-card">
                <span>Rychlé akce</span>
                <a href="#accounts">+ účet</a>
                <a href="#invoice">+ náklad</a>
                <a href="#payout">+ payout</a>
              </article>
            </section>

            <section className="insight-strip" aria-label="Rychlé shrnutí">
              <article>
                <span>Aktivní záznamy</span>
                <strong>{data.invoices.length + data.payouts.length}</strong>
                <small>náklady + payouty uložené v databázi</small>
              </article>
              <article>
                <span>Prop firmy</span>
                <strong>{summary.byFirm.length}</strong>
                <small>zdroje s uloženým nákladem nebo payoutem</small>
              </article>
              <article>
                <span>Sledované účty</span>
                <strong>{summary.byAccount.length}</strong>
                <small>párování podle firma + program</small>
              </article>
            </section>

            <section className="process-grid" aria-label="Doporučený postup práce">
              <article>
                <span>01</span>
                <strong>Založ challenge účet</strong>
                <small>Vyber prop firmu, velikost účtu, trh, strategii a nech status Challenge.</small>
              </article>
              <article>
                <span>02</span>
                <strong>Přidej náklad ručně</strong>
                <small>Vyber účet a zapiš challenge fee, reset nebo refund podle skutečné částky.</small>
              </article>
              <article>
                <span>03</span>
                <strong>Přidej payout ručně</strong>
                <small>Až přijde výplata, napoj ji na stejný účet a dashboard spočítá ROI.</small>
              </article>
            </section>

            <section id="accounts" className="workspace-grid account-workspace">
              <form className="panel form-panel" onSubmit={saveAccount}>
                <div className="section-title">
                  <div>
                    <p className="eyebrow">Prop accounts</p>
                    <h2>Přidat challenge účet</h2>
                  </div>
                  <span className="soft-pill">výchozí status: Challenge</span>
                </div>
                <div className="manual-flow-card">
                  <strong>1. Založ účet → 2. Přidej náklad → 3. Přidej payout</strong>
                  <small>
                    Faktura už nic sama nevyplňuje. Údaje zadáváš ručně a jen je napojíš na správný účet.
                  </small>
                </div>
                <div className="form-grid">
                  <label>
                    Prop firma
                    <input
                      list="prop-firms"
                      value={accountDraft.propFirm}
                      onChange={(event) =>
                        setAccountDraft({ ...accountDraft, propFirm: event.target.value })
                      }
                      placeholder="Lucid Trading"
                    />
                  </label>
                  <label>
                    Program / účet
                    <input
                      value={accountDraft.program}
                      onChange={(event) =>
                        setAccountDraft({ ...accountDraft, program: event.target.value })
                      }
                      placeholder="Account 100K"
                    />
                  </label>
                  <label>
                    Velikost účtu
                    <input
                      value={accountDraft.accountSize}
                      onChange={(event) =>
                        setAccountDraft({ ...accountDraft, accountSize: event.target.value })
                      }
                      placeholder="100K"
                    />
                  </label>
                  <label>
                    Typ účtu
                    <select
                      value={accountDraft.accountType}
                      onChange={(event) =>
                        setAccountDraft({ ...accountDraft, accountType: event.target.value })
                      }
                    >
                      <option value="challenge">Challenge</option>
                      <option value="verification">Verification</option>
                      <option value="funded">Funded</option>
                      <option value="instant funding">Instant funding</option>
                      <option value="futures evaluation">Futures evaluation</option>
                    </select>
                  </label>
                  <label>
                    Trh
                    <input
                      value={accountDraft.market}
                      onChange={(event) =>
                        setAccountDraft({ ...accountDraft, market: event.target.value })
                      }
                      placeholder="Forex, Futures..."
                    />
                  </label>
                  <label>
                    Strategie
                    <input
                      value={accountDraft.strategy}
                      onChange={(event) =>
                        setAccountDraft({ ...accountDraft, strategy: event.target.value })
                      }
                      placeholder="London open, scalping..."
                    />
                  </label>
                  <label>
                    Status
                    <select
                      value={accountDraft.status}
                      onChange={(event) =>
                        setAccountDraft({
                          ...accountDraft,
                          status: event.target.value as AccountStatus,
                        })
                      }
                    >
                      {accountStatuses.map((status) => (
                        <option key={status} value={status}>
                          {statusLabels[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Datum nákupu
                    <input
                      type="date"
                      value={accountDraft.purchaseDate}
                      onChange={(event) =>
                        setAccountDraft({ ...accountDraft, purchaseDate: event.target.value })
                      }
                    />
                  </label>
                </div>
                <div className="status-shortcuts" aria-label="Rychlé nastavení statusu účtu">
                  {(["challenge", "verification", "funded", "failed"] as AccountStatus[]).map(
                    (status) => (
                      <button
                        className={accountDraft.status === status ? "primary-button mini" : "ghost-button mini"}
                        key={status}
                        type="button"
                        onClick={() =>
                          setAccountDraft({
                            ...accountDraft,
                            status,
                            accountType: status === "challenge" ? "challenge" : accountDraft.accountType,
                          })
                        }
                      >
                        {statusLabels[status]}
                      </button>
                    ),
                  )}
                </div>
                <button className="primary-button" disabled={isSaving} type="submit">
                  Uložit challenge účet
                </button>
              </form>

              <section className="panel">
                <div className="section-title">
                  <div>
                    <p className="eyebrow">Account portfolio</p>
                    <h2>Filtry a statusy</h2>
                  </div>
                  <span className="soft-pill">{filteredAccounts.length} účtů</span>
                </div>
                <div className="portfolio-summary">
                  <article>
                    <span>Challenge</span>
                    <strong>{challengeAccounts.length}</strong>
                  </article>
                  <article>
                    <span>Aktivní</span>
                    <strong>{activeAccounts.length}</strong>
                  </article>
                  <article>
                    <span>Nejlepší účet</span>
                    <strong>{topAccounts[0] ? formatCzk(topAccounts[0].net) : "—"}</strong>
                  </article>
                </div>
                <div className="filter-grid">
                  <input
                    value={accountFilters.firm}
                    onChange={(event) =>
                      setAccountFilters({ ...accountFilters, firm: event.target.value })
                    }
                    placeholder="Filtrovat firmu"
                  />
                  <select
                    value={accountFilters.status}
                    onChange={(event) =>
                      setAccountFilters({ ...accountFilters, status: event.target.value })
                    }
                  >
                    <option value="">Všechny statusy</option>
                    {accountStatuses.map((status) => (
                      <option key={status} value={status}>
                        {statusLabels[status]}
                      </option>
                    ))}
                  </select>
                  <input
                    value={accountFilters.market}
                    onChange={(event) =>
                      setAccountFilters({ ...accountFilters, market: event.target.value })
                    }
                    placeholder="Trh"
                  />
                  <input
                    value={accountFilters.strategy}
                    onChange={(event) =>
                      setAccountFilters({ ...accountFilters, strategy: event.target.value })
                    }
                    placeholder="Strategie"
                  />
                </div>
                <div className="account-grid">
                  {filteredAccounts.length === 0 ? (
                    <p className="muted">Založ první účet nebo uprav filtr.</p>
                  ) : (
                    filteredAccounts.map((account) => (
                      <article className="firm-card account-card" key={account.id}>
                        <div className="account-card-head">
                          <span className={`status-badge status-${account.status.replace(/\s+/g, "-")}`}>
                            {statusLabels[account.status]}
                          </span>
                          <small>{account.market || "trh neuveden"}</small>
                        </div>
                        <strong>{account.propFirm}</strong>
                        <small>{account.program || "Účet neuveden"}</small>
                        <div className="account-metrics">
                          <span>
                            Náklady
                            <strong>{formatCzk(account.costs)}</strong>
                          </span>
                          <span>
                            Payouty
                            <strong>{formatCzk(account.payouts)}</strong>
                          </span>
                          <span>
                            ROI
                            <strong>{account.roi.toFixed(1)} %</strong>
                          </span>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </section>

            <section id="import" className="workspace-grid">
              <form id="invoice" className="panel form-panel" onSubmit={addInvoice}>
                <div className="section-title">
                  <div>
                    <p className="eyebrow">Faktury a challenge fees</p>
                    <h2>Přidat náklad</h2>
                  </div>
                  <span className="soft-pill">DB save</span>
                </div>
                <div className="manual-flow-card compact">
                  <strong>Náklad zadávej ručně podle faktury.</strong>
                  <small>Vyber účet, částku, měnu a datum. Nahraná faktura slouží jen jako uložený doklad.</small>
                </div>

                <label className="file-drop">
                  <input
                    type="file"
                    accept=".pdf,.txt,.csv,image/*"
                    onChange={handleFile}
                  />
                  <strong>Nahrát fakturu</strong>
                  <small>
                    Soubor se jen uloží do Vercel Blob. Formulář se nevyplní automaticky.
                  </small>
                </label>

                <details className="smart-import">
                  <summary>
                    <div>
                      <p className="eyebrow">Volitelný náhled</p>
                      <h3>Zkusit přečíst text bez vyplnění formuláře</h3>
                    </div>
                    <span className="soft-pill">manual only</span>
                  </summary>
                  <textarea
                    value={documentText}
                    onChange={(event) => setDocumentText(event.target.value)}
                    placeholder="Sem můžeš vložit text z faktury nebo e-mailu jen pro kontrolní náhled. Nic se samo neuloží ani nepředvyplní."
                    rows={5}
                  />
                  <button
                    className="ghost-button full"
                    disabled={!documentText.trim()}
                    type="button"
                    onClick={handleSmartImport}
                  >
                    Jen zobrazit náhled
                  </button>
                </details>

                {recognition ? (
                  <RecognitionPanel recognition={recognition} />
                ) : null}

                <div className="document-stack">
                  <div className="section-title compact">
                    <div>
                      <p className="eyebrow">Blob dokumenty</p>
                      <h3>Nahrané faktury a payout potvrzení</h3>
                    </div>
                    <span className="soft-pill">{data.documents.length} souborů</span>
                  </div>
                  {data.documents.length === 0 ? (
                    <p className="muted">Nahraj PDF nebo screenshot. AI náhled je volitelný a nic nevyplní automaticky.</p>
                  ) : (
                    data.documents.slice(0, 4).map((document) => (
                      <article className="document-card" key={document.id}>
                        <div>
                          <strong>{document.fileName}</strong>
                          <small>
                            {document.aiStatus} • {(document.fileSize / 1024).toFixed(0)} KB
                          </small>
                        </div>
                        <div className="document-actions">
                          <a className="ghost-button" href={document.fileUrl} target="_blank" rel="noreferrer">
                            Otevřít
                          </a>
                          <button
                            className="primary-button"
                            disabled={isSaving}
                            type="button"
                            onClick={() => analyzeDocument(document.id)}
                          >
                            AI náhled
                          </button>
                          <button
                            className="ghost-button danger"
                            disabled={isSaving}
                            type="button"
                            onClick={() => removeDocument(document.id)}
                          >
                            Smazat
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>

                {documentAnalysis ? (
                  <div className="ai-result">
                    <div className="recognition-head">
                      <div>
                        <p className="eyebrow">AI výsledek</p>
                        <h3>{documentAnalysis.recordType}</h3>
                      </div>
                      <span className="confidence">{documentAnalysis.confidence}% jistota</span>
                    </div>
                    <div className="recognition-grid">
                      <span>Firma</span>
                      <strong>{documentAnalysis.propFirm || "nenalezeno"}</strong>
                      <span>Účet</span>
                      <strong>{documentAnalysis.program || "nenalezeno"}</strong>
                      <span>Částka</span>
                      <strong>{formatMoney(documentAnalysis.amount, documentAnalysis.currency)}</strong>
                      <span>Status</span>
                      <strong>{documentAnalysis.suggestedStatus || "bez návrhu"}</strong>
                    </div>
                    <p className="muted">
                      AI výsledek je jen orientační kontrola. Formulář níže vyplň ručně a vyber správný účet.
                    </p>
                  </div>
                ) : null}

                <div className="form-grid">
                  <label>
                    Připojit k účtu
                    <select
                      value={invoiceDraft.accountId}
                      onChange={(event) => {
                        const account = data.accounts.find((item) => item.id === event.target.value);
                        setInvoiceDraft({
                          ...invoiceDraft,
                          accountId: event.target.value,
                          propFirm: account?.propFirm ?? invoiceDraft.propFirm,
                          program: account?.program ?? invoiceDraft.program,
                        });
                      }}
                    >
                      <option value="">Bez napojení</option>
                      {data.accounts.map((account) => (
                        <option value={account.id} key={account.id}>
                          {account.propFirm} • {account.program || "Účet neuveden"}
                        </option>
                      ))}
                    </select>
                  </label>
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
                <div className="manual-flow-card compact">
                  <strong>Payout napoj na účet, který ho vydělal.</strong>
                  <small>Vyber stejný účet jako u challenge fee a zapiš čistou vyplacenou částku.</small>
                </div>

                <div className="form-grid">
                  <label>
                    Připojit k účtu
                    <select
                      value={payoutDraft.accountId}
                      onChange={(event) => {
                        const account = data.accounts.find((item) => item.id === event.target.value);
                        setPayoutDraft({
                          ...payoutDraft,
                          accountId: event.target.value,
                          propFirm: account?.propFirm ?? payoutDraft.propFirm,
                          program: account?.program ?? payoutDraft.program,
                        });
                      }}
                    >
                      <option value="">Bez napojení</option>
                      {data.accounts.map((account) => (
                        <option value={account.id} key={account.id}>
                          {account.propFirm} • {account.program || "Účet neuveden"}
                        </option>
                      ))}
                    </select>
                  </label>
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

            <section className="analytics-grid">
              <div className="panel">
                <div className="section-title">
                  <div>
                    <p className="eyebrow">Co se vyplatí</p>
                    <h2>ROI ranking účtů</h2>
                  </div>
                  <span className="soft-pill">best / worst</span>
                </div>
                <div className="ranking-grid">
                  <div>
                    <h3>Nejlepší účty</h3>
                    {topAccounts.length === 0 ? (
                      <p className="muted">Zatím nejsou účty s výsledkem.</p>
                    ) : (
                      topAccounts.map((account) => (
                        <article className="rank-row" key={account.id}>
                          <span>{account.propFirm} • {account.program || "Účet"}</span>
                          <strong>{formatCzk(account.net)}</strong>
                          <small>ROI {account.roi.toFixed(1)} %</small>
                        </article>
                      ))
                    )}
                  </div>
                  <div>
                    <h3>Největší ztráty</h3>
                    {worstAccounts.length === 0 ? (
                      <p className="muted">Zatím nejsou účty s výsledkem.</p>
                    ) : (
                      worstAccounts.map((account) => (
                        <article className="rank-row warning" key={account.id}>
                          <span>{account.propFirm} • {account.program || "Účet"}</span>
                          <strong>{formatCzk(account.net)}</strong>
                          <small>ROI {account.roi.toFixed(1)} %</small>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="section-title">
                  <div>
                    <p className="eyebrow">Měsíční report</p>
                    <h2>Automatické vyhodnocení</h2>
                  </div>
                  <button className="ghost-button" type="button" onClick={loadMonthlyReport}>
                    Načíst report
                  </button>
                </div>
                {monthlyReport ? (
                  <div className="report-card">
                    <div className="preview-metric">
                      <span>{monthlyReport.month}</span>
                      <strong>{formatCzk(monthlyReport.net)}</strong>
                    </div>
                    <div className="recognition-grid">
                      <span>Náklady</span>
                      <strong>{formatCzk(monthlyReport.costs)}</strong>
                      <span>Payouty</span>
                      <strong>{formatCzk(monthlyReport.payouts)}</strong>
                      <span>ROI</span>
                      <strong>{monthlyReport.roi.toFixed(1)} %</strong>
                      <span>Top firma</span>
                      <strong>{monthlyReport.bestPropFirm ?? "není"}</strong>
                    </div>
                    <p className="muted">{monthlyReport.recommendation}</p>
                    <div className="recognition-actions">
                      <button className="ghost-button" type="button" onClick={() => window.print()}>
                        Print / PDF
                      </button>
                      <button className="ghost-button" type="button" onClick={exportJson}>
                        Export JSON
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="muted">Načti report aktuálního měsíce a dostaneš stručné doporučení.</p>
                )}
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

            <section id="history" className="records-grid">
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

            {user.role === "admin" ? (
              <section className="panel admin-panel">
                <div className="section-title">
                  <div>
                    <p className="eyebrow">Admin panel</p>
                    <h2>Uživatelé a využití systému</h2>
                  </div>
                  <button className="ghost-button" type="button" onClick={loadAdminUsers}>
                    Obnovit
                  </button>
                </div>
                <div className="admin-grid">
                  {adminUsers.length === 0 ? (
                    <p className="muted">Načítám uživatele nebo zatím nejsou data.</p>
                  ) : (
                    adminUsers.map((summary) => (
                      <article className="admin-card" key={summary.id}>
                        <div>
                          <strong>{summary.name}</strong>
                          <span>{summary.email}</span>
                          <small>
                            {summary.accounts} účtů • {summary.invoices} nákladů •{" "}
                            {summary.payouts} payoutů • {summary.documents} dokumentů
                          </small>
                        </div>
                        <div className="admin-actions">
                          <select
                            value={summary.role}
                            onChange={(event) =>
                              void updateAdminUser(summary, {
                                role: event.target.value as AdminUserSummary["role"],
                              })
                            }
                          >
                            <option value="user">user</option>
                            <option value="admin">admin</option>
                          </select>
                          <button
                            className={summary.blocked ? "primary-button" : "ghost-button"}
                            type="button"
                            onClick={() =>
                              void updateAdminUser(summary, {
                                blocked: !summary.blocked,
                              })
                            }
                          >
                            {summary.blocked ? "Odblokovat" : "Zablokovat"}
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            ) : null}
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

function RecognitionPanel({ recognition }: { recognition: RecognitionResult }) {
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

      <p className="muted">
        Tohle je jen náhled. Pokud data sedí, přepiš je ručně do nákladu nebo payoutu.
      </p>
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
