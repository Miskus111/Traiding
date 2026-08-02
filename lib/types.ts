export type Currency = "CZK" | "EUR" | "USD";
export type UserRole = "admin" | "user";
export type AccountStatus =
  | "challenge"
  | "verification"
  | "funded"
  | "failed"
  | "payout received"
  | "refunded"
  | "archived";
export type DocumentAiStatus = "pending" | "analyzed" | "failed" | "skipped";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  blocked: boolean;
};

export type TradingAccount = {
  id: string;
  propFirm: string;
  program: string;
  accountSize: string;
  accountType: string;
  market: string;
  strategy: string;
  status: AccountStatus;
  purchaseDate: string | null;
  endedDate: string | null;
  note: string | null;
  createdAt: string;
  costs: number;
  payouts: number;
  net: number;
  roi: number;
};

export type TradingDocument = {
  id: string;
  fileName: string;
  fileUrl: string;
  filePath: string;
  contentType: string;
  fileSize: number;
  aiStatus: DocumentAiStatus;
  confidence: number;
  extractedJson: DocumentAnalysis | null;
  accountId: string | null;
  invoiceId: string | null;
  payoutId: string | null;
  createdAt: string;
};

export type DocumentAnalysis = {
  recordType: "cost" | "payout" | "unknown";
  propFirm: string;
  program: string;
  accountSize: string;
  accountType: string;
  market: string;
  strategy: string;
  feeType: string;
  amount: number;
  currency: Currency;
  date: string;
  split: number;
  suggestedStatus: AccountStatus | "";
  confidence: number;
  explanation: string;
};

export type Invoice = {
  id: string;
  accountId: string | null;
  propFirm: string;
  program: string;
  amount: number;
  currency: Currency;
  date: string;
  fileName: string | null;
  note: string | null;
};

export type Payout = {
  id: string;
  accountId: string | null;
  propFirm: string;
  program: string;
  amount: number;
  currency: Currency;
  date: string;
  split: number;
  note: string | null;
};

export type AdminUserSummary = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  blocked: boolean;
  createdAt: string;
  accounts: number;
  invoices: number;
  payouts: number;
  documents: number;
};
