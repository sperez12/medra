import type { PriceProvider } from "@/lib/prices/types";

export const alphaVantageProvider: PriceProvider = {
  id: "alpha_vantage",
  label: "Alpha Vantage",
  supportedAssetTypes: ["stock", "etf", "fund"],
  async fetchPrices(requests) {
    return requests.map((request) => ({
      assetId: request.assetId,
      provider: "alpha_vantage",
      price: null,
      currency: request.currency,
      updatedAt: null,
      error: "Alpha Vantage esta preparado, pero aun no esta conectado.",
    }));
  },
};
