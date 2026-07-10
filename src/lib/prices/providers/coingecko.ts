import type { PriceProvider, PriceProviderRequest, PriceProviderResult } from "@/lib/prices/types";

export const coingeckoProvider: PriceProvider = {
  id: "coingecko",
  label: "CoinGecko",
  supportedAssetTypes: ["crypto"],
  async fetchPrices(requests) {
    const validRequests = requests.filter((request) => Boolean(request.providerAssetId?.trim()));
    if (validRequests.length === 0) return [];

    const ids = Array.from(new Set(validRequests.map((request) => request.providerAssetId!.trim().toLowerCase())));
    const currencies = Array.from(new Set(validRequests.map((request) => request.currency.toLowerCase())));
    const url = new URL("https://api.coingecko.com/api/v3/simple/price");
    url.searchParams.set("ids", ids.join(","));
    url.searchParams.set("vs_currencies", currencies.join(","));

    let prices: Record<string, Record<string, number>>;
    try {
      const response = await fetch(url, {
        headers: {
          accept: "application/json",
        },
        next: {
          revalidate: 0,
        },
      });

      if (!response.ok) {
        return requests.map((request) => errorResult(request, `CoinGecko no respondio correctamente (codigo ${response.status}). Se conservo el precio anterior.`));
      }

      prices = await response.json();
    } catch {
      return requests.map((request) => errorResult(request, "No pude conectar con CoinGecko. Revisa internet o intenta mas tarde. Se conservo el precio anterior."));
    }

    const updatedAt = new Date().toISOString();
    return requests.map((request) => {
      const providerAssetId = request.providerAssetId?.trim().toLowerCase();
      if (!providerAssetId) return errorResult(request, "Falta CoinGecko ID. Ejemplo: BTC debe usar bitcoin.");

      const price = prices[providerAssetId]?.[request.currency.toLowerCase()];
      if (!Number.isFinite(price)) return errorResult(request, `CoinGecko no encontro el ID "${providerAssetId}". Revisa que sea el ID, no solo el simbolo.`);

      return {
        assetId: request.assetId,
        provider: "coingecko",
        price,
        currency: request.currency,
        updatedAt,
        error: null,
      };
    });
  },
};

function errorResult(request: PriceProviderRequest, error: string): PriceProviderResult {
  return {
    assetId: request.assetId,
    provider: "coingecko",
    price: null,
    currency: request.currency,
    updatedAt: null,
    error,
  };
}
