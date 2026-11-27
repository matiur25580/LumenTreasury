import { createHash } from "node:crypto";

export type NormalizedStatementRow = {
  bookingDate: Date;
  valueDate: Date | null;
  amount: string;
  description: string;
  currency: string;
  counterparty: string | null;
  externalReference: string | null;
  direction: "inflow" | "outflow";
  dedupeKey: string;
};

export function parseStatementDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

const amountPattern = /^-?\d{1,15}(?:\.\d{1,4})?$/;

export function normalizeStatementRow(
  row: Record<string, unknown>,
  accountCurrency: string
): { value: NormalizedStatementRow; errors?: never } | { errors: string[]; value?: never } {
  const bookingDate = parseStatementDate(row.bookingDate);
  const valueDate = row.valueDate ? parseStatementDate(row.valueDate) : null;
  const amount = String(row.amount ?? "").trim();
  const description = String(row.description ?? "").trim();
  const currency = String(row.currency ?? accountCurrency).trim().toUpperCase();
  const errors: string[] = [];

  if (!bookingDate) errors.push("bookingDate must use YYYY-MM-DD");
  if (row.valueDate && !valueDate) errors.push("valueDate must use YYYY-MM-DD");
  if (!amountPattern.test(amount) || Number(amount) === 0) {
    errors.push("amount must be a non-zero decimal with up to 4 fractional digits");
  }
  if (!description || description.length > 500) {
    errors.push("description is required and must be at most 500 characters");
  }
  if (!/^[A-Z]{3}$/.test(currency) || currency !== accountCurrency) {
    errors.push("currency must match the selected bank account currency");
  }
  if (errors.length) return { errors };

  const counterparty = String(row.counterparty ?? "").trim().slice(0, 180) || null;
  const externalReference = String(row.reference ?? "").trim().slice(0, 160) || null;
  const normalizedAmount = amount.replace(/^(-?)0+(?=\d)/, "$1");
  const canonical = [
    bookingDate!.toISOString().slice(0, 10),
    normalizedAmount,
    currency,
    externalReference ?? "",
    description.toLowerCase(),
    counterparty ?? ""
  ].join("|");

  return {
    value: {
      bookingDate: bookingDate!,
      valueDate,
      amount: normalizedAmount,
      description,
      currency,
      counterparty,
      externalReference,
      direction: amount.startsWith("-") ? "outflow" : "inflow",
      dedupeKey: createHash("sha256").update(canonical).digest("hex")
    }
  };
}
