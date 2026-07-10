import type { PriceProvider } from "@/lib/prices/types";

export const coinmarketcapProvider: PriceProvider = {
  id: "coinmarketcap",
  label: "CoinMarketCap",
  supportedAssetTypes: ["crypto"],
  async fetchPrices(requests) {
    return requests.map((request) => ({
      assetId: request.assetId,
      provider: "coinmarketcap",
      price: null,
      currency: request.currency,
      updatedAt: null,
      error: "CoinMarketCap esta preparado, pero aun no esta conectado.",
    }));
  },
};
