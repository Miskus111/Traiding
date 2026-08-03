"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { affiliateDeals } from "@/lib/affiliate-deals";
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
type DisplayCurrency = Currency;
type AccountHealth = "Healthy" | "Watch" | "At risk";

type DashboardInsight = {
  title: string;
  value: string;
  text: string;
  tone: "good" | "watch" | "risk";
};

type DemoAccount = {
  name: string;
  status: AccountStatus;
  costs: number;
  payouts: number;
  net: number;
  roi: number;
  note: string;
};

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

const creatorRules = [
  "Most traders track payouts. I track costs first.",
  "Before buying another challenge, check your real ROI.",
  "Your prop trading is a business - measure it like one.",
];

const demoAccounts: DemoAccount[] = [
  {
    name: "Lucid Trading - 100K Challenge",
    status: "challenge",
    costs: 9700,
    payouts: 28875,
    net: 19175,
    roi: 197.6,
    note: "Best demo result",
  },
  {
    name: "FTMO - 50K Challenge",
    status: "failed",
    costs: 3250,
    payouts: 0,
    net: -3250,
    roi: -100,
    note: "Costs need review",
  },
  {
    name: "Topstep - Futures Evaluation",
    status: "funded",
    costs: 4550,
    payouts: 11200,
    net: 6650,
    roi: 146.2,
    note: "Funded demo account",
  },
];

const demoMetrics = {
  costs: demoAccounts.reduce((sum, account) => sum + account.costs, 0),
  payouts: demoAccounts.reduce((sum, account) => sum + account.payouts, 0),
  net: demoAccounts.reduce((sum, account) => sum + account.net, 0),
  roi:
    demoAccounts.reduce((sum, account) => sum + account.costs, 0) > 0
      ? (demoAccounts.reduce((sum, account) => sum + account.net, 0) /
          demoAccounts.reduce((sum, account) => sum + account.costs, 0)) *
        100
      : 0,
  account: demoAccounts[0].name,
};

function formatCzk(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMoney(value: number, currency: Currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "CZK" ? 0 : 2,
  }).format(value);
}

function toCzk(value: number, currency: Currency) {
  return value * exchangeToCzk[currency];
}

function fromCzk(value: number, currency: DisplayCurrency) {
  return value / exchangeToCzk[currency];
}

function formatDisplayMoney(valueInCzk: number, currency: DisplayCurrency) {
  return formatMoney(fromCzk(valueInCzk, currency), currency);
}

function getAccountHealth(account: TradingAccount): AccountHealth {
  if (account.status === "failed" || account.status === "archived") return "At risk";
  if (account.net < 0 || account.roi < 0) return "At risk";
  if (account.costs > 0 && account.payouts === 0) return "Watch";
  if (account.status === "funded" || account.status === "payout received" || account.net > 0) {
    return "Healthy";
  }
  return "Watch";
}

function healthClass(health: AccountHealth) {
  return health.toLowerCase().replace(/\s+/g, "-");
}

function monthLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
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
    /(?:total|amount|price|paid)[^\d]{0,24}(\d{1,6}(?:[,.]\d{1,2})?)/i,
  );
  const dateMatch = clean.match(
    /(\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/,
  );
  const currency =
    clean.includes("CZK")
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
  if (/czk|kc/i.test(sample)) return "CZK";
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
    /(?:program|account|challenge|evaluation|funded account|ucet)[^\w$€]{0,18}([$€]?\s?\d{1,3}(?:[.,\s]?\d{3})?\s?k?)/i,
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
    "total|amount due|amount paid|paid|price|fee|challenge fee|reset fee|activation fee|invoice total";
  const preferred = kind === "payout" ? payoutKeywords : costKeywords;
  const secondary = kind === "payout" ? costKeywords : payoutKeywords;
  const money =
    "([$€]?\\s?\\d{1,3}(?:[\\s.,]?\\d{3})*(?:[,.]\\d{1,2})?|[$€]?\\s?\\d{2,6}(?:[,.]\\d{1,2})?)\\s?(CZK|KC|EUR|USD|€|\\$)?";
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
    "vyplata",
    "vyplaceno",
    "vyber",
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
    propFirm ? `Prop firm: ${propFirm}` : "",
    detectedAmount ? `Amount: ${formatMoney(Number(detectedAmount), detectedCurrency)}` : "",
    date ? `Date: ${date}` : "",
    program ? `Program: ${program}` : "",
    kind === "payout" ? "Type: payout" : "",
    kind === "cost" ? "Type: cost / invoice" : "",
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
    throw new Error(payload.error ?? "Something went wrong. Please try again.");
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
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>(() => {
    if (typeof window === "undefined") return "CZK";
    const saved = window.localStorage.getItem("trader-cost-hub-display-currency");
    return saved === "CZK" || saved === "EUR" || saved === "USD" ? saved : "CZK";
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
    "Sign in or create an account. Every trader gets a private workspace.",
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
          setMessage("Your dashboard is loaded from the database.");
        } else if (!result.databaseReady) {
          setMessage(
            "The database is not connected yet. Add Neon/Postgres and SESSION_SECRET in Vercel.",
          );
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "The app could not be loaded.");
      } finally {
        setIsLoading(false);
      }
    }
    boot();
  }, []);

  useEffect(() => {
    window.localStorage.setItem("trader-cost-hub-display-currency", displayCurrency);
  }, [displayCurrency]);

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
      const firm = invoice.propFirm || "Unassigned";
      const account = `${firm} - ${invoice.program || "Account missing"}`;
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
      const firm = payout.propFirm || "Unassigned";
      const account = `${firm} - ${payout.program || "Account missing"}`;
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
          ? "Account created. Welcome to your dashboard."
          : "Signed in successfully.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed.");
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
    setMessage("Signed out. You can sign in with another account.");
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
      setMessage("Cost saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cost could not be saved.");
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
      setMessage("Payout saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payout could not be saved.");
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
      setMessage("Prop account saved and ready for costs and payouts.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Account could not be saved.");
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
      if (!response.ok) throw new Error(payload.error ?? "Upload failed.");
      const document = payload.document as TradingDocument;
      setData((current) => ({
        ...current,
        documents: [document, ...current.documents],
      }));
      setInvoiceDraft((current) => ({ ...current, fileName: document.fileName }));
      setMessage("Document saved in Vercel Blob. AI preview is optional.");
      return document;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Document could not be uploaded.");
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
          "AI preview is ready. Nothing was filled automatically - review it and enter data manually.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI preview failed.");
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
      setMessage("Document deleted from Blob and database.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Document could not be deleted.");
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
      setMessage(`Monthly report for ${month} is loaded.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Report could not be loaded.");
    }
  }

  async function loadAdminUsers() {
    if (user?.role !== "admin") return;
    try {
      const result = await api<{ users: AdminUserSummary[] }>("/api/admin/users");
      setAdminUsers(result.users);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Admin panel could not be loaded.");
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
        ? `Preview confidence ${parsed.confidence}%: ${parsed.signals.join(" • ")}. Forms stay manual.`
        : "No clear data found. Paste more invoice or payout email text for a better preview.",
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
    setMessage("File uploaded only. Enter the cost or payout manually and attach it to an account.");
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
  const display = (valueInCzk: number) => formatDisplayMoney(valueInCzk, displayCurrency);
  const breakEvenNeeded = Math.max(summary.costs - summary.payouts, 0);
  const accountsWithoutPayout = data.accounts.filter(
    (account) => account.costs > 0 && account.payouts === 0,
  );
  const failedAccounts = data.accounts.filter((account) => account.status === "failed");
  const negativeAccounts = data.accounts.filter((account) => account.net < 0);
  const attentionInsights: DashboardInsight[] =
    failedAccounts.length === 0 &&
    accountsWithoutPayout.length === 0 &&
    negativeAccounts.length === 0
      ? [
          {
            title: "All clear",
            value: "0",
            text: "No failed, unpaid or negative accounts need attention right now.",
            tone: "good",
          },
        ]
      : [
          {
            title: "Failed accounts",
            value: String(failedAccounts.length),
            text: "Archive or review the rules before buying another challenge.",
            tone: failedAccounts.length ? "risk" : "good",
          },
          {
            title: "Costs without payout",
            value: String(accountsWithoutPayout.length),
            text: "These accounts have fees recorded but no confirmed payout yet.",
            tone: accountsWithoutPayout.length ? "watch" : "good",
          },
          {
            title: "Negative ROI",
            value: String(negativeAccounts.length),
            text: "Watch accounts where tracked costs are larger than payouts.",
            tone: negativeAccounts.length ? "risk" : "good",
          },
        ];
  const nextAction =
    data.accounts.length === 0
      ? {
          title: "Create your first challenge account",
          text: "Start with the account. Then attach every cost and payout to it manually.",
          href: "#accounts",
          cta: "Add account",
        }
      : data.invoices.length === 0
        ? {
            title: "Add your first cost",
            text: "Choose an account and record the challenge fee, reset or refund from the real amount.",
            href: "#invoice",
            cta: "Add cost",
          }
        : data.payouts.length === 0
          ? {
              title: "Waiting for the first payout",
              text: "When it arrives, attach it to the same account. ROI updates automatically.",
              href: "#payout",
              cta: "Add payout",
            }
          : {
              title: "Compare what actually pays off",
              text: "Your accounts now have costs and payouts. Compare ROI and spot weak accounts.",
              href: "#history",
              cta: "View history",
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
              <div className="nav-links" aria-label="Dashboard navigation">
                <a href="#overview">Overview</a>
                <a href="#accounts">Accounts</a>
                <a href="#import">Costs & Payouts</a>
                <a href="#deals">Deals</a>
                <a href="#history">History</a>
              </div>
            ) : (
              <div className="nav-links" aria-label="Site navigation">
                <a href="#product">Product</a>
                <a href="#demo">Demo</a>
                <a href="#how-it-works">How it works</a>
                <a href="#deals">Deals</a>
                <a href="#auth">Sign in</a>
              </div>
            )}
            <span className={databaseReady ? "live-pill" : "live-pill warning"}>
              {databaseReady ? "DB online" : "DB missing"}
            </span>
            {user ? (
              <>
                <span className="user-pill">{user.name}</span>
                <button className="ghost-button" onClick={logout}>
                  Sign out
                </button>
              </>
            ) : null}
          </div>
        </nav>

        <header id="product" className="hero-grid">
          <section className="hero-panel">
            <div className="hero-copy">
              <p className="eyebrow">Prop trading is a business. Track it like one.</p>
              <h1>Stop guessing if prop trading is profitable.</h1>
              <p>
                Before buying another challenge, know what you already spent,
                what actually paid out and how much break-even is still needed.
              </p>
              <div className="hero-ctas">
                <a className="primary-button" href={user ? "#accounts" : "#auth"}>
                  Start tracking
                </a>
                <a className="ghost-button" href="#deals">
                  View prop firm deals
                </a>
              </div>
              <div className="hero-stats">
                <span>Manual-first tracking</span>
                <span>Account P/L</span>
                <span>Multi-user</span>
                <span>Affiliate disclosure</span>
              </div>
            </div>

            <div className="hero-preview" aria-hidden="true">
              <div className="preview-topline">
                <span>Live overview</span>
                <strong>+24.8%</strong>
              </div>
              <div className="preview-metric">
                <span>Net result</span>
                <strong>{formatCzk(42850)}</strong>
              </div>
              <div className="preview-bars">
                <span style={{ height: "42%" }} />
                <span style={{ height: "68%" }} />
                <span style={{ height: "54%" }} />
                <span style={{ height: "84%" }} />
                <span style={{ height: "72%" }} />
              </div>
              <div className="preview-list">
                <span>Lucid Trading - Account 100K</span>
                <b>{formatCzk(18400)}</b>
                <span>FTMO - Challenge 50K</span>
                <b>{formatCzk(-3250)}</b>
              </div>
            </div>
          </section>

          <section id="auth" className="auth-card">
            {!user ? (
              <form onSubmit={handleAuth}>
                <div className="auth-switch">
                  <button
                    type="button"
                    className={authMode === "login" ? "active" : ""}
                    onClick={() => setAuthMode("login")}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    className={authMode === "register" ? "active" : ""}
                    onClick={() => setAuthMode("register")}
                  >
                    Register
                  </button>
                </div>

                <h2>
                  {authMode === "register"
                    ? "Create your account"
                    : "Sign in to your account"}
                </h2>
                <p className="muted">{message}</p>

                {authMode === "register" ? (
                  <label>
                    Name
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
                  Password
                  <input
                    type="password"
                    value={authForm.password}
                    onChange={(event) =>
                      setAuthForm({ ...authForm, password: event.target.value })
                    }
                    placeholder="min. 8 characters"
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
                    ? "Working..."
                    : authMode === "register"
                      ? "Create account"
                      : "Sign in"}
                </button>

                {!databaseReady ? (
                  <p className="setup-note">
                    Add Neon/Postgres and the required database environment
                    variable in Vercel.
                  </p>
                ) : null}
              </form>
            ) : (
              <div className="welcome-card">
                <p className="eyebrow">Signed-in account</p>
                <h2>{user.name}</h2>
                <p>{user.email}</p>
                <p className="muted">{message}</p>
                <div className="welcome-grid">
                  <span>{data.invoices.length} costs</span>
                  <span>{data.payouts.length} payouts</span>
                </div>
              </div>
            )}
          </section>
        </header>

        <section className="trust-block" aria-label="Before buying another challenge">
          <div>
            <p className="eyebrow">Before buying another challenge</p>
            <h2>Check your real ROI first.</h2>
          </div>
          <p>
            Most traders remember payouts and forget fees, resets and failed
            accounts. Trader Cost Hub keeps the business math visible before you
            click another promo code.
          </p>
        </section>

        {user ? (
          <>
            <section id="overview" className="dashboard-header">
              <div>
                <p className="eyebrow">Command center</p>
                <h2>Your prop trading cockpit</h2>
                <p>
                  See the result first, then the details. Costs, payouts and
                  accounts stay separated so you can understand what is working.
                </p>
              </div>
              <div className="header-actions">
                <DisplayCurrencySwitch
                  value={displayCurrency}
                  onChange={setDisplayCurrency}
                />
                <a className="ghost-button" href="#import">
                  Add record
                </a>
                <a className="primary-button" href="#accounts">
                  View accounts
                </a>
              </div>
            </section>

            <section className="metrics-grid">
              <Metric label="Total Costs" value={display(summary.costs)} />
              <Metric label="Total Payouts" value={display(summary.payouts)} />
              <Metric
                label="Net Result"
                value={display(summary.net)}
                positive={summary.net >= 0}
              />
              <Metric
                label="ROI"
                value={`${summary.roi.toFixed(1)} %`}
                positive={summary.roi >= 0}
              />
              <Metric
                label="Break-even needed"
                value={display(breakEvenNeeded)}
                positive={breakEvenNeeded === 0}
              />
            </section>

            <ActionCenter
              hasAccount={data.accounts.length > 0}
              hasCost={data.invoices.length > 0}
              hasPayout={data.payouts.length > 0}
            />

            <section className="customer-grid">
              <OnboardingChecklist
                hasAccount={data.accounts.length > 0}
                hasCost={data.invoices.length > 0}
                hasPayout={data.payouts.length > 0}
              />
              <NeedsAttention insights={attentionInsights} />
            </section>

            <section className="focus-board" aria-label="Next best action">
              <article className="focus-card focus-card-main">
                <p className="eyebrow">Next best action</p>
                <h3>{nextAction.title}</h3>
                <p>{nextAction.text}</p>
                <a className="primary-button" href={nextAction.href}>
                  {nextAction.cta}
                </a>
              </article>
              <article className="focus-card">
                <span>Active accounts</span>
                <strong>{activeAccounts.length}</strong>
                <small>{challengeAccounts.length} in Challenge status</small>
              </article>
              <article className="focus-card">
                <span>Documents</span>
                <strong>{data.documents.length}</strong>
                <small>stored invoices / payout confirmations</small>
              </article>
              <article className="focus-card quick-links-card">
                <span>Quick actions</span>
                <a href="#accounts">+ account</a>
                <a href="#invoice">+ cost</a>
                <a href="#payout">+ payout</a>
                <button type="button" onClick={() => window.print()}>
                  Print motivation sheet
                </button>
              </article>
            </section>

            <section className="print-board" aria-label="Creator PDF motivation report">
              <div className="print-hero">
                <p>Trader Cost Hub - Creator PDF</p>
                <h1>{summary.net >= 0 ? "Keep the system. The result is growing." : "Slow down. Protect your capital."}</h1>
                <span>{new Date().toLocaleDateString("en-US")}</span>
              </div>

              <div className="print-score">
                <span>Net Result</span>
                <strong>{display(summary.net)}</strong>
                <small>ROI {summary.roi.toFixed(1)} % after all tracked costs</small>
              </div>

              <div className="print-metrics">
                <article>
                  <span>Costs</span>
                  <strong>{display(summary.costs)}</strong>
                </article>
                <article>
                  <span>Payouts</span>
                  <strong>{display(summary.payouts)}</strong>
                </article>
                <article>
                  <span>Challenge accounts</span>
                  <strong>{challengeAccounts.length}</strong>
                </article>
                <article>
                  <span>Active accounts</span>
                  <strong>{activeAccounts.length}</strong>
                </article>
              </div>

              <div className="print-grid">
                <article>
                  <span>Best account</span>
                  <strong>
                    {topAccounts[0]
                      ? `${topAccounts[0].propFirm} - ${topAccounts[0].program || "Account"}`
                      : "No result yet"}
                  </strong>
                  <small>{topAccounts[0] ? display(topAccounts[0].net) : "Add your first cost and payout."}</small>
                </article>
                <article>
                  <span>Next action</span>
                  <strong>{nextAction.title}</strong>
                  <small>{nextAction.text}</small>
                </article>
              </div>

              <div className="print-rules">
                <h2>Rules for every trading day</h2>
                <ol>
                  <li>Protect the account before chasing a payout.</li>
                  <li>Every challenge fee needs a plan, not an emotion.</li>
                  <li>If you do not measure it, it can silently cost you.</li>
                  <li>Small consistent actions beat random big wins.</li>
                </ol>
              </div>

              <blockquote>
                “Every account is a business. Track costs, keep discipline, withdraw payouts.”
              </blockquote>
            </section>

            <section className="insight-strip" aria-label="Quick summary">
              <article>
                <span>Active records</span>
                <strong>{data.invoices.length + data.payouts.length}</strong>
                <small>costs + payouts stored in the database</small>
              </article>
              <article>
                <span>Prop firms</span>
                <strong>{summary.byFirm.length}</strong>
                <small>sources with a saved cost or payout</small>
              </article>
              <article>
                <span>Tracked accounts</span>
                <strong>{summary.byAccount.length}</strong>
                <small>matched by firm + program</small>
              </article>
            </section>

            <HowItWorksSection />

            <section id="accounts" className="workspace-grid account-workspace">
              <details className="panel form-panel collapsible-panel" open>
                <summary>
                  <span>Account setup</span>
                  <strong>Create or edit a prop account</strong>
                </summary>
                <form onSubmit={saveAccount}>
                <div className="section-title">
                  <div>
                    <p className="eyebrow">Prop accounts</p>
                    <h2>Add challenge account</h2>
                  </div>
                  <span className="soft-pill">default status: Challenge</span>
                </div>
                <div className="manual-flow-card">
                  <strong>1. Create account - 2. Add cost - 3. Add payout</strong>
                  <small>
                    Invoice upload no longer fills anything automatically. Enter data manually and attach it to the right account.
                  </small>
                </div>
                <div className="form-grid">
                  <label>
                    Prop firm
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
                    Program / account
                    <input
                      value={accountDraft.program}
                      onChange={(event) =>
                        setAccountDraft({ ...accountDraft, program: event.target.value })
                      }
                      placeholder="Account 100K"
                    />
                  </label>
                  <label>
                    Account size
                    <input
                      value={accountDraft.accountSize}
                      onChange={(event) =>
                        setAccountDraft({ ...accountDraft, accountSize: event.target.value })
                      }
                      placeholder="100K"
                    />
                  </label>
                  <label>
                    Account type
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
                    Market
                    <input
                      value={accountDraft.market}
                      onChange={(event) =>
                        setAccountDraft({ ...accountDraft, market: event.target.value })
                      }
                      placeholder="Forex, Futures..."
                    />
                  </label>
                  <label>
                    Strategy
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
                    Purchase date
                    <input
                      type="date"
                      value={accountDraft.purchaseDate}
                      onChange={(event) =>
                        setAccountDraft({ ...accountDraft, purchaseDate: event.target.value })
                      }
                    />
                  </label>
                </div>
                <div className="status-shortcuts" aria-label="Quick account status shortcuts">
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
                  Save challenge account
                </button>
                </form>
              </details>

              <section className="panel">
                <div className="section-title">
                  <div>
                    <p className="eyebrow">Account portfolio</p>
                    <h2>Filters and status</h2>
                  </div>
                  <span className="soft-pill">{filteredAccounts.length} accounts</span>
                </div>
                <div className="portfolio-summary">
                  <article>
                    <span>Challenge</span>
                    <strong>{challengeAccounts.length}</strong>
                  </article>
                  <article>
                    <span>Active</span>
                    <strong>{activeAccounts.length}</strong>
                  </article>
                  <article>
                    <span>Best account</span>
                    <strong>{topAccounts[0] ? display(topAccounts[0].net) : "-"}</strong>
                  </article>
                </div>
                <div className="filter-grid">
                  <input
                    value={accountFilters.firm}
                    onChange={(event) =>
                      setAccountFilters({ ...accountFilters, firm: event.target.value })
                    }
                    placeholder="Filter firm"
                  />
                  <select
                    value={accountFilters.status}
                    onChange={(event) =>
                      setAccountFilters({ ...accountFilters, status: event.target.value })
                    }
                  >
                    <option value="">All statuses</option>
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
                    placeholder="Market"
                  />
                  <input
                    value={accountFilters.strategy}
                    onChange={(event) =>
                      setAccountFilters({ ...accountFilters, strategy: event.target.value })
                    }
                    placeholder="Strategy"
                  />
                </div>
                <div className="account-grid">
                  {filteredAccounts.length === 0 ? (
                    <p className="muted">Create your first account or adjust the filter.</p>
                  ) : (
                    filteredAccounts.map((account) => (
                      <article className="firm-card account-card" key={account.id}>
                        <div className="account-card-head">
                          <span className={`status-badge status-${account.status.replace(/\s+/g, "-")}`}>
                            {statusLabels[account.status]}
                          </span>
                          <span className={`health-badge health-${healthClass(getAccountHealth(account))}`}>
                            {getAccountHealth(account)}
                          </span>
                          <small>{account.market || "market missing"}</small>
                        </div>
                        <strong>{account.propFirm}</strong>
                        <small>{account.program || "Account missing"}</small>
                        <div className="account-metrics">
                          <span>
                            Costs
                            <strong>{display(account.costs)}</strong>
                          </span>
                          <span>
                            Payouts
                            <strong>{display(account.payouts)}</strong>
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
              <details id="invoice" className="panel form-panel collapsible-panel">
                <summary>
                  <span>Cost entry</span>
                  <strong>Add challenge fee, reset or refund</strong>
                </summary>
                <form onSubmit={addInvoice}>
                <div className="section-title">
                  <div>
                    <p className="eyebrow">Costs and challenge fees</p>
                    <h2>Add cost</h2>
                  </div>
                  <span className="soft-pill">DB save</span>
                </div>
                <div className="manual-flow-card compact">
                  <strong>Enter every cost manually from the real invoice.</strong>
                  <small>Select the account, amount, currency and date. Uploaded files are stored as proof only.</small>
                </div>

                <label className="file-drop">
                  <input
                    type="file"
                    accept=".pdf,.txt,.csv,image/*"
                    onChange={handleFile}
                  />
                  <strong>Upload invoice proof</strong>
                  <small>
                    The file is saved to Vercel Blob only. The form will not autofill.
                  </small>
                </label>

                <details className="smart-import">
                  <summary>
                    <div>
                      <p className="eyebrow">Optional document preview</p>
                      <h3>Preview text without filling the form</h3>
                    </div>
                    <span className="soft-pill">manual only</span>
                  </summary>
                  <textarea
                    value={documentText}
                    onChange={(event) => setDocumentText(event.target.value)}
                    placeholder="Paste invoice or payout email text here for a preview only. Nothing is saved or prefilled automatically."
                    rows={5}
                  />
                  <button
                    className="ghost-button full"
                    disabled={!documentText.trim()}
                    type="button"
                    onClick={handleSmartImport}
                  >
                    Show preview only
                  </button>
                </details>

                {recognition ? (
                  <RecognitionPanel recognition={recognition} />
                ) : null}

                <div className="document-stack">
                  <div className="section-title compact">
                    <div>
                      <p className="eyebrow">Document storage</p>
                      <h3>Uploaded invoices and payout confirmations</h3>
                    </div>
                    <span className="soft-pill">{data.documents.length} files</span>
                  </div>
                  {data.documents.length === 0 ? (
                    <p className="muted">Upload a PDF or screenshot. AI preview is optional and never fills the form automatically.</p>
                  ) : (
                    data.documents.slice(0, 4).map((document) => (
                      <article className="document-card" key={document.id}>
                        <div>
                          <strong>{document.fileName}</strong>
                          <small>
                            {document.aiStatus} - {(document.fileSize / 1024).toFixed(0)} KB
                          </small>
                        </div>
                        <div className="document-actions">
                          <a className="ghost-button" href={document.fileUrl} target="_blank" rel="noreferrer">
                            Open
                          </a>
                          <button
                            className="primary-button"
                            disabled={isSaving}
                            type="button"
                            onClick={() => analyzeDocument(document.id)}
                          >
                            AI preview
                          </button>
                          <button
                            className="ghost-button danger"
                            disabled={isSaving}
                            type="button"
                            onClick={() => removeDocument(document.id)}
                          >
                            Delete
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
                        <p className="eyebrow">AI preview</p>
                        <h3>{documentAnalysis.recordType}</h3>
                      </div>
                      <span className="confidence">{documentAnalysis.confidence}% confidence</span>
                    </div>
                    <div className="recognition-grid">
                      <span>Firm</span>
                      <strong>{documentAnalysis.propFirm || "not found"}</strong>
                      <span>Account</span>
                      <strong>{documentAnalysis.program || "not found"}</strong>
                      <span>Amount</span>
                      <strong>{formatMoney(documentAnalysis.amount, documentAnalysis.currency)}</strong>
                      <span>Status</span>
                      <strong>{documentAnalysis.suggestedStatus || "no suggestion"}</strong>
                    </div>
                    <p className="muted">
                      AI preview is only a reference check. Fill the form below manually and choose the right account.
                    </p>
                  </div>
                ) : null}

                <div className="form-grid">
                  <label>
                    Attach to account
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
                      <option value="">No account attached</option>
                      {data.accounts.map((account) => (
                        <option value={account.id} key={account.id}>
                          {account.propFirm} - {account.program || "Account missing"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Prop firm
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
                    Amount
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
                    Date
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
                    Note
                    <input
                      value={invoiceDraft.note}
                      onChange={(event) =>
                        setInvoiceDraft({
                          ...invoiceDraft,
                          note: event.target.value,
                        })
                      }
                      placeholder="refund, reset, extra account..."
                    />
                  </label>
                </div>
                <button className="primary-button" disabled={isSaving} type="submit">
                  Save cost
                </button>
                </form>
              </details>

              <details id="payout" className="panel form-panel collapsible-panel">
                <summary>
                  <span>Payout entry</span>
                  <strong>Add confirmed payout</strong>
                </summary>
                <form onSubmit={addPayout}>
                <div className="section-title">
                  <div>
                    <p className="eyebrow">Prop firm payouts</p>
                    <h2>Add payout</h2>
                  </div>
                  <span className="soft-pill">Profit split</span>
                </div>
                <div className="manual-flow-card compact">
                  <strong>Attach the payout to the account that earned it.</strong>
                  <small>Select the same account as the challenge fee and enter the net amount received.</small>
                </div>

                <div className="form-grid">
                  <label>
                    Attach to account
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
                      <option value="">No account attached</option>
                      {data.accounts.map((account) => (
                        <option value={account.id} key={account.id}>
                          {account.propFirm} - {account.program || "Account missing"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Prop firm
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
                    Program / account
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
                    Payout amount
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
                    Date
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
                    Note
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
                  Save payout
                </button>
                </form>
              </details>
            </section>

            <section className="analytics-grid">
              <div className="panel">
                <div className="section-title">
                  <div>
                    <p className="eyebrow">Monthly trend</p>
                    <h2>Cashflow</h2>
                  </div>
                </div>
                <div className="chart">
                  {summary.monthly.length === 0 ? (
                    <p className="muted">No data yet.</p>
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
                        <strong>{display(values.payouts - values.costs)}</strong>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="panel">
                <div className="section-title">
                  <div>
                    <p className="eyebrow">By prop firm</p>
                    <h2>Result by source</h2>
                  </div>
                </div>
                <div className="firm-grid">
                  {summary.byFirm.length === 0 ? (
                    <p className="muted">Add your first cost or payout.</p>
                  ) : (
                    summary.byFirm.map(([firm, values]) => (
                      <article className="firm-card" key={firm}>
                        <span>{firm}</span>
                        <strong>{display(values.payouts - values.costs)}</strong>
                        <small>
                          Costs {display(values.costs)} - Payouts{" "}
                          {display(values.payouts)}
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
                    <p className="eyebrow">What pays off</p>
                    <h2>Account ROI ranking</h2>
                  </div>
                  <span className="soft-pill">best / worst</span>
                </div>
                <div className="ranking-grid">
                  <div>
                    <h3>Best accounts</h3>
                    {topAccounts.length === 0 ? (
                      <p className="muted">No accounts with a result yet.</p>
                    ) : (
                      topAccounts.map((account) => (
                        <article className="rank-row" key={account.id}>
                          <span>{account.propFirm} - {account.program || "Account"}</span>
                          <strong>{display(account.net)}</strong>
                          <small>ROI {account.roi.toFixed(1)} %</small>
                        </article>
                      ))
                    )}
                  </div>
                  <div>
                    <h3>Biggest losses</h3>
                    {worstAccounts.length === 0 ? (
                      <p className="muted">No accounts with a result yet.</p>
                    ) : (
                      worstAccounts.map((account) => (
                        <article className="rank-row warning" key={account.id}>
                          <span>{account.propFirm} - {account.program || "Account"}</span>
                          <strong>{display(account.net)}</strong>
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
                    <p className="eyebrow">Monthly report</p>
                    <h2>Creator PDF summary</h2>
                  </div>
                  <button className="ghost-button" type="button" onClick={loadMonthlyReport}>
                    Load report
                  </button>
                </div>
                {monthlyReport ? (
                  <div className="report-card">
                    <div className="preview-metric">
                      <span>{monthlyReport.month}</span>
                      <strong>{display(monthlyReport.net)}</strong>
                    </div>
                    <div className="recognition-grid">
                      <span>Costs</span>
                      <strong>{display(monthlyReport.costs)}</strong>
                      <span>Payouts</span>
                      <strong>{display(monthlyReport.payouts)}</strong>
                      <span>ROI</span>
                      <strong>{monthlyReport.roi.toFixed(1)} %</strong>
                      <span>Top firm</span>
                      <strong>{monthlyReport.bestPropFirm ?? "none"}</strong>
                    </div>
                    <p className="muted">{monthlyReport.recommendation}</p>
                    <div className="recognition-actions">
                      <button className="ghost-button" type="button" onClick={() => window.print()}>
                        Print motivation sheet
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="muted">Load this month and get a clean board-ready summary.</p>
                )}
              </div>
            </section>

            <section className="panel account-panel">
              <div className="section-title">
                <div>
                  <p className="eyebrow">By account</p>
                  <h2>Costs vs payouts per account</h2>
                </div>
                <span className="soft-pill">firma + program</span>
              </div>
              <div className="account-grid">
                {summary.byAccount.length === 0 ? (
                  <p className="muted">Add a cost or payout and you will see account-level results here.</p>
                ) : (
                  summary.byAccount.map(([account, values]) => (
                    <article className="firm-card account-card" key={account}>
                      <span>{account}</span>
                      <strong>{display(values.payouts - values.costs)}</strong>
                      <small>
                        Account cost {display(values.costs)} - Payout{" "}
                        {display(values.payouts)}
                      </small>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section id="history" className="records-grid">
              <RecordsTable
                title="Costs"
                empty="No saved costs yet."
                rows={data.invoices.map((invoice) => ({
                  id: invoice.id,
                  name: invoice.propFirm,
                  detail: invoice.program || invoice.fileName || "Invoice",
                  amount: formatMoney(invoice.amount, invoice.currency),
                  date: invoice.date,
                  note: invoice.note,
                }))}
                onRemove={removeInvoice}
              />
              <RecordsTable
                title="Payouts"
                empty="No saved payouts yet."
                rows={data.payouts.map((payout) => ({
                  id: payout.id,
                  name: payout.propFirm,
                  detail: `${payout.program || "Account missing"} - ${payout.split}% split`,
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
                    <h2>Users and system usage</h2>
                  </div>
                  <button className="ghost-button" type="button" onClick={loadAdminUsers}>
                    Refresh
                  </button>
                </div>
                <div className="admin-grid">
                  {adminUsers.length === 0 ? (
                    <p className="muted">Loading users or no data yet.</p>
                  ) : (
                    adminUsers.map((summary) => (
                      <article className="admin-card" key={summary.id}>
                        <div>
                          <strong>{summary.name}</strong>
                          <span>{summary.email}</span>
                          <small>
                            {summary.accounts} accounts - {summary.invoices} costs -{" "}
                            {summary.payouts} payouts - {summary.documents} documents
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
                            {summary.blocked ? "Unblock" : "Block"}
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
          <>
            <section className="feature-grid">
              <Feature
                title="Manual-first tracking"
                text="Create the account first, then add challenge fees, resets, refunds and payouts by hand. No messy autofill."
              />
              <Feature
                title="Real ROI by account"
                text="See costs and payouts per prop firm account, including Lucid Trading - 100K Challenge."
              />
              <Feature
                title="Built for public launch"
                text="Multi-user accounts, Neon/Postgres storage, secure cookies and a growing prop firm catalog."
              />
            </section>

            <HowItWorksSection />

            <DemoDashboard displayCurrency={displayCurrency} />
          </>
        )}

        <CreatorSnapshot
          costs={user ? summary.costs : demoMetrics.costs}
          payouts={user ? summary.payouts : demoMetrics.payouts}
          net={user ? summary.net : demoMetrics.net}
          bestAccount={
            user
              ? topAccounts[0]
                ? `${topAccounts[0].propFirm} - ${topAccounts[0].program || "Account"}`
                : "No account result yet"
              : demoMetrics.account
          }
          displayCurrency={displayCurrency}
        />

        <DealsSection />

        <footer className="site-footer">
          <span>Affiliate disclosure</span>
          <span>Risk disclaimer</span>
          <span>Not financial advice</span>
          <p>
            Not financial advice. Prop trading is risky. Track your costs before
            buying another challenge. If a video or post contains a promo code
            or affiliate link, disclose that relationship directly in the video
            and caption.
          </p>
        </footer>

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
      Currency
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

function DisplayCurrencySwitch({
  value,
  onChange,
}: {
  value: DisplayCurrency;
  onChange: (currency: DisplayCurrency) => void;
}) {
  return (
    <div className="display-currency" aria-label="Display currency">
      {(["CZK", "EUR", "USD"] as DisplayCurrency[]).map((currency) => (
        <button
          className={value === currency ? "active" : ""}
          key={currency}
          type="button"
          onClick={() => onChange(currency)}
        >
          {currency}
        </button>
      ))}
    </div>
  );
}

function ActionCenter({
  hasAccount,
  hasCost,
  hasPayout,
}: {
  hasAccount: boolean;
  hasCost: boolean;
  hasPayout: boolean;
}) {
  const actions = [
    {
      title: "Create account",
      text: "Start every challenge as a trackable business asset.",
      href: "#accounts",
      done: hasAccount,
    },
    {
      title: "Add cost",
      text: "Record challenge fees, resets and refunds manually.",
      href: "#invoice",
      done: hasCost,
    },
    {
      title: "Add payout",
      text: "Attach withdrawals to the account that earned them.",
      href: "#payout",
      done: hasPayout,
    },
  ];

  return (
    <section className="action-center" aria-label="Action Center">
      <div className="section-title">
        <div>
          <p className="eyebrow">Action Center</p>
          <h2>Three clicks that keep the business clean.</h2>
        </div>
      </div>
      <div className="action-grid">
        {actions.map((action, index) => (
          <a className={action.done ? "action-card done" : "action-card"} href={action.href} key={action.title}>
            <span>{action.done ? "Done" : `Step ${index + 1}`}</span>
            <strong>{action.title}</strong>
            <small>{action.text}</small>
          </a>
        ))}
      </div>
    </section>
  );
}

function OnboardingChecklist({
  hasAccount,
  hasCost,
  hasPayout,
}: {
  hasAccount: boolean;
  hasCost: boolean;
  hasPayout: boolean;
}) {
  const items = [
    { label: "Create your first account", done: hasAccount, href: "#accounts" },
    { label: "Add the first tracked cost", done: hasCost, href: "#invoice" },
    { label: "Add the first payout", done: hasPayout, href: "#payout" },
    { label: "Print motivation sheet", done: hasAccount && hasCost, href: "#overview" },
  ];

  return (
    <section className="panel customer-panel">
      <div className="section-title compact">
        <div>
          <p className="eyebrow">Onboarding</p>
          <h3>Your tracking setup</h3>
        </div>
      </div>
      <div className="checklist">
        {items.map((item) => (
          <a className={item.done ? "check-item done" : "check-item"} href={item.href} key={item.label}>
            <span>{item.done ? "✓" : "○"}</span>
            <strong>{item.label}</strong>
          </a>
        ))}
      </div>
    </section>
  );
}

function NeedsAttention({ insights }: { insights: DashboardInsight[] }) {
  return (
    <section className="panel customer-panel">
      <div className="section-title compact">
        <div>
          <p className="eyebrow">Needs attention</p>
          <h3>Review before buying again</h3>
        </div>
      </div>
      <div className="attention-list">
        {insights.map((insight) => (
          <article className={`attention-card attention-${insight.tone}`} key={insight.title}>
            <span>{insight.title}</span>
            <strong>{insight.value}</strong>
            <small>{insight.text}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="process-grid" aria-label="How it works">
      <article>
        <span>01</span>
        <strong>Create a prop account</strong>
        <small>Choose the firm, account size, market, strategy and status.</small>
      </article>
      <article>
        <span>02</span>
        <strong>Add costs manually</strong>
        <small>Record challenge fees, resets and refunds from real amounts.</small>
      </article>
      <article>
        <span>03</span>
        <strong>Add payouts</strong>
        <small>Attach each payout to the account that earned it.</small>
      </article>
      <article>
        <span>04</span>
        <strong>Compare real ROI</strong>
        <small>See what deserves more attention before you buy again.</small>
      </article>
    </section>
  );
}

function DemoDashboard({ displayCurrency }: { displayCurrency: DisplayCurrency }) {
  const display = (value: number) => formatDisplayMoney(value, displayCurrency);

  return (
    <section id="demo" className="demo-dashboard" aria-label="Public demo dashboard">
      <div className="section-title">
        <div>
          <p className="eyebrow">Public demo</p>
          <h2>See the workflow before creating your first account.</h2>
        </div>
        <span className="soft-pill">demo data only</span>
      </div>

      <div className="demo-layout">
        <article className="demo-account-card">
          <span className="status-badge status-challenge">Challenge</span>
          <h3>Three sample accounts. One honest ROI view.</h3>
          <p>
            Compare fees, payouts and break-even across firms before you spend
            more money on another evaluation.
          </p>
          <div className="demo-metric-grid">
            <span>
              Costs
              <strong>{display(demoMetrics.costs)}</strong>
            </span>
            <span>
              Payouts
              <strong>{display(demoMetrics.payouts)}</strong>
            </span>
            <span>
              Net
              <strong>{display(demoMetrics.net)}</strong>
            </span>
            <span>
              ROI
              <strong>{demoMetrics.roi.toFixed(1)}%</strong>
            </span>
          </div>
        </article>

        <article className="demo-ranking-card">
          <p className="eyebrow">ROI ranking preview</p>
          {demoAccounts
            .slice()
            .sort((a, b) => b.net - a.net)
            .map((account) => (
              <div className={account.net < 0 ? "rank-row warning" : "rank-row"} key={account.name}>
                <span>{account.name}</span>
                <strong>{display(account.net)}</strong>
                <small>{account.note} - ROI {account.roi.toFixed(1)}%</small>
              </div>
            ))}
          <p className="muted">
            This preview shows the product idea only. Your real dashboard starts
            empty and private after registration.
          </p>
          <a className="primary-button full" href="#auth">
            Create your first account
          </a>
        </article>
      </div>
    </section>
  );
}

function CreatorSnapshot({
  costs,
  payouts,
  net,
  bestAccount,
  displayCurrency,
}: {
  costs: number;
  payouts: number;
  net: number;
  bestAccount: string;
  displayCurrency: DisplayCurrency;
}) {
  const rule = creatorRules[Math.abs(Math.round(net)) % creatorRules.length];
  const display = (value: number) => formatDisplayMoney(value, displayCurrency);

  return (
    <section className="creator-snapshot" aria-label="Creator snapshot">
      <div>
        <p className="eyebrow">Creator Snapshot</p>
        <h2>Simple numbers for honest trading content.</h2>
        <p>
          Use this block as a clean TikTok talking point: costs first, payouts
          second, real ROI always.
        </p>
      </div>
      <div className="snapshot-grid">
        <span>
          This month costs
          <strong>{display(costs)}</strong>
        </span>
        <span>
          Payouts
          <strong>{display(payouts)}</strong>
        </span>
        <span>
          Net result
          <strong>{display(net)}</strong>
        </span>
        <span>
          Best account
          <strong>{bestAccount}</strong>
        </span>
      </div>
      <blockquote className="snapshot-rule">{rule}</blockquote>
    </section>
  );
}

function DealsSection() {
  return (
    <section id="deals" className="deals-section" aria-label="Prop Firm Deals">
      <div className="section-title">
        <div>
          <p className="eyebrow">Prop Firm Deals</p>
          <h2>Trust-first deals I would personally track and compare.</h2>
        </div>
        <span className="soft-pill">paid link disclosure</span>
      </div>

      <p className="deal-disclosure">
        Some links may be paid links. I may earn a commission at no extra cost
        to you. I only list firms I would personally track and compare.
      </p>

      <div className="deals-grid">
        {affiliateDeals
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((deal) => (
          <article className={deal.featured ? "deal-card featured" : "deal-card"} key={deal.slug}>
            <div className="deal-head">
              <div>
                <p className="eyebrow">{deal.featured ? "Featured" : "Tracked deal"}</p>
                <h3>{deal.firmName}</h3>
              </div>
              <span className="deal-code">{deal.promoCode}</span>
            </div>
            <p>{deal.discountText}</p>
            <div className="deal-comparison">
              <span>
                Discount
                <strong>{deal.promoCode}</strong>
              </span>
              <span>
                Account types
                <strong>{deal.accountTypes.join(", ")}</strong>
              </span>
              <span>
                Risk note
                <strong>{deal.riskReminder}</strong>
              </span>
              <span>
                Why track it
                <strong>{deal.trackingTip}</strong>
              </span>
            </div>
            <div className="deal-tags">
              {deal.accountTypes.map((type) => (
                <span key={type}>{type}</span>
              ))}
            </div>
            <dl className="deal-notes">
              <div>
                <dt>Best for</dt>
                <dd>{deal.bestFor}</dd>
              </div>
              <div>
                <dt>Payout note</dt>
                <dd>{deal.payoutNote}</dd>
              </div>
              <div>
                <dt>Risk note</dt>
                <dd>{deal.riskNote}</dd>
              </div>
              <div>
                <dt>Personal verdict</dt>
                <dd>{deal.personalVerdict}</dd>
              </div>
            </dl>
            <p className="deal-mini-disclosure">Paid link / affiliate relationship may apply.</p>
            <a
              className="primary-button full"
              href={deal.affiliateUrl}
              target="_blank"
              rel="sponsored noopener noreferrer"
            >
              Use my code
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

function RecognitionPanel({ recognition }: { recognition: RecognitionResult }) {
  const kindLabel =
    recognition.kind === "payout"
      ? "Payout"
      : recognition.kind === "cost"
        ? "Cost"
        : "Unclear";

  return (
    <div className={`recognition-card recognition-${recognition.kind}`}>
      <div className="recognition-head">
        <div>
          <p className="eyebrow">Document preview</p>
          <h3>{kindLabel}</h3>
        </div>
        <span className="confidence">{recognition.confidence}% confidence</span>
      </div>

      <div className="recognition-grid">
        <span>Firm</span>
        <strong>{recognition.propFirm || "not found"}</strong>
        <span>Amount</span>
        <strong>
          {recognition.amount
            ? formatMoney(Number(recognition.amount), recognition.currency)
            : "not found"}
        </strong>
        <span>Date</span>
        <strong>{recognition.date || "not found"}</strong>
        <span>Program</span>
        <strong>{recognition.program || "not found"}</strong>
      </div>

      {recognition.signals.length ? (
        <div className="signal-row">
          {recognition.signals.map((signal) => (
            <span key={signal}>{signal}</span>
          ))}
        </div>
      ) : null}

      <p className="muted">
        This is only a preview. If the data looks right, enter it manually as a cost or payout.
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
          <p className="eyebrow">History</p>
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
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
