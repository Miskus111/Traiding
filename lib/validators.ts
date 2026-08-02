import type { Currency } from "./types";

export const currencies: Currency[] = ["CZK", "EUR", "USD"];

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
  return currencies.includes(value as Currency) ? (value as Currency) : "EUR";
}

export function dateValue(value: unknown) {
  if (typeof value !== "string") return new Date().toISOString().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : new Date().toISOString().slice(0, 10);
}
