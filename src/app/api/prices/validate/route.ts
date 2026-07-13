import { NextResponse } from "next/server";

type ValidatePriceRequest = {
  provider?: string;
  providerAssetId?: string;
  providerSymbol?: string;
};

export async function POST(request: Request) {
  let body: ValidatePriceRequest;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ valid: false, error: "No pude leer la solicitud de validacion." }, { status: 400 });
  }

  if (body.provider === "coingecko") {
    return validateCoinGeckoId(body.providerAssetId);
  }

  if (body.provider === "alpha_vantage") {
    return validateAlphaVantageSymbol(body.providerSymbol);
  }

  return NextResponse.json({ valid: false, error: "Proveedor de precios no soportado para validacion." }, { status: 400 });
}

async function validateCoinGeckoId(value: string | undefined) {
  const providerAssetId = value?.trim().toLowerCase();
  if (!providerAssetId) {
    return NextResponse.json({
      valid: false,
      error: "Escribe el CoinGecko ID. Ejemplos: bitcoin, ethereum o solana.",
    }, { status: 400 });
  }

  const url = new URL("https://api.coingecko.com/api/v3/simple/price");
  url.searchParams.set("ids", providerAssetId);
  url.searchParams.set("vs_currencies", "usd");

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
      return NextResponse.json({
        valid: false,
        error: "No pude validar el ID con CoinGecko. Revisa tu conexion o intenta mas tarde.",
      }, { status: 502 });
    }

    const data = await response.json();
    const price = data?.[providerAssetId]?.usd;
    if (!Number.isFinite(price)) {
      return NextResponse.json({
        valid: false,
        error: "No encontre ese ID en CoinGecko. CoinGecko usa IDs como bitcoin, ethereum o solana, no simbolos como BTC.",
      }, { status: 404 });
    }

    return NextResponse.json({ valid: true });
  } catch {
    return NextResponse.json({
      valid: false,
      error: "No pude validar el ID con CoinGecko. Revisa tu conexion o intenta mas tarde.",
    }, { status: 502 });
  }
}

async function validateAlphaVantageSymbol(value: string | undefined) {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({
      valid: false,
      error: "Falta configurar ALPHA_VANTAGE_API_KEY en .env.local. Agrega la clave, reinicia la app y vuelve a intentar.",
    }, { status: 500 });
  }

  const symbol = value?.trim().toUpperCase();
  if (!symbol) {
    return NextResponse.json({
      valid: false,
      error: "Escribe el ticker/simbolo para Alpha Vantage. Ejemplos: AAPL, MSFT, VOO o QQQ.",
    }, { status: 400 });
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
      return NextResponse.json({
        valid: false,
        error: "Alpha Vantage no respondio correctamente. Revisa tu conexion o intenta mas tarde.",
      }, { status: 502 });
    }

    const data = await response.json();
    const apiError = getAlphaVantageValidationError(data);
    if (apiError) {
      return NextResponse.json({ valid: false, error: apiError }, { status: 400 });
    }

    const price = Number(data?.["Global Quote"]?.["05. price"]);
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json({
        valid: false,
        error: `No encontre "${symbol}" en Alpha Vantage. Usa tickers validos como AAPL, MSFT, VOO o QQQ.`,
      }, { status: 404 });
    }

    return NextResponse.json({ valid: true });
  } catch {
    return NextResponse.json({
      valid: false,
      error: "No pude conectar con Alpha Vantage. Revisa tu conexion o intenta mas tarde.",
    }, { status: 502 });
  }
}

function getAlphaVantageValidationError(data: Record<string, unknown>) {
  const errorMessage = data["Error Message"];
  if (typeof errorMessage === "string") return "No encontre ese simbolo en Alpha Vantage. Usa tickers validos como AAPL, MSFT, VOO o QQQ.";

  const note = data.Note;
  if (typeof note === "string") return "Alpha Vantage alcanzo su limite de consultas. Espera un poco antes de volver a intentar.";

  const information = data.Information;
  if (typeof information === "string") {
    const normalized = information.toLowerCase();
    if (normalized.includes("api key")) return "La API key de Alpha Vantage no es valida o falta configurarla. Revisa .env.local y reinicia la app.";
    if (normalized.includes("rate limit") || normalized.includes("frequency") || normalized.includes("standard api call frequency")) {
      return "Alpha Vantage alcanzo su limite de consultas. Espera un poco antes de volver a intentar.";
    }
    return "Alpha Vantage no pudo validar el simbolo. Revisa la API key, el ticker o intenta mas tarde.";
  }

  return "";
}
