import { NextResponse } from "next/server";

type ValidatePriceRequest = {
  provider?: string;
  providerAssetId?: string;
};

export async function POST(request: Request) {
  let body: ValidatePriceRequest;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ valid: false, error: "No pude leer la solicitud de validacion." }, { status: 400 });
  }

  if (body.provider !== "coingecko") {
    return NextResponse.json({ valid: false, error: "Por ahora solo se puede validar CoinGecko." }, { status: 400 });
  }

  const providerAssetId = body.providerAssetId?.trim().toLowerCase();
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
