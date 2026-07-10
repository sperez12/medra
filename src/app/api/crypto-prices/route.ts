import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type CryptoAssetRow = {
  id: string;
  symbol: string;
  name: string;
  currency: string;
  coingecko_id: string | null;
};

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization");

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Falta configurar Supabase." }, { status: 500 });
  }

  if (!authorization) {
    return NextResponse.json({ error: "Primero inicia sesion para actualizar precios." }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "No pude validar tu sesion." }, { status: 401 });
  }

  const { data: assets, error: assetError } = await supabase
    .from("assets")
    .select("id, symbol, name, currency, coingecko_id")
    .eq("user_id", userData.user.id)
    .eq("asset_type", "crypto")
    .eq("price_source", "coingecko");

  if (assetError) {
    return NextResponse.json({ error: getFriendlyError(assetError.message) }, { status: 400 });
  }

  const cryptoAssets = (assets ?? []) as CryptoAssetRow[];
  const validAssets = cryptoAssets.filter((asset) => Boolean(asset.coingecko_id?.trim()));
  const ids = Array.from(new Set(validAssets.map((asset) => asset.coingecko_id!.trim().toLowerCase())));

  if (validAssets.length === 0 || ids.length === 0) {
    return NextResponse.json({
      updated: 0,
      failed: cryptoAssets.length,
      message: "No hay activos cripto con CoinGecko ID para actualizar.",
    });
  }

  const currencies = Array.from(new Set(validAssets.map((asset) => asset.currency.toLowerCase())));
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
      return NextResponse.json(
        { error: `CoinGecko no respondio correctamente. Codigo: ${response.status}. No se cambio ningun precio.` },
        { status: 502 }
      );
    }

    prices = await response.json();
  } catch {
    return NextResponse.json({ error: "No pude conectar con CoinGecko. Se conservaron los precios actuales." }, { status: 502 });
  }

  const now = new Date().toISOString();
  const failures: string[] = [];
  let updated = 0;

  for (const asset of validAssets) {
    const id = asset.coingecko_id!.trim().toLowerCase();
    const currency = asset.currency.toLowerCase();
    const price = prices[id]?.[currency];

    if (!Number.isFinite(price)) {
      failures.push(`${asset.symbol} (${id})`);
      continue;
    }

    const { error: updateError } = await supabase
      .from("assets")
      .update({
        current_price: price,
        last_price_updated_at: now,
      })
      .eq("id", asset.id)
      .eq("user_id", userData.user.id);

    if (updateError) {
      failures.push(`${asset.symbol} (${id})`);
      continue;
    }

    updated += 1;
  }

  return NextResponse.json({
    updated,
    failed: failures.length,
    failures,
    message:
      failures.length > 0
        ? `Se actualizaron ${updated} activo(s). Algunos IDs no se encontraron: ${failures.join(", ")}.`
        : `Se actualizaron ${updated} precio(s) cripto correctamente.`,
  });
}

function getFriendlyError(error: string) {
  if (error.includes("schema cache") || error.includes("price_source") || error.includes("coingecko_id")) {
    return "Falta actualizar Supabase. Ejecuta docs/ADD_CRYPTO_PRICE_SUPPORT.sql.";
  }

  return `No pude cargar tus activos cripto. Detalle: ${error}`;
}
