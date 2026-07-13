import type { PriceProvider, PriceProviderRequest, PriceProviderResult } from "@/lib/prices/types";

export const alphaVantageProvider: PriceProvider = {
  id: "alpha_vantage",
  label: "Alpha Vantage",
  supportedAssetTypes: ["stock", "etf"],
  async fetchPrices(requests) {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY?.trim();
    if (!apiKey) {
      return requests.map((request) =>
        errorResult(request, "Falta ALPHA_VANTAGE_API_KEY en .env.local. Agrega la clave, reinicia la app y vuelve a actualizar. Se conservo el precio anterior.")
      );
    }

    const results: PriceProviderResult[] = [];

    for (const request of requests) {
      const symbol = request.providerSymbol?.trim().toUpperCase() || request.symbol.trim().toUpperCase();
      if (!symbol) {
        results.push(errorResult(request, "Falta simbolo/ticker para Alpha Vantage. Ejemplos validos: AAPL, MSFT, VOO o QQQ."));
        continue;
      }

      const url = new URL("https://www.alphavantage.co/query");
      url.searchParams.set("function", "GLOBAL_QUOTE");
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("apikey", apiKey);

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
          results.push(errorResult(request, `Alpha Vantage no respondio correctamente (codigo ${response.status}). Intenta mas tarde. Se conservo el precio anterior.`));
          continue;
        }

        const data = await response.json();
        const apiError = getAlphaVantageError(data);
        if (apiError) {
          results.push(errorResult(request, apiError));
          continue;
        }

        const price = Number(data?.["Global Quote"]?.["05. price"]);
        if (!Number.isFinite(price) || price <= 0) {
          results.push(errorResult(request, `Alpha Vantage no encontro precio para "${symbol}". Revisa que sea un ticker valido como AAPL, MSFT, VOO o QQQ.`));
          continue;
        }

        results.push({
          assetId: request.assetId,
          provider: "alpha_vantage",
          price,
          currency: request.currency,
          updatedAt: new Date().toISOString(),
          error: null,
        });
      } catch {
        results.push(errorResult(request, "No pude conectar con Alpha Vantage. Revisa internet o intenta mas tarde. Se conservo el precio anterior."));
      }
    }

    return results;
  },
};

function getAlphaVantageError(data: Record<string, unknown>) {
  const errorMessage = data["Error Message"];
  if (typeof errorMessage === "string") return "Alpha Vantage no encontro ese simbolo. Revisa que uses un ticker valido como AAPL, MSFT, VOO o QQQ.";

  const note = data.Note;
  if (typeof note === "string") return "Alpha Vantage alcanzo su limite de consultas. Espera un poco antes de volver a actualizar. Se conservo el precio anterior.";

  const information = data.Information;
  if (typeof information === "string") {
    const normalized = information.toLowerCase();
    if (normalized.includes("api key")) return "La API key de Alpha Vantage no es valida o falta configurarla. Revisa .env.local y reinicia la app.";
    if (normalized.includes("rate limit") || normalized.includes("frequency") || normalized.includes("standard api call frequency")) {
      return "Alpha Vantage alcanzo su limite de consultas. Espera un poco antes de volver a actualizar. Se conservo el precio anterior.";
    }
    return "Alpha Vantage no pudo entregar el precio. Revisa la API key, el ticker o intenta mas tarde.";
  }

  return "";
}

function errorResult(request: PriceProviderRequest, error: string): PriceProviderResult {
  return {
    assetId: request.assetId,
    provider: "alpha_vantage",
    price: null,
    currency: request.currency,
    updatedAt: null,
    error,
  };
}
