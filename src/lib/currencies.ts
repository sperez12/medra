export const DEFAULT_CURRENCY = "MXN";

export const SUPPORTED_CURRENCIES = [
  { code: "MXN", label: "MXN - Peso mexicano" },
  { code: "USD", label: "USD - Dolar estadounidense" },
  { code: "EUR", label: "EUR - Euro" },
  { code: "GBP", label: "GBP - Libra esterlina" },
  { code: "CAD", label: "CAD - Dolar canadiense" },
  { code: "CHF", label: "CHF - Franco suizo" },
  { code: "JPY", label: "JPY - Yen japones" },
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];

export type MoneyTotal = {
  currency: string;
  amount: number;
};

export function normalizeCurrency(currency: string | null | undefined) {
  const value = currency?.trim().toUpperCase();
  return value || DEFAULT_CURRENCY;
}

export function isSupportedCurrency(currency: string) {
  return SUPPORTED_CURRENCIES.some((item) => item.code === normalizeCurrency(currency));
}

export function formatCurrency(amount: number, currency: string = DEFAULT_CURRENCY) {
  const normalizedCurrency = normalizeCurrency(currency);

  try {
    return amount.toLocaleString("es-MX", {
      style: "currency",
      currency: normalizedCurrency,
    });
  } catch {
    return `${amount.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${normalizedCurrency}`;
  }
}

export function groupMoneyByCurrency<T>(
  items: T[],
  getAmount: (item: T) => number,
  getCurrency: (item: T) => string | null | undefined
) {
  const totals = new Map<string, number>();

  items.forEach((item) => {
    const currency = normalizeCurrency(getCurrency(item));
    totals.set(currency, (totals.get(currency) ?? 0) + getAmount(item));
  });

  return Array.from(totals.entries())
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export function sumMoneyTotals(totals: MoneyTotal[], currency: string) {
  const normalizedCurrency = normalizeCurrency(currency);
  return totals
    .filter((total) => normalizeCurrency(total.currency) === normalizedCurrency)
    .reduce((sum, total) => sum + total.amount, 0);
}
