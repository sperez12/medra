import type { InvestmentAssetType } from "@/types/finance";

export type PriceProviderId = "manual" | "coingecko" | "coinmarketcap" | "alpha_vantage" | "twelve_data";

export type PriceProviderRequest = {
  assetId: string;
  symbol: string;
  name: string;
  assetType: InvestmentAssetType;
  provider: PriceProviderId;
  providerAssetId: string | null;
  providerSymbol: string | null;
  currency: string;
};

export type PriceProviderResult = {
  assetId: string;
  provider: PriceProviderId;
  price: number | null;
  currency: string;
  updatedAt: string | null;
  error: string | null;
};

export type PriceProvider = {
  id: PriceProviderId;
  label: string;
  supportedAssetTypes: InvestmentAssetType[];
  fetchPrices: (requests: PriceProviderRequest[]) => Promise<PriceProviderResult[]>;
};
