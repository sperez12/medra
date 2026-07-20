import { isSupportedCurrency, normalizeCurrency } from "@/lib/currencies";
import type { FetchExchangeRatesRequest, FetchExchangeRatesResult } from "@/lib/exchange-rates/types";

const FRANKFURTER_RATES_URL = "https://api.frankfurter.dev/v2/rates";
const FRANKFURTER_SOURCE = "frankfurter" as const;

type FrankfurterRateRow = {
  date?: string;
  base?: string;
  quote?: string;
  rate?: number;
};

export async function fetchFrankfurterExchangeRates({
  baseCurrency,
  quoteCurrencies,
}: FetchExchangeRatesRequest): Promise<FetchExchangeRatesResult> {
  const normalizedBaseCurrency = normalizeCurrency(baseCurrency);
  const normalizedQuoteCurrencies = Array.from(
    new Set(quoteCurrencies.map((currency) => normalizeCurrency(currency)))
  ).filter((currency) => currency !== normalizedBaseCurrency && isSupportedCurrency(currency));

  if (!isSupportedCurrency(normalizedBaseCurrency)) {
    throw new Error("unsupported_base_currency");
  }

  if (normalizedQuoteCurrencies.length === 0) {
    return { rates: [], rateDate: null };
  }

  const url = new URL(FRANKFURTER_RATES_URL);
  url.searchParams.set("base", normalizedBaseCurrency);
  url.searchParams.set("quotes", normalizedQuoteCurrencies.join(","));
  url.searchParams.set("providers", "ECB");

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
    },
    next: {
      revalidate: 0,
    },
  });

  if (!response.ok) {
    throw new Error("provider_unavailable");
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("unexpected_provider_response");
  }

  const rates = data
    .map((row: FrankfurterRateRow) => normalizeFrankfurterRateRow(row, normalizedBaseCurrency))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  return {
    rates,
    rateDate: rates[0]?.rateDate ?? null,
  };
}

function normalizeFrankfurterRateRow(row: FrankfurterRateRow, expectedBaseCurrency: string) {
  const baseCurrency = normalizeCurrency(row.base);
  const quoteCurrency = normalizeCurrency(row.quote);
  const rate = Number(row.rate);
  const rateDate = typeof row.date === "string" ? row.date : "";

  if (baseCurrency !== expectedBaseCurrency) return null;
  if (!isSupportedCurrency(baseCurrency) || !isSupportedCurrency(quoteCurrency)) return null;
  if (baseCurrency === quoteCurrency) return null;
  if (!Number.isFinite(rate) || rate <= 0) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rateDate)) return null;

  return {
    baseCurrency,
    quoteCurrency,
    rate,
    rateDate,
    source: FRANKFURTER_SOURCE,
  };
}
