import { createClient } from "@supabase/supabase-js";
import { fetchPricesByProvider, type PriceProviderId, type PriceProviderRequest } from "@/lib/prices";
import { NextResponse } from "next/server";
import type { InvestmentAssetType } from "@/types/finance";

type AssetRow = {
  id: string;
  symbol: string;
  name: string;
  asset_type: InvestmentAssetType;
  currency: string;
  price_source: PriceProviderId;
  coingecko_id: string | null;
  price_provider: PriceProviderId | null;
  provider_asset_id: string | null;
  provider_symbol: string | null;
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
    .select("id, symbol, name, asset_type, currency, price_source, coingecko_id, price_provider, provider_asset_id, provider_symbol")
    .eq("user_id", userData.user.id)
    .eq("asset_type", "crypto")
    .or("price_source.eq.coingecko,price_provider.eq.coingecko");

  if (assetError) {
    return NextResponse.json({ error: getFriendlyError(assetError.message) }, { status: 400 });
  }

  const requests = ((assets ?? []) as AssetRow[]).map(toPriceRequest).filter((item): item is PriceProviderRequest => Boolean(item));

  if (requests.length === 0) {
    return NextResponse.json({
      updated: 0,
      failed: 0,
      message: "No hay activos cripto con proveedor automatico para actualizar.",
    });
  }

  const results = await fetchPricesByProvider(requests);
  let updated = 0;
  const failures: string[] = [];

  for (const result of results) {
    const requestInfo = requests.find((item) => item.assetId === result.assetId);
    if (!result.price || result.error) {
      failures.push(`${requestInfo?.symbol ?? result.assetId}: ${result.error ?? "Sin precio disponible"}`);
      await supabase
        .from("assets")
        .update({ last_price_error: result.error ?? "Sin precio disponible" })
        .eq("id", result.assetId)
        .eq("user_id", userData.user.id);
      continue;
    }

    const { error: updateError } = await supabase
      .from("assets")
      .update({
        current_price: result.price,
        last_price_updated_at: result.updatedAt,
        last_price_error: null,
      })
      .eq("id", result.assetId)
      .eq("user_id", userData.user.id);

    if (updateError) {
      failures.push(`${requestInfo?.symbol ?? result.assetId}: ${updateError.message}`);
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
        ? `Se actualizaron ${updated} activo(s). Algunos quedaron con error: ${failures.join(" | ")}.`
        : `Se actualizaron ${updated} precio(s) correctamente.`,
  });
}

function toPriceRequest(asset: AssetRow): PriceProviderRequest | null {
  const provider = asset.price_provider || asset.price_source;
  if (provider !== "coingecko") return null;

  return {
    assetId: asset.id,
    symbol: asset.symbol,
    name: asset.name,
    assetType: asset.asset_type,
    provider,
    providerAssetId: asset.provider_asset_id || asset.coingecko_id,
    providerSymbol: asset.provider_symbol || asset.symbol,
    currency: asset.currency,
  };
}

function getFriendlyError(error: string) {
  if (error.includes("schema cache") || error.includes("price_provider") || error.includes("provider_asset_id")) {
    return "Falta actualizar Supabase. Ejecuta docs/ADD_PRICE_PROVIDER_ARCHITECTURE.sql.";
  }

  if (error.includes("price_source") || error.includes("coingecko_id")) {
    return "Falta actualizar Supabase. Ejecuta docs/ADD_CRYPTO_PRICE_SUPPORT.sql y despues docs/ADD_PRICE_PROVIDER_ARCHITECTURE.sql.";
  }

  return `No pude cargar tus activos para precios. Detalle: ${error}`;
}
