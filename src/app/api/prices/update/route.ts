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
    .or("price_source.eq.coingecko,price_provider.eq.coingecko,price_provider.eq.alpha_vantage");

  if (assetError) {
    return NextResponse.json({ error: getFriendlyError(assetError.message) }, { status: 400 });
  }

  const automaticAssets = ((assets ?? []) as AssetRow[]).filter(isSupportedAutomaticAsset);
  const requests = automaticAssets.map(toPriceRequest).filter((item): item is PriceProviderRequest => Boolean(item));
  const missingProviderIdAssets = automaticAssets.filter((asset) => {
    const provider = asset.price_provider || asset.price_source;
    return provider === "coingecko" && !asset.provider_asset_id?.trim() && !asset.coingecko_id?.trim();
  });
  const missingProviderSymbolAssets = automaticAssets.filter((asset) => {
    const provider = asset.price_provider || asset.price_source;
    return provider === "alpha_vantage" && !asset.provider_symbol?.trim() && !asset.symbol?.trim();
  });

  if (automaticAssets.length === 0) {
    return NextResponse.json({
      updated: 0,
      failed: 0,
      message: "No hay activos configurados con precio automatico. Edita una cripto con CoinGecko o una accion/ETF con Alpha Vantage.",
    });
  }

  if (requests.length === 0 && (missingProviderIdAssets.length > 0 || missingProviderSymbolAssets.length > 0)) {
    const names = [...missingProviderIdAssets, ...missingProviderSymbolAssets].map((asset) => asset.symbol).join(", ");
    return NextResponse.json({
      updated: 0,
      failed: missingProviderIdAssets.length + missingProviderSymbolAssets.length,
      failures: [
        ...missingProviderIdAssets.map((asset) => `${asset.symbol}: falta CoinGecko ID`),
        ...missingProviderSymbolAssets.map((asset) => `${asset.symbol}: falta simbolo Alpha Vantage`),
      ],
      message: `Hay activos automaticos incompletos: ${names}. Revisa CoinGecko ID para cripto o ticker para Alpha Vantage.`,
    });
  }

  const results = await fetchPricesByProvider(requests);
  let updated = 0;
  const failures: string[] = [
    ...missingProviderIdAssets.map((asset) => `${asset.symbol}: falta CoinGecko ID`),
    ...missingProviderSymbolAssets.map((asset) => `${asset.symbol}: falta simbolo Alpha Vantage`),
  ];

  for (const asset of missingProviderIdAssets) {
    await supabase
      .from("assets")
      .update({ last_price_error: "Falta CoinGecko ID. Ejemplo: BTC debe usar bitcoin." })
      .eq("id", asset.id)
      .eq("user_id", userData.user.id);
  }

  for (const asset of missingProviderSymbolAssets) {
    await supabase
      .from("assets")
      .update({ last_price_error: "Falta simbolo para Alpha Vantage. Ejemplos: AAPL, MSFT, VOO." })
      .eq("id", asset.id)
      .eq("user_id", userData.user.id);
  }

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
        ? `Actualizacion parcial: se actualizaron ${updated} activo(s), pero algunos requieren revision: ${failures.join(" | ")}. El precio anterior se conservo.`
        : `Se actualizaron ${updated} precio(s) correctamente.`,
  });
}

function isSupportedAutomaticAsset(asset: AssetRow) {
  const provider = asset.price_provider || asset.price_source;
  if (provider === "coingecko") return asset.asset_type === "crypto";
  if (provider === "alpha_vantage") return asset.asset_type === "stock" || asset.asset_type === "etf";
  return false;
}

function toPriceRequest(asset: AssetRow): PriceProviderRequest | null {
  const provider = asset.price_provider || asset.price_source;
  if (provider === "coingecko" && !asset.provider_asset_id?.trim() && !asset.coingecko_id?.trim()) return null;
  if (provider === "alpha_vantage" && !asset.provider_symbol?.trim() && !asset.symbol?.trim()) return null;
  if (provider !== "coingecko" && provider !== "alpha_vantage") return null;

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
