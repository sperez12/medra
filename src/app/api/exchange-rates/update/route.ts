import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES, isSupportedCurrency, normalizeCurrency } from "@/lib/currencies";
import { fetchFrankfurterExchangeRates } from "@/lib/exchange-rates";

type UpdateExchangeRatesRequest = {
  baseCurrency?: string;
};

type SupabaseErrorLike = {
  code?: string;
  message?: string;
  details?: string | null;
};

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization");

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Falta configurar Supabase." }, { status: 500 });
  }

  if (!authorization) {
    return NextResponse.json({ error: "Primero inicia sesion para actualizar tipos de cambio." }, { status: 401 });
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

  const body = await readBody(request);
  const baseCurrency = normalizeCurrency(body.baseCurrency || DEFAULT_CURRENCY);
  if (!isSupportedCurrency(baseCurrency)) {
    return NextResponse.json({ error: "Selecciona una moneda base valida." }, { status: 400 });
  }

  const quoteCurrencies = SUPPORTED_CURRENCIES
    .map((currency) => currency.code)
    .filter((currency) => currency !== baseCurrency);

  let result;
  try {
    result = await fetchFrankfurterExchangeRates({ baseCurrency, quoteCurrencies });
  } catch {
    return NextResponse.json({
      error: "No pude conectar con Frankfurter / ECB. Intenta mas tarde.",
    }, { status: 502 });
  }

  if (result.rates.length === 0) {
    return NextResponse.json({
      error: "Frankfurter / ECB no devolvio tasas para esa moneda base.",
    }, { status: 502 });
  }

  const fetchedAt = new Date().toISOString();
  const payload = result.rates.map((rate) => ({
    user_id: userData.user.id,
    base_currency: rate.baseCurrency,
    quote_currency: rate.quoteCurrency,
    rate: rate.rate,
    rate_date: rate.rateDate,
    source: rate.source,
    fetched_at: fetchedAt,
    updated_at: fetchedAt,
  }));

  const { error } = await supabase
    .from("exchange_rates")
    .upsert(payload, { onConflict: "user_id,base_currency,quote_currency,rate_date,source" });

  if (error) {
    const friendlyError = getFriendlyExchangeRateStorageError(error);
    return NextResponse.json(friendlyError, { status: friendlyError.needsMigration ? 400 : 500 });
  }

  return NextResponse.json({
    updated: payload.length,
    baseCurrency,
    rateDate: result.rateDate,
    fetchedAt,
    source: "Frankfurter / ECB",
    message: `Se actualizaron ${payload.length} tipos de cambio de referencia para ${baseCurrency}.`,
  });
}

async function readBody(request: Request): Promise<UpdateExchangeRatesRequest> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function getFriendlyExchangeRateStorageError(error: SupabaseErrorLike) {
  const code = error.code ?? "";
  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();

  if (
    code === "42P01" ||
    message.includes("exchange_rates") && (message.includes("schema cache") || message.includes("does not exist"))
  ) {
    return {
      needsMigration: true,
      error: "Para guardar tipos de cambio automaticos, ejecuta la migracion pendiente.",
    };
  }

  if (code === "23514" || message.includes("check constraint")) {
    return {
      error: "Frankfurter devolvio una tasa que no paso las validaciones de moneda o valor.",
    };
  }

  return {
    error: "No pude guardar los tipos de cambio automaticos. Intenta mas tarde.",
  };
}
