export type Currency = "CZK" | "EUR" | "USD";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export type Invoice = {
  id: string;
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
  propFirm: string;
  program: string;
  amount: number;
  currency: Currency;
  date: string;
  split: number;
  note: string | null;
};
