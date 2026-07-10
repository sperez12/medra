import { alphaVantageProvider } from "@/lib/prices/providers/alpha-vantage";
import { coingeckoProvider } from "@/lib/prices/providers/coingecko";
import { coinmarketcapProvider } from "@/lib/prices/providers/coinmarketcap";
import { twelveDataProvider } from "@/lib/prices/providers/twelve-data";
import type { PriceProvider, PriceProviderId, PriceProviderRequest, PriceProviderResult } from "@/lib/prices/types";

const providers: Record<PriceProviderId, PriceProvider | null> = {
  manual: null,
  coingecko: coingeckoProvider,
  coinmarketcap: coinmarketcapProvider,
  alpha_vantage: alphaVantageProvider,
  twelve_data: twelveDataProvider,
};

export async function fetchPricesByProvider(requests: PriceProviderRequest[]) {
  const grouped = new Map<PriceProviderId, PriceProviderRequest[]>();

  requests.forEach((request) => {
    if (request.provider === "manual") return;
    grouped.set(request.provider, [...(grouped.get(request.provider) ?? []), request]);
  });

  const results: PriceProviderResult[] = [];
  for (const [providerId, providerRequests] of grouped.entries()) {
    const provider = providers[providerId];
    if (!provider) continue;
    results.push(...await provider.fetchPrices(providerRequests));
  }

  return results;
}

export function getPriceProviderLabel(provider: PriceProviderId) {
  return providers[provider]?.label ?? "Manual";
}

export type { PriceProviderId, PriceProviderRequest, PriceProviderResult };
