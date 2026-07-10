import type { PriceProvider } from "@/lib/prices/types";

export const twelveDataProvider: PriceProvider = {
  id: "twelve_data",
  label: "Twelve Data",
  supportedAssetTypes: ["stock", "etf", "fund"],
  async fetchPrices(requests) {
    return requests.map((request) => ({
      assetId: request.assetId,
      provider: "twelve_data",
      price: null,
      currency: request.currency,
      updatedAt: null,
      error: "Twelve Data esta preparado, pero aun no esta conectado.",
    }));
  },
};
