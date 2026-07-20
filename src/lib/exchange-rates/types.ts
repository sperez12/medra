export type ExchangeRateProviderId = "frankfurter";

export type ExchangeRateQuote = {
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  rateDate: string;
  source: ExchangeRateProviderId;
};

export type FetchExchangeRatesRequest = {
  baseCurrency: string;
  quoteCurrencies: string[];
};

export type FetchExchangeRatesResult = {
  rates: ExchangeRateQuote[];
  rateDate: string | null;
};
