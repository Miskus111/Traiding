import type { AccountStatus, Currency } from "./types";

export const currencies: Currency[] = ["USD"];
export const accountStatuses: AccountStatus[] = [
  "challenge",
  "verification",
  "funded",
  "failed",
  "payout received",
  "refunded",
  "archived",
];

export function requiredText(value: unknown, maxLength = 160) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function optionalText(value: unknown, maxLength = 240) {
  const text = requiredText(value, maxLength);
  return text || null;
}

export function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function currencyValue(value: unknown): Currency {
  return currencies.includes(value as Currency) ? (value as Currency) : "USD";
}

export function dateValue(value: unknown) {
  if (typeof value !== "string") return new Date().toISOString().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : new Date().toISOString().slice(0, 10);
}

export function optionalDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function accountStatusValue(value: unknown): AccountStatus {
  return accountStatuses.includes(value as AccountStatus)
    ? (value as AccountStatus)
    : "challenge";
}
