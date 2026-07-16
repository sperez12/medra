"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { MoneyAmount } from "@/components/ui/money-amount";
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES, groupMoneyByCurrency, isSupportedCurrency, normalizeCurrency } from "@/lib/currencies";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  Holding,
  InvestmentAsset,
  InvestmentAssetType,
  InvestmentPriceSource,
  InvestmentPlatform,
  InvestmentPlatformType,
  InvestmentTransaction,
  InvestmentTransactionType,
} from "@/types/finance";

const platformTypeLabels: Record<InvestmentPlatformType, string> = {
  broker: "Broker",
  crypto_exchange: "Exchange cripto",
  wallet: "Wallet",
  bank: "Banco",
  retirement: "Afore/retiro",
  other: "Otra",
};

const assetTypeLabels: Record<InvestmentAssetType, string> = {
  crypto: "Cripto",
  stock: "Accion",
  etf: "ETF",
  fund: "Fondo",
  bond: "Bono",
  investment_cash: "Efectivo inversion",
  other: "Otro",
};

const priceSourceLabels: Record<InvestmentPriceSource, string> = {
  manual: "Manual",
  coingecko: "CoinGecko",
  coinmarketcap: "CoinMarketCap (despues)",
  alpha_vantage: "Alpha Vantage",
  twelve_data: "Twelve Data (despues)",
};

const commonCoinGeckoIds = [
  ["BTC", "bitcoin"],
  ["ETH", "ethereum"],
  ["SOL", "solana"],
  ["BNB", "binancecoin"],
  ["XRP", "ripple"],
  ["ADA", "cardano"],
  ["DOGE", "dogecoin"],
  ["AVAX", "avalanche-2"],
  ["DOT", "polkadot"],
  ["MATIC/POL", "polygon-ecosystem-token"],
];

const commonAlphaVantageSymbols = ["AAPL", "MSFT", "VOO", "QQQ", "SPY", "VTI", "TSLA", "NVDA"];

const transactionTypeLabels: Record<InvestmentTransactionType, string> = {
  buy: "Compra",
  sell: "Venta",
  dividend: "Dividendo",
  interest: "Interes",
  deposit: "Deposito",
  withdrawal: "Retiro",
  adjustment: "Ajuste",
};

const emptyPlatformForm = {
  name: "",
  platform_type: "broker" as InvestmentPlatformType,
  country: "",
  currency: DEFAULT_CURRENCY,
  description: "",
  is_active: true,
};

const emptyAssetForm = {
  symbol: "",
  name: "",
  asset_type: "etf" as InvestmentAssetType,
  currency: "USD",
  current_price: "0",
  price_source: "manual" as InvestmentPriceSource,
  coingecko_id: "",
  provider_symbol: "",
  description: "",
  is_active: true,
};

const emptyHoldingForm = {
  platform_id: "",
  asset_id: "",
  quantity: "0",
  average_cost: "",
  notes: "",
};

const emptyTransactionForm = {
  platform_id: "",
  asset_id: "",
  transaction_date: new Date().toISOString().slice(0, 10),
  transaction_type: "buy" as InvestmentTransactionType,
  quantity: "0",
  price: "0",
  total_amount: "0",
  fees: "0",
  description: "",
};

type Message = {
  type: "success" | "error" | "info";
  text: string;
};

type HoldingSummary = {
  holding: Holding;
  platform: InvestmentPlatform | undefined;
  asset: InvestmentAsset | undefined;
  value: number;
};

export function InvestmentManager() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [platforms, setPlatforms] = useState<InvestmentPlatform[]>([]);
  const [assets, setAssets] = useState<InvestmentAsset[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);
  const [platformForm, setPlatformForm] = useState(emptyPlatformForm);
  const [assetForm, setAssetForm] = useState(emptyAssetForm);
  const [holdingForm, setHoldingForm] = useState(emptyHoldingForm);
  const [transactionForm, setTransactionForm] = useState(emptyTransactionForm);
  const [editingPlatformId, setEditingPlatformId] = useState<string | null>(null);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [editingHoldingId, setEditingHoldingId] = useState<string | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingPriceGroup, setUpdatingPriceGroup] = useState<"crypto" | "stock_etf" | null>(null);
  const [updatingAssetId, setUpdatingAssetId] = useState<string | null>(null);
  const [isSavingAsset, setIsSavingAsset] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    if (!supabase) {
      setMessage({ type: "error", text: "Falta conectar Supabase para usar inversiones." });
      setIsLoading(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "info", text: "Inicia sesion para ver tus inversiones." });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const [
      { data: platformData, error: platformError },
      { data: assetData, error: assetError },
      { data: holdingData, error: holdingError },
      { data: transactionData, error: transactionError },
    ] = await Promise.all([
      supabase.from("platforms").select("*").eq("user_id", userData.user.id).order("created_at", { ascending: false }),
      supabase.from("assets").select("*").eq("user_id", userData.user.id).order("symbol"),
      supabase.from("holdings").select("*").eq("user_id", userData.user.id).order("created_at", { ascending: false }),
      supabase.from("investment_transactions").select("*").eq("user_id", userData.user.id).order("transaction_date", { ascending: false }),
    ]);

    if (platformError || assetError || holdingError || transactionError) {
      setMessage({
        type: "error",
        text: getFriendlyInvestmentError(platformError?.message ?? assetError?.message ?? holdingError?.message ?? transactionError?.message ?? "No se pudieron cargar las inversiones."),
      });
      setIsLoading(false);
      return;
    }

    setPlatforms((platformData ?? []) as InvestmentPlatform[]);
    setAssets((assetData ?? []) as InvestmentAsset[]);
    setHoldings((holdingData ?? []) as Holding[]);
    setTransactions((transactionData ?? []) as InvestmentTransaction[]);
    setIsLoading(false);
  }

  async function getUserId() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  }

  async function savePlatform(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (!supabase) return setMessage({ type: "error", text: "Falta conectar Supabase." });
    const userId = await getUserId();
    if (!userId) return setMessage({ type: "error", text: "Primero inicia sesion para guardar plataformas." });
    const validation = validatePlatform(platformForm);
    if (validation) return setMessage({ type: "error", text: validation });

    const payload = {
      user_id: userId,
      name: platformForm.name.trim(),
      platform_type: platformForm.platform_type,
      country: platformForm.country.trim() || null,
      currency: normalizeCurrency(platformForm.currency),
      description: platformForm.description.trim() || null,
      is_active: platformForm.is_active,
    };
    const request = editingPlatformId
      ? supabase.from("platforms").update(payload).eq("id", editingPlatformId).eq("user_id", userId)
      : supabase.from("platforms").insert(payload);
    const { error } = await request;
    if (error) return setMessage({ type: "error", text: getFriendlyInvestmentError(error.message) });

    setPlatformForm(emptyPlatformForm);
    setEditingPlatformId(null);
    setMessage({ type: "success", text: editingPlatformId ? "Plataforma actualizada. El resumen ya usa sus nuevos datos." : "Plataforma creada. Ahora puedes asociarle activos y holdings." });
    await loadData();
  }

  async function saveAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (!supabase) return setMessage({ type: "error", text: "Falta conectar Supabase." });
    const userId = await getUserId();
    if (!userId) return setMessage({ type: "error", text: "Primero inicia sesion para guardar activos." });
    const validation = validateAsset(assetForm, assets, editingAssetId);
    if (validation) return setMessage({ type: "error", text: validation });

    setIsSavingAsset(true);
    const automaticPriceValidationError = await validateAutomaticPriceBeforeSave(assetForm);
    if (automaticPriceValidationError) {
      setIsSavingAsset(false);
      setMessage({ type: "error", text: automaticPriceValidationError });
      return;
    }

    const priceProvider = getAssetPriceProvider(assetForm);
    const payload = {
      user_id: userId,
      symbol: assetForm.symbol.trim().toUpperCase(),
      name: assetForm.name.trim(),
      asset_type: assetForm.asset_type,
      currency: normalizeCurrency(assetForm.currency),
      current_price: Number(assetForm.current_price),
      price_source: assetForm.asset_type === "crypto" ? assetForm.price_source : "manual",
      coingecko_id: assetForm.asset_type === "crypto" && assetForm.price_source === "coingecko" ? assetForm.coingecko_id.trim().toLowerCase() : null,
      price_provider: priceProvider,
      provider_asset_id: assetForm.asset_type === "crypto" && assetForm.price_source === "coingecko" ? assetForm.coingecko_id.trim().toLowerCase() : null,
      provider_symbol: priceProvider === "alpha_vantage" ? getAlphaVantageSymbol(assetForm) : assetForm.symbol.trim().toUpperCase(),
      description: assetForm.description.trim() || null,
      is_active: assetForm.is_active,
    };
    const request = editingAssetId
      ? supabase.from("assets").update(payload).eq("id", editingAssetId).eq("user_id", userId)
      : supabase.from("assets").insert(payload);
    const { error } = await request;
    if (error) {
      setIsSavingAsset(false);
      return setMessage({ type: "error", text: getFriendlyInvestmentError(error.message) });
    }

    setAssetForm(emptyAssetForm);
    setEditingAssetId(null);
    setMessage({ type: "success", text: editingAssetId ? "Activo actualizado. Los valores estimados ya usan el precio configurado." : "Activo creado. Ahora puedes registrarlo en un holding." });
    setIsSavingAsset(false);
    await loadData();
  }

  async function saveHolding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (!supabase) return setMessage({ type: "error", text: "Falta conectar Supabase." });
    const userId = await getUserId();
    if (!userId) return setMessage({ type: "error", text: "Primero inicia sesion para guardar holdings." });
    const validation = validateHolding(holdingForm, holdings, editingHoldingId);
    if (validation) return setMessage({ type: "error", text: validation });

    const payload = {
      user_id: userId,
      platform_id: holdingForm.platform_id,
      asset_id: holdingForm.asset_id,
      quantity: Number(holdingForm.quantity),
      average_cost: holdingForm.average_cost === "" ? null : Number(holdingForm.average_cost),
      notes: holdingForm.notes.trim() || null,
    };
    const request = editingHoldingId
      ? supabase.from("holdings").update(payload).eq("id", editingHoldingId).eq("user_id", userId)
      : supabase.from("holdings").insert(payload);
    const { error } = await request;
    if (error) return setMessage({ type: "error", text: getFriendlyInvestmentError(error.message) });

    setHoldingForm(emptyHoldingForm);
    setEditingHoldingId(null);
    setMessage({ type: "success", text: editingHoldingId ? "Holding actualizado. El valor estimado fue recalculado." : "Holding creado. Ya aparece en el valor total por moneda." });
    await loadData();
  }

  async function saveTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (!supabase) return setMessage({ type: "error", text: "Falta conectar Supabase." });
    const userId = await getUserId();
    if (!userId) return setMessage({ type: "error", text: "Primero inicia sesion para guardar transacciones." });
    const validation = validateTransaction(transactionForm);
    if (validation) return setMessage({ type: "error", text: validation });

    const payload = {
      user_id: userId,
      platform_id: transactionForm.platform_id,
      asset_id: transactionForm.asset_id,
      transaction_date: transactionForm.transaction_date,
      transaction_type: transactionForm.transaction_type,
      quantity: Number(transactionForm.quantity),
      price: Number(transactionForm.price),
      total_amount: Number(transactionForm.total_amount),
      fees: Number(transactionForm.fees || 0),
      description: transactionForm.description.trim() || null,
    };
    const request = editingTransactionId
      ? supabase.from("investment_transactions").update(payload).eq("id", editingTransactionId).eq("user_id", userId)
      : supabase.from("investment_transactions").insert(payload);
    const { error } = await request;
    if (error) return setMessage({ type: "error", text: getFriendlyInvestmentError(error.message) });

    setTransactionForm(emptyTransactionForm);
    setEditingTransactionId(null);
    setMessage({ type: "success", text: editingTransactionId ? "Transaccion actualizada." : "Transaccion registrada. Recuerda que por ahora no cambia automaticamente la cantidad del holding." });
    await loadData();
  }

  async function updatePrices({
    assetType,
    provider,
    assetId,
    successMessage,
    emptyMessage,
  }: {
    assetType?: InvestmentAssetType;
    provider?: InvestmentPriceSource;
    assetId?: string;
    successMessage: string;
    emptyMessage: string;
  }) {
    setMessage(null);

    if (!supabase) {
      setMessage({ type: "error", text: "Falta conectar Supabase antes de actualizar precios." });
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setMessage({ type: "error", text: "Primero inicia sesion para actualizar precios." });
      return;
    }

    if (assetId) {
      setUpdatingAssetId(assetId);
    } else if (assetType === "crypto") {
      setUpdatingPriceGroup("crypto");
    } else {
      setUpdatingPriceGroup("stock_etf");
    }

    try {
      const response = await fetch("/api/prices/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          asset_type: assetType,
          provider,
          asset_id: assetId,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        setMessage({ type: "error", text: result.error ?? "No pude actualizar precios. Se conservaron los precios actuales." });
        return;
      }

      setMessage({
        type: result.failed > 0 ? "error" : result.updated > 0 ? "success" : "info",
        text: result.updated > 0 && result.failed === 0 ? successMessage : result.message ?? emptyMessage,
      });
      await loadData();
    } catch {
      setMessage({ type: "error", text: assetId ? "No se pudo actualizar este activo. Se conservo el precio anterior." : "No pude conectar con el actualizador de precios. Se conservaron los precios actuales." });
    } finally {
      setUpdatingPriceGroup(null);
      setUpdatingAssetId(null);
    }
  }

  async function validateAutomaticPriceBeforeSave(form: typeof emptyAssetForm) {
    if (form.asset_type === "crypto" && form.price_source === "coingecko") {
      return validatePriceProviderBeforeSave({
        provider: "coingecko",
        providerAssetId: form.coingecko_id,
        fallbackError: "No encontre ese ID en CoinGecko. CoinGecko usa IDs como bitcoin, ethereum o solana, no simbolos como BTC.",
        connectionError: "No pude validar el ID con CoinGecko. Revisa tu conexion o intenta mas tarde.",
      });
    }

    if ((form.asset_type === "stock" || form.asset_type === "etf") && form.price_source === "alpha_vantage") {
      return validatePriceProviderBeforeSave({
        provider: "alpha_vantage",
        providerSymbol: getAlphaVantageSymbol(form),
        fallbackError: "No encontre ese simbolo en Alpha Vantage. Usa tickers validos como AAPL, MSFT, VOO o QQQ.",
        connectionError: "No pude validar el simbolo con Alpha Vantage. Revisa tu conexion, tu API key o intenta mas tarde.",
      });
    }

    return "";
  }

  async function validatePriceProviderBeforeSave({
    provider,
    providerAssetId,
    providerSymbol,
    fallbackError,
    connectionError,
  }: {
    provider: InvestmentPriceSource;
    providerAssetId?: string;
    providerSymbol?: string;
    fallbackError: string;
    connectionError: string;
  }) {
    try {
      const response = await fetch("/api/prices/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider,
          providerAssetId,
          providerSymbol,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.valid) {
        return result.error ?? fallbackError;
      }
    } catch {
      return connectionError;
    }

    return "";
  }

  async function deleteRow(table: "platforms" | "assets" | "holdings" | "investment_transactions", id: string, label: string, successMessage: string) {
    if (!supabase) return;
    const confirmed = window.confirm(`Vas a borrar ${label}.\n\nSeguro que quieres continuar?`);
    if (!confirmed) return setMessage({ type: "info", text: "No se borro nada." });
    const userId = await getUserId();
    if (!userId) return setMessage({ type: "error", text: "Primero inicia sesion para borrar." });
    const { error } = await supabase.from(table).delete().eq("id", id).eq("user_id", userId);
    if (error) return setMessage({ type: "error", text: getFriendlyInvestmentError(error.message) });
    setMessage({ type: "success", text: successMessage });
    await loadData();
  }

  const holdingSummaries = holdings.map((holding) => buildHoldingSummary(holding, platforms, assets));
  const totalByCurrency = groupMoneyByCurrency(holdingSummaries, (summary) => summary.value, (summary) => summary.asset?.currency);
  const valueByPlatform = buildValueByPlatform(holdingSummaries).slice(0, 6);
  const valueByAssetType = buildValueByAssetType(holdingSummaries);
  const recentTransactions = transactions.slice(0, 8);
  const duplicateAssetGroups = findDuplicateAssetGroups(assets);

  if (isLoading) return <StatusPanel text="Cargando inversiones..." />;

  return (
    <div className="space-y-6">
      <section className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Valor total estimado" value={<MoneyTotals totals={totalByCurrency} />} />
        <SummaryCard label="Plataformas activas" value={String(platforms.filter((item) => item.is_active).length)} />
        <SummaryCard label="Activos activos" value={String(assets.filter((item) => item.is_active).length)} />
        <SummaryCard label="Holdings" value={String(holdings.length)} />
      </section>

      <div className="flex min-w-0 flex-col gap-3 rounded-md bg-blue-50 p-3 text-sm text-blue-800 xl:flex-row xl:items-center xl:justify-between">
        <p>
          Los precios pueden ser manuales, venir de CoinGecko para cripto o de Alpha Vantage para acciones y ETFs. Si Alpha Vantage marca limite, actualiza acciones/ETFs individualmente.
        </p>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:min-w-[360px]">
          <button
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300"
            disabled={Boolean(updatingPriceGroup || updatingAssetId)}
            onClick={() =>
              updatePrices({
                assetType: "crypto",
                provider: "coingecko",
                successMessage: "Cripto actualizado correctamente.",
                emptyMessage: "No hay criptos configuradas con CoinGecko.",
              })
            }
            type="button"
          >
            {updatingPriceGroup === "crypto" ? "Actualizando..." : "Actualizar cripto"}
          </button>
          <button
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={Boolean(updatingPriceGroup || updatingAssetId)}
            onClick={() =>
              updatePrices({
                provider: "alpha_vantage",
                successMessage: "Acciones/ETFs actualizados correctamente.",
                emptyMessage: "No hay acciones o ETFs configurados con Alpha Vantage.",
              })
            }
            type="button"
          >
            {updatingPriceGroup === "stock_etf" ? "Actualizando..." : "Actualizar acciones/ETFs"}
          </button>
        </div>
      </div>

      {duplicateAssetGroups.length > 0 ? (
        <DuplicateAssetsNotice groups={duplicateAssetGroups} />
      ) : null}

      {message ? <StatusMessage message={message} /> : null}

      <section className="grid min-w-0 gap-6 xl:grid-cols-2">
        <PlatformForm form={platformForm} editingId={editingPlatformId} onSubmit={savePlatform} onChange={setPlatformForm} onCancel={() => { setEditingPlatformId(null); setPlatformForm(emptyPlatformForm); }} />
        <AssetForm form={assetForm} editingId={editingAssetId} isSaving={isSavingAsset} onSubmit={saveAsset} onChange={setAssetForm} onCancel={() => { setEditingAssetId(null); setAssetForm(emptyAssetForm); }} />
      </section>

      <section className="grid min-w-0 gap-6 xl:grid-cols-2">
        <HoldingForm assets={assets} platforms={platforms} form={holdingForm} editingId={editingHoldingId} onSubmit={saveHolding} onChange={setHoldingForm} onCancel={() => { setEditingHoldingId(null); setHoldingForm(emptyHoldingForm); }} />
        <TransactionForm
          assets={assets}
          platforms={platforms}
          form={transactionForm}
          editingId={editingTransactionId}
          onSubmit={saveTransaction}
          onChange={setTransactionForm}
          onCancel={() => { setEditingTransactionId(null); setTransactionForm(emptyTransactionForm); }}
        />
      </section>

      <section className="grid min-w-0 gap-6 xl:grid-cols-3">
        <SimpleList title="Valor por plataforma">
          {valueByPlatform.map((item) => (
            <ListRow key={`${item.platform.id}-${item.currency}`} title={item.platform.name} detail={platformTypeLabels[item.platform.platform_type]} value={<MoneyAmount amount={item.amount} currency={item.currency} />} />
          ))}
          {valueByPlatform.length === 0 ? <EmptyMessage text="Aun no hay valor por plataforma. Crea holdings para ver este resumen." /> : null}
        </SimpleList>
        <SimpleList title="Valor por tipo de activo">
          {valueByAssetType.map((item) => (
            <ListRow key={`${item.assetType}-${item.currency}`} title={assetTypeLabels[item.assetType]} detail={item.currency} value={<MoneyAmount amount={item.amount} currency={item.currency} />} />
          ))}
          {valueByAssetType.length === 0 ? <EmptyMessage text="Aun no hay valor por tipo de activo." /> : null}
        </SimpleList>
        <SimpleList title="Plataformas">
          {platforms.map((platform) => (
            <ListRow
              key={platform.id}
              title={platform.name}
              detail={`${platformTypeLabels[platform.platform_type]} - ${platform.currency}${platform.country ? ` - ${platform.country}` : ""}`}
              value={platform.is_active ? "Activa" : "Inactiva"}
              onEdit={() => startEditPlatform(platform)}
              onDelete={() => deleteRow("platforms", platform.id, `la plataforma "${platform.name}"`, "Plataforma borrada correctamente.")}
            />
          ))}
          {platforms.length === 0 ? <EmptyMessage text="Aun no hay plataformas. Crea una para empezar." /> : null}
        </SimpleList>
      </section>

      <section className="grid min-w-0 gap-6 xl:grid-cols-2">
        <HoldingsTable
          rows={holdingSummaries}
          onEdit={(holding) => startEditHolding(holding)}
          onDelete={(holding) => deleteRow("holdings", holding.id, "este holding", "Holding borrado. El valor total fue recalculado.")}
        />
        <AssetsTable
          assets={assets}
          isUpdatingPrices={Boolean(updatingPriceGroup)}
          updatingAssetId={updatingAssetId}
          onEdit={(asset) => startEditAsset(asset)}
          onDelete={(asset) => deleteRow("assets", asset.id, `el activo "${asset.symbol}"`, "Activo borrado correctamente.")}
          onUpdate={(asset) =>
            updatePrices({
              assetId: asset.id,
              successMessage: "Precio actualizado correctamente.",
              emptyMessage: "Este activo no esta configurado con precio automatico.",
            })
          }
        />
      </section>

      <TransactionsTable
        assets={assets}
        platforms={platforms}
        transactions={recentTransactions}
        onEdit={(transaction) => startEditTransaction(transaction)}
        onDelete={(transaction) => deleteRow("investment_transactions", transaction.id, "esta transaccion", "Transaccion borrada correctamente.")}
      />
    </div>
  );

  function startEditPlatform(platform: InvestmentPlatform) {
    setEditingPlatformId(platform.id);
    setPlatformForm({
      name: platform.name,
      platform_type: platform.platform_type,
      country: platform.country ?? "",
      currency: normalizeCurrency(platform.currency),
      description: platform.description ?? "",
      is_active: platform.is_active,
    });
    setMessage({ type: "info", text: "Editando plataforma." });
  }

  function startEditAsset(asset: InvestmentAsset) {
    setEditingAssetId(asset.id);
    setAssetForm({
      symbol: asset.symbol,
      name: asset.name,
      asset_type: asset.asset_type,
      currency: normalizeCurrency(asset.currency),
      current_price: String(asset.current_price),
      price_source: getEditablePriceSource(asset),
      coingecko_id: asset.provider_asset_id ?? asset.coingecko_id ?? "",
      provider_symbol: asset.provider_symbol ?? asset.symbol,
      description: asset.description ?? "",
      is_active: asset.is_active,
    });
    setMessage({ type: "info", text: "Editando activo." });
  }

  function startEditHolding(holding: Holding) {
    setEditingHoldingId(holding.id);
    setHoldingForm({
      platform_id: holding.platform_id,
      asset_id: holding.asset_id,
      quantity: String(holding.quantity),
      average_cost: holding.average_cost === null ? "" : String(holding.average_cost),
      notes: holding.notes ?? "",
    });
    setMessage({ type: "info", text: "Editando holding." });
  }

  function startEditTransaction(transaction: InvestmentTransaction) {
    setEditingTransactionId(transaction.id);
    setTransactionForm({
      platform_id: transaction.platform_id,
      asset_id: transaction.asset_id,
      transaction_date: transaction.transaction_date,
      transaction_type: transaction.transaction_type,
      quantity: String(transaction.quantity),
      price: String(transaction.price),
      total_amount: String(transaction.total_amount),
      fees: String(transaction.fees),
      description: transaction.description ?? "",
    });
    setMessage({ type: "info", text: "Editando transaccion." });
  }
}

function PlatformForm({ form, editingId, onSubmit, onChange, onCancel }: {
  form: typeof emptyPlatformForm;
  editingId: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (form: typeof emptyPlatformForm) => void;
  onCancel: () => void;
}) {
  return (
    <form className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm" onSubmit={onSubmit}>
      <h2 className="text-lg font-semibold text-slate-950">{editingId ? "Editar plataforma" : "Nueva plataforma"}</h2>
      <div className="mt-4 grid gap-4">
        <TextInput label="Nombre de la plataforma" value={form.name} onChange={(value) => onChange({ ...form, name: value })} />
        <SelectInput label="Tipo" value={form.platform_type} onChange={(value) => onChange({ ...form, platform_type: value as InvestmentPlatformType })}>
          {Object.entries(platformTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </SelectInput>
        <TextInput label="Pais opcional" required={false} value={form.country} onChange={(value) => onChange({ ...form, country: value })} />
        <CurrencySelect value={form.currency} onChange={(value) => onChange({ ...form, currency: value })} />
        <TextInput label="Descripcion opcional" required={false} value={form.description} onChange={(value) => onChange({ ...form, description: value })} />
        <Checkbox label="Activa" checked={form.is_active} onChange={(checked) => onChange({ ...form, is_active: checked })} />
      </div>
      <FormButtons editing={Boolean(editingId)} submitLabel={editingId ? "Guardar plataforma" : "Crear plataforma"} onCancel={onCancel} />
    </form>
  );
}

function AssetForm({ form, editingId, isSaving, onSubmit, onChange, onCancel }: {
  form: typeof emptyAssetForm;
  editingId: string | null;
  isSaving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (form: typeof emptyAssetForm) => void;
  onCancel: () => void;
}) {
  return (
    <form className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm" onSubmit={onSubmit}>
      <h2 className="text-lg font-semibold text-slate-950">{editingId ? "Editar activo" : "Nuevo activo"}</h2>
      <p className="mt-2 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
        Crea cada activo una sola vez por simbolo, tipo y moneda. Si tienes el mismo activo en otra plataforma, crea un holding nuevo usando el activo existente.
      </p>
      <div className="mt-4 grid gap-4">
        <TextInput label="Simbolo" placeholder="VOO, AAPL, BTC..." value={form.symbol} onChange={(value) => onChange({ ...form, symbol: value })} />
        <TextInput label="Nombre" value={form.name} onChange={(value) => onChange({ ...form, name: value })} />
        <SelectInput
          label="Tipo"
          value={form.asset_type}
          onChange={(value) => {
            const nextType = value as InvestmentAssetType;
            const nextPriceSource = getDefaultPriceSourceForType(nextType, form.price_source);
            onChange({
              ...form,
              asset_type: nextType,
              price_source: nextPriceSource,
              coingecko_id: nextType === "crypto" ? form.coingecko_id : "",
              provider_symbol: nextType === "stock" || nextType === "etf" ? (form.provider_symbol || form.symbol.toUpperCase()) : "",
            });
          }}
        >
          {Object.entries(assetTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </SelectInput>
        <CurrencySelect value={form.currency} onChange={(value) => onChange({ ...form, currency: value })} />
        <TextInput label="Precio actual manual" min="0" step="0.00000001" type="number" value={form.current_price} onChange={(value) => onChange({ ...form, current_price: value })} />
        {form.asset_type === "crypto" || form.asset_type === "stock" || form.asset_type === "etf" ? (
          <>
            <SelectInput label="Fuente de precio" value={form.price_source} onChange={(value) => onChange({ ...form, price_source: value as InvestmentPriceSource })}>
              {getPriceSourceOptionsForType(form.asset_type).map((value) => <option key={value} value={value}>{priceSourceLabels[value]}</option>)}
            </SelectInput>
            {form.asset_type === "crypto" ? (
              <p className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
                Para cripto, CoinGecko usa IDs. CoinMarketCap queda preparado para despues, pero aun no esta conectado.
              </p>
            ) : (
              <p className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
                Para acciones y ETFs, Alpha Vantage usa ticker/simbolo como AAPL, MSFT, VOO o QQQ. No usa CoinGecko ID.
              </p>
            )}
            {form.asset_type === "crypto" && form.price_source === "coingecko" ? (
              <div className="space-y-2">
                <TextInput label="CoinGecko ID" placeholder="bitcoin, ethereum, solana..." value={form.coingecko_id} onChange={(value) => onChange({ ...form, coingecko_id: value })} />
                <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
                  <p className="font-medium text-slate-700">CoinGecko usa IDs, no simbolos. BTC no basta; debe ser bitcoin.</p>
                  <div className="mt-2 grid gap-1 sm:grid-cols-2">
                    {commonCoinGeckoIds.map(([symbol, id]) => (
                      <p key={symbol}>{symbol} = {id}</p>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
            {(form.asset_type === "stock" || form.asset_type === "etf") && form.price_source === "alpha_vantage" ? (
              <div className="space-y-2">
                <TextInput label="Simbolo Alpha Vantage" placeholder="AAPL, MSFT, VOO, QQQ..." value={form.provider_symbol} onChange={(value) => onChange({ ...form, provider_symbol: value })} />
                <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
                  <p className="font-medium text-slate-700">Alpha Vantage usa tickers/simbolos, no CoinGecko IDs.</p>
                  <p className="mt-1">Ejemplos comunes: {commonAlphaVantageSymbols.join(", ")}.</p>
                  <p className="mt-1">Si Alpha Vantage marca limite de consultas, espera un poco y vuelve a intentar.</p>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
        <TextInput label="Descripcion opcional" required={false} value={form.description} onChange={(value) => onChange({ ...form, description: value })} />
        <Checkbox label="Activo" checked={form.is_active} onChange={(checked) => onChange({ ...form, is_active: checked })} />
      </div>
      <FormButtons disabled={isSaving} editing={Boolean(editingId)} submitLabel={isSaving ? "Validando..." : editingId ? "Guardar activo" : "Crear activo"} onCancel={onCancel} />
    </form>
  );
}

function DuplicateAssetsNotice({
  groups,
}: {
  groups: Array<{
    key: string;
    symbol: string;
    assetType: InvestmentAssetType;
    currency: string;
    count: number;
  }>;
}) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-semibold">Hay activos duplicados que conviene revisar.</p>
      <p className="mt-1">
        Un activo debe existir una sola vez por simbolo, tipo y moneda. Para tenerlo en varias plataformas, usa holdings separados.
      </p>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {groups.map((group) => (
          <p className="rounded-md bg-white/70 px-3 py-2" key={group.key}>
            {group.symbol} - {assetTypeLabels[group.assetType]} - {group.currency}: {group.count} activos
          </p>
        ))}
      </div>
      <p className="mt-3 text-xs">
        Usa el SQL docs/FIX_DUPLICATED_ASSETS.sql para intentar limpiar duplicados de forma conservadora antes de crear la restriccion unica.
      </p>
    </div>
  );
}

function HoldingForm({ assets, platforms, form, editingId, onSubmit, onChange, onCancel }: {
  assets: InvestmentAsset[];
  platforms: InvestmentPlatform[];
  form: typeof emptyHoldingForm;
  editingId: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (form: typeof emptyHoldingForm) => void;
  onCancel: () => void;
}) {
  return (
    <form className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm" onSubmit={onSubmit}>
      <h2 className="text-lg font-semibold text-slate-950">{editingId ? "Editar holding" : "Nuevo holding"}</h2>
      <p className="mt-2 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
        Puedes tener el mismo activo en varias plataformas. Dentro de una misma plataforma, usa un solo holding por activo.
      </p>
      <div className="mt-4 grid gap-4">
        <PlatformSelect platforms={platforms} value={form.platform_id} onChange={(value) => onChange({ ...form, platform_id: value })} />
        <AssetSelect assets={assets} value={form.asset_id} onChange={(value) => onChange({ ...form, asset_id: value })} />
        {platforms.length === 0 || assets.length === 0 ? (
          <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
            Para crear un holding primero necesitas al menos una plataforma y un activo.
          </p>
        ) : null}
        <TextInput label="Cantidad" min="0" step="0.00000001" type="number" value={form.quantity} onChange={(value) => onChange({ ...form, quantity: value })} />
        <TextInput label="Precio promedio opcional" min="0" required={false} step="0.00000001" type="number" value={form.average_cost} onChange={(value) => onChange({ ...form, average_cost: value })} />
        <TextInput label="Notas opcionales" required={false} value={form.notes} onChange={(value) => onChange({ ...form, notes: value })} />
      </div>
      <FormButtons editing={Boolean(editingId)} submitLabel={editingId ? "Guardar holding" : "Crear holding"} onCancel={onCancel} />
    </form>
  );
}

function TransactionForm({ assets, platforms, form, editingId, onSubmit, onChange, onCancel }: {
  assets: InvestmentAsset[];
  platforms: InvestmentPlatform[];
  form: typeof emptyTransactionForm;
  editingId: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (form: typeof emptyTransactionForm) => void;
  onCancel: () => void;
}) {
  function updateAmountFromQuantity(nextQuantity: string) {
    const calculatedTotal = calculateTransactionTotal(nextQuantity, form.price);
    onChange({ ...form, quantity: nextQuantity, total_amount: calculatedTotal });
  }

  function updateAmountFromPrice(nextPrice: string) {
    const calculatedTotal = calculateTransactionTotal(form.quantity, nextPrice);
    onChange({ ...form, price: nextPrice, total_amount: calculatedTotal });
  }

  return (
    <form className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm" onSubmit={onSubmit}>
      <h2 className="text-lg font-semibold text-slate-950">{editingId ? "Editar transaccion" : "Nueva transaccion"}</h2>
      <div className="mt-4 grid gap-4">
        <PlatformSelect platforms={platforms} value={form.platform_id} onChange={(value) => onChange({ ...form, platform_id: value })} />
        <AssetSelect assets={assets} value={form.asset_id} onChange={(value) => onChange({ ...form, asset_id: value })} />
        {platforms.length === 0 || assets.length === 0 ? (
          <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
            Para registrar transacciones primero crea una plataforma y un activo.
          </p>
        ) : null}
        <TextInput label="Fecha" type="date" value={form.transaction_date} onChange={(value) => onChange({ ...form, transaction_date: value })} />
        <SelectInput label="Tipo" value={form.transaction_type} onChange={(value) => onChange({ ...form, transaction_type: value as InvestmentTransactionType })}>
          {Object.entries(transactionTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </SelectInput>
        <TextInput label="Cantidad" min="0" step="0.00000001" type="number" value={form.quantity} onChange={updateAmountFromQuantity} />
        <TextInput label="Precio unitario" min="0" step="0.00000001" type="number" value={form.price} onChange={updateAmountFromPrice} />
        <TextInput label="Monto total" min="0" step="0.00000001" type="number" value={form.total_amount} onChange={(value) => onChange({ ...form, total_amount: value })} />
        <p className="text-xs text-slate-500">El monto total se calcula como cantidad por precio unitario, pero puedes ajustarlo manualmente si lo necesitas.</p>
        <TextInput label="Comision opcional" min="0" step="0.01" type="number" value={form.fees} onChange={(value) => onChange({ ...form, fees: value })} />
        <TextInput label="Descripcion opcional" required={false} value={form.description} onChange={(value) => onChange({ ...form, description: value })} />
      </div>
      <FormButtons editing={Boolean(editingId)} submitLabel={editingId ? "Guardar transaccion" : "Registrar transaccion"} onCancel={onCancel} />
    </form>
  );
}

function HoldingsTable({ rows, onEdit, onDelete }: { rows: HoldingSummary[]; onEdit: (holding: Holding) => void; onDelete: (holding: Holding) => void }) {
  return (
    <TableCard title="Holdings">
      <table className="w-full min-w-[1120px] text-left text-sm">
        <thead><tr className="border-b border-slate-200 text-slate-500"><th className="py-2 pr-4 font-medium">Plataforma</th><th className="py-2 pr-4 font-medium">Activo</th><th className="py-2 pr-4 font-medium">Cantidad</th><th className="py-2 pr-4 font-medium">Precio promedio</th><th className="py-2 pr-4 font-medium">Precio actual</th><th className="py-2 pr-4 font-medium">Fuente</th><th className="py-2 pr-4 font-medium">Ultima actualizacion</th><th className="py-2 pr-4 font-medium">Error reciente</th><th className="py-2 pr-4 font-medium">Notas</th><th className="py-2 text-right font-medium">Valor estimado</th><th className="py-2 pl-4 text-right font-medium">Acciones</th></tr></thead>
        <tbody>
          {rows.map(({ holding, platform, asset, value }) => (
            <tr className="border-b border-slate-100" key={holding.id}>
              <td className="py-3 pr-4">{platform?.name ?? "Plataforma no encontrada"}</td>
              <td className="py-3 pr-4">{asset ? `${asset.symbol} - ${asset.name}` : "Activo no encontrado"}</td>
              <td className="py-3 pr-4">{Number(holding.quantity).toLocaleString("es-MX")}</td>
              <td className="py-3 pr-4">{holding.average_cost === null ? "Sin dato" : <MoneyAmount amount={Number(holding.average_cost)} currency={asset?.currency} />}</td>
              <td className="py-3 pr-4"><MoneyAmount amount={Number(asset?.current_price ?? 0)} currency={asset?.currency} /></td>
              <td className="py-3 pr-4">{getPriceSourceLabel(asset)}</td>
              <td className="py-3 pr-4">{asset?.last_price_updated_at ? formatDateTime(asset.last_price_updated_at) : "Sin actualizacion"}</td>
              <td className="py-3 pr-4"><PriceErrorText error={asset?.last_price_error} /></td>
              <td className="py-3 pr-4">{holding.notes || "Sin notas"}</td>
              <td className="py-3 text-right font-semibold"><MoneyAmount amount={value} currency={asset?.currency} /></td>
              <td className="py-3 pl-4"><ActionButtons onEdit={() => onEdit(holding)} onDelete={() => onDelete(holding)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <EmptyMessage text="Aun no hay holdings. Crea una plataforma, un activo y despues registra tu cantidad." /> : null}
    </TableCard>
  );
}

function AssetsTable({
  assets,
  isUpdatingPrices,
  updatingAssetId,
  onEdit,
  onDelete,
  onUpdate,
}: {
  assets: InvestmentAsset[];
  isUpdatingPrices: boolean;
  updatingAssetId: string | null;
  onEdit: (asset: InvestmentAsset) => void;
  onDelete: (asset: InvestmentAsset) => void;
  onUpdate: (asset: InvestmentAsset) => void;
}) {
  return (
    <TableCard title="Activos">
      <table className="w-full min-w-[1040px] text-left text-sm">
        <thead><tr className="border-b border-slate-200 text-slate-500"><th className="py-2 pr-4 font-medium">Simbolo</th><th className="py-2 pr-4 font-medium">Nombre</th><th className="py-2 pr-4 font-medium">Tipo</th><th className="py-2 pr-4 font-medium">Precio actual</th><th className="py-2 pr-4 font-medium">Fuente</th><th className="py-2 pr-4 font-medium">Ultima actualizacion</th><th className="py-2 pr-4 font-medium">Error reciente</th><th className="py-2 pr-4 font-medium">Estado</th><th className="py-2 pr-4 font-medium">Precio</th><th className="py-2 pl-4 text-right font-medium">Acciones</th></tr></thead>
        <tbody>
          {assets.map((asset) => (
            <tr className="border-b border-slate-100" key={asset.id}>
              <td className="py-3 pr-4 font-semibold">{asset.symbol}</td>
              <td className="py-3 pr-4">{asset.name}</td>
              <td className="py-3 pr-4">{assetTypeLabels[asset.asset_type]}</td>
              <td className="py-3 pr-4"><MoneyAmount amount={Number(asset.current_price)} currency={asset.currency} /></td>
              <td className="py-3 pr-4">{getPriceSourceLabel(asset)}</td>
              <td className="py-3 pr-4">{asset.last_price_updated_at ? formatDateTime(asset.last_price_updated_at) : "Sin actualizacion"}</td>
              <td className="py-3 pr-4"><PriceErrorText error={asset.last_price_error} /></td>
              <td className="py-3 pr-4">{asset.is_active ? "Activo" : "Inactivo"}</td>
              <td className="py-3 pr-4">
                {isAutomaticPriceAsset(asset) ? (
                  <button
                    className="rounded-md border border-blue-200 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    disabled={isUpdatingPrices || Boolean(updatingAssetId)}
                    onClick={() => onUpdate(asset)}
                    type="button"
                  >
                    {updatingAssetId === asset.id ? "Actualizando..." : "Actualizar"}
                  </button>
                ) : (
                  <span className="text-xs text-slate-500">Manual</span>
                )}
              </td>
              <td className="py-3 pl-4"><ActionButtons onEdit={() => onEdit(asset)} onDelete={() => onDelete(asset)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {assets.length === 0 ? <EmptyMessage text="Aun no hay activos. Registra uno como VOO, AAPL, BTC o efectivo de inversion." /> : null}
    </TableCard>
  );
}

function TransactionsTable({ assets, platforms, transactions, onEdit, onDelete }: {
  assets: InvestmentAsset[];
  platforms: InvestmentPlatform[];
  transactions: InvestmentTransaction[];
  onEdit: (transaction: InvestmentTransaction) => void;
  onDelete: (transaction: InvestmentTransaction) => void;
}) {
  return (
    <TableCard title="Transacciones recientes">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead><tr className="border-b border-slate-200 text-slate-500"><th className="py-2 pr-4 font-medium">Fecha</th><th className="py-2 pr-4 font-medium">Plataforma</th><th className="py-2 pr-4 font-medium">Activo</th><th className="py-2 pr-4 font-medium">Tipo</th><th className="py-2 pr-4 font-medium">Cantidad</th><th className="py-2 text-right font-medium">Total</th><th className="py-2 pl-4 text-right font-medium">Acciones</th></tr></thead>
        <tbody>
          {transactions.map((transaction) => {
            const asset = assets.find((item) => item.id === transaction.asset_id);
            return (
              <tr className="border-b border-slate-100" key={transaction.id}>
                <td className="py-3 pr-4">{formatDate(transaction.transaction_date)}</td>
                <td className="py-3 pr-4">{platforms.find((item) => item.id === transaction.platform_id)?.name ?? "Plataforma no encontrada"}</td>
                <td className="py-3 pr-4">{asset?.symbol ?? "Activo no encontrado"}</td>
                <td className="py-3 pr-4">{transactionTypeLabels[transaction.transaction_type]}</td>
                <td className="py-3 pr-4">{Number(transaction.quantity).toLocaleString("es-MX")}</td>
                <td className="py-3 text-right font-semibold"><MoneyAmount amount={Number(transaction.total_amount)} currency={asset?.currency} /></td>
                <td className="py-3 pl-4"><ActionButtons onEdit={() => onEdit(transaction)} onDelete={() => onDelete(transaction)} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {transactions.length === 0 ? <EmptyMessage text="Aun no hay transacciones registradas." /> : null}
    </TableCard>
  );
}

function buildHoldingSummary(holding: Holding, platforms: InvestmentPlatform[], assets: InvestmentAsset[]): HoldingSummary {
  const asset = assets.find((item) => item.id === holding.asset_id);
  return {
    holding,
    platform: platforms.find((item) => item.id === holding.platform_id),
    asset,
    value: Number(holding.quantity) * Number(asset?.current_price ?? 0),
  };
}

function buildValueByAssetType(rows: HoldingSummary[]) {
  const totals = new Map<string, { assetType: InvestmentAssetType; currency: string; amount: number }>();
  rows.forEach((row) => {
    if (!row.asset) return;
    const key = `${row.asset.asset_type}-${normalizeCurrency(row.asset.currency)}`;
    const current = totals.get(key) ?? { assetType: row.asset.asset_type, currency: normalizeCurrency(row.asset.currency), amount: 0 };
    current.amount += row.value;
    totals.set(key, current);
  });
  return Array.from(totals.values()).sort((a, b) => b.amount - a.amount);
}

function buildValueByPlatform(rows: HoldingSummary[]) {
  const totals = new Map<string, { platform: InvestmentPlatform; currency: string; amount: number }>();

  rows.forEach((row) => {
    if (!row.platform || !row.asset) return;
    const currency = normalizeCurrency(row.asset.currency);
    const key = `${row.platform.id}-${currency}`;
    const current = totals.get(key) ?? { platform: row.platform, currency, amount: 0 };
    current.amount += row.value;
    totals.set(key, current);
  });

  return Array.from(totals.values()).sort((a, b) => b.amount - a.amount);
}

function validatePlatform(form: typeof emptyPlatformForm) {
  if (!form.name.trim()) return "Escribe el nombre de la plataforma.";
  if (!form.platform_type) return "Selecciona el tipo de plataforma.";
  if (!form.currency) return "Selecciona la moneda principal de la plataforma.";
  if (!isSupportedCurrency(form.currency)) return "Selecciona una moneda valida.";
  return "";
}

function validateAsset(form: typeof emptyAssetForm, assets: InvestmentAsset[], editingAssetId: string | null) {
  if (!form.symbol.trim()) return "Escribe el simbolo del activo.";
  if (!form.name.trim()) return "Escribe el nombre del activo.";
  if (!form.asset_type) return "Selecciona el tipo de activo.";
  if (!form.currency) return "Selecciona la moneda del activo.";
  if (!isSupportedCurrency(form.currency)) return "Selecciona una moneda valida.";
  if (findDuplicateAssetForForm(form, assets, editingAssetId)) {
    return "Ya existe un activo con ese simbolo, tipo y moneda. Edita el activo existente o crea un holding nuevo para otra plataforma.";
  }
  if (!Number.isFinite(Number(form.current_price)) || Number(form.current_price) < 0) return "El precio actual manual no puede ser negativo.";
  if (form.asset_type === "crypto" && form.price_source === "coingecko" && !form.coingecko_id.trim()) {
    return "Escribe el CoinGecko ID. Ejemplos: bitcoin, ethereum, solana.";
  }
  if ((form.asset_type === "stock" || form.asset_type === "etf") && form.price_source === "alpha_vantage" && !getAlphaVantageSymbol(form)) {
    return "Escribe el simbolo para Alpha Vantage. Ejemplos: AAPL, MSFT, VOO o QQQ.";
  }
  return "";
}

function getAssetPriceProvider(form: typeof emptyAssetForm): InvestmentPriceSource {
  if (form.asset_type === "crypto" && form.price_source === "coingecko") return "coingecko";
  if ((form.asset_type === "stock" || form.asset_type === "etf") && form.price_source === "alpha_vantage") return "alpha_vantage";
  return "manual";
}

function getAlphaVantageSymbol(form: typeof emptyAssetForm) {
  return (form.provider_symbol.trim() || form.symbol.trim()).toUpperCase();
}

function getEditablePriceSource(asset: InvestmentAsset): InvestmentPriceSource {
  if (asset.asset_type === "crypto" && (asset.price_provider === "coingecko" || asset.price_source === "coingecko")) return "coingecko";
  if ((asset.asset_type === "stock" || asset.asset_type === "etf") && asset.price_provider === "alpha_vantage") return "alpha_vantage";
  return "manual";
}

function getDefaultPriceSourceForType(assetType: InvestmentAssetType, currentSource: InvestmentPriceSource): InvestmentPriceSource {
  if (assetType === "crypto") return currentSource === "coingecko" ? "coingecko" : "manual";
  if (assetType === "stock" || assetType === "etf") return currentSource === "alpha_vantage" ? "alpha_vantage" : "manual";
  return "manual";
}

function getPriceSourceOptionsForType(assetType: InvestmentAssetType): InvestmentPriceSource[] {
  if (assetType === "crypto") return ["manual", "coingecko"];
  if (assetType === "stock" || assetType === "etf") return ["manual", "alpha_vantage"];
  return ["manual"];
}

function validateHolding(form: typeof emptyHoldingForm, holdings: Holding[], editingHoldingId: string | null) {
  if (!form.platform_id) return "Selecciona una plataforma.";
  if (!form.asset_id) return "Selecciona un activo.";
  if (findDuplicateHoldingForForm(form, holdings, editingHoldingId)) {
    return "Ya existe un holding para esta plataforma y activo. Edita ese holding en lugar de crear otro duplicado.";
  }
  if (!Number.isFinite(Number(form.quantity)) || Number(form.quantity) < 0) return "La cantidad no puede ser negativa.";
  if (form.average_cost !== "" && (!Number.isFinite(Number(form.average_cost)) || Number(form.average_cost) < 0)) return "El precio promedio no puede ser negativo.";
  return "";
}

function findDuplicateAssetForForm(form: typeof emptyAssetForm, assets: InvestmentAsset[], editingAssetId: string | null) {
  const key = buildAssetUniqueKey({
    symbol: form.symbol,
    asset_type: form.asset_type,
    currency: form.currency,
  });

  return assets.find((asset) => asset.id !== editingAssetId && buildAssetUniqueKey(asset) === key);
}

function findDuplicateHoldingForForm(form: typeof emptyHoldingForm, holdings: Holding[], editingHoldingId: string | null) {
  return holdings.find(
    (holding) =>
      holding.id !== editingHoldingId &&
      holding.platform_id === form.platform_id &&
      holding.asset_id === form.asset_id
  );
}

function findDuplicateAssetGroups(assets: InvestmentAsset[]) {
  const groups = new Map<
    string,
    {
      key: string;
      symbol: string;
      assetType: InvestmentAssetType;
      currency: string;
      count: number;
    }
  >();

  assets.forEach((asset) => {
    const key = buildAssetUniqueKey(asset);
    const current = groups.get(key) ?? {
      key,
      symbol: normalizeAssetSymbol(asset.symbol),
      assetType: asset.asset_type,
      currency: normalizeCurrency(asset.currency),
      count: 0,
    };
    current.count += 1;
    groups.set(key, current);
  });

  return Array.from(groups.values()).filter((group) => group.count > 1);
}

function buildAssetUniqueKey(asset: Pick<InvestmentAsset, "symbol" | "asset_type" | "currency"> | { symbol: string; asset_type: InvestmentAssetType; currency: string }) {
  return `${normalizeAssetSymbol(asset.symbol)}|${asset.asset_type}|${normalizeCurrency(asset.currency)}`;
}

function normalizeAssetSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

function validateTransaction(form: typeof emptyTransactionForm) {
  if (!form.platform_id) return "Selecciona una plataforma.";
  if (!form.asset_id) return "Selecciona un activo.";
  if (!form.transaction_date) return "Selecciona la fecha de la transaccion.";
  if (!isValidDateInput(form.transaction_date)) return "La fecha de la transaccion no parece valida. Selecciona una fecha desde el calendario.";
  if (!form.transaction_type) return "Selecciona el tipo de transaccion.";
  if (!Number.isFinite(Number(form.quantity)) || Number(form.quantity) < 0) return "La cantidad no puede ser negativa.";
  if (!Number.isFinite(Number(form.price)) || Number(form.price) < 0) return "El precio unitario no puede ser negativo.";
  if (!Number.isFinite(Number(form.total_amount)) || Number(form.total_amount) < 0) return "El monto total no puede ser negativo.";
  if (!Number.isFinite(Number(form.fees || 0)) || Number(form.fees || 0) < 0) return "La comision no puede ser negativa.";
  return "";
}

function isValidDateInput(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);
  return dateValue.length === 10 && !Number.isNaN(date.getTime());
}

function calculateTransactionTotal(quantity: string, price: string) {
  const quantityNumber = Number(quantity);
  const priceNumber = Number(price);
  if (!Number.isFinite(quantityNumber) || !Number.isFinite(priceNumber)) return "0";
  return String(Number((quantityNumber * priceNumber).toFixed(8)));
}

function getFriendlyInvestmentError(error: string) {
  if (error.includes("assets_user_symbol_type_currency_unique_idx")) {
    return "Ya existe un activo con ese simbolo, tipo y moneda. Edita el activo existente o crea un holding nuevo para otra plataforma.";
  }
  if (error.includes("holdings_user_id_platform_id_asset_id_key")) {
    return "Ya existe un holding para esta plataforma y activo. Edita ese holding en lugar de crear otro duplicado.";
  }
  if (error.includes("price_source") || error.includes("coingecko_id") || error.includes("last_price_updated_at")) {
    return "Falta actualizar Supabase para precios cripto. Ejecuta el SQL docs/ADD_CRYPTO_PRICE_SUPPORT.sql.";
  }
  if (error.includes("schema cache") || error.includes("platform_type") || error.includes("asset_type") || error.includes("total_amount")) {
    return "Falta actualizar Supabase para inversiones. Ejecuta el SQL docs/ADD_INVESTMENTS.sql y despues docs/ADD_CRYPTO_PRICE_SUPPORT.sql.";
  }
  if (error.includes("duplicate") || error.includes("unique")) return "Ya existe un registro parecido. Revisa plataforma y activo.";
  if (error.includes("foreign key") || error.includes("violates")) {
    return "No pude borrar este registro porque todavia tiene informacion relacionada. Revisa holdings o transacciones vinculadas.";
  }
  return `No se pudo completar la accion. Detalle: ${error}`;
}

function formatDate(dateValue: string) {
  return new Date(`${dateValue}T00:00:00`).toLocaleDateString("es-MX");
}

function formatDateTime(dateValue: string) {
  return new Date(dateValue).toLocaleString("es-MX");
}

function getPriceSourceLabel(asset: InvestmentAsset | undefined) {
  if (!asset) return "Sin dato";
  if (asset.asset_type === "crypto" && (asset.price_provider === "coingecko" || asset.price_source === "coingecko")) return "CoinGecko";
  if ((asset.asset_type === "stock" || asset.asset_type === "etf") && asset.price_provider === "alpha_vantage") return "Alpha Vantage";
  return "Manual";
}

function isAutomaticPriceAsset(asset: InvestmentAsset) {
  if (asset.asset_type === "crypto") return asset.price_provider === "coingecko" || asset.price_source === "coingecko";
  if (asset.asset_type === "stock" || asset.asset_type === "etf") return asset.price_provider === "alpha_vantage";
  return false;
}

function PriceErrorText({ error }: { error: string | null | undefined }) {
  if (!error) return <span className="text-slate-500">Sin error</span>;

  return (
    <span className="inline-flex max-w-[320px] rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
      {error}
    </span>
  );
}

function PlatformSelect({ platforms, value, onChange }: { platforms: InvestmentPlatform[]; value: string; onChange: (value: string) => void }) {
  return (
    <SelectInput label="Plataforma" value={value} onChange={onChange}>
      <option value="">Selecciona una plataforma</option>
      {platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.name} - {platform.currency}</option>)}
    </SelectInput>
  );
}

function AssetSelect({ assets, value, onChange }: { assets: InvestmentAsset[]; value: string; onChange: (value: string) => void }) {
  return (
    <SelectInput label="Activo" value={value} onChange={onChange}>
      <option value="">Selecciona un activo</option>
      {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.symbol} - {asset.name}</option>)}
    </SelectInput>
  );
}

function CurrencySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <SelectInput label="Moneda" value={value} onChange={onChange}>
      {SUPPORTED_CURRENCIES.map((currency) => <option key={currency.code} value={currency.code}>{currency.label}</option>)}
    </SelectInput>
  );
}

function TextInput({ label, value, onChange, type = "text", min, step, required = true, placeholder }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  min?: string;
  step?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" min={min} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} step={step} type={type} value={value} />
    </label>
  );
}

function SelectInput({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" onChange={(event) => onChange(event.target.value)} required value={value}>
        {children}
      </select>
    </label>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      {label}
    </label>
  );
}

function FormButtons({ disabled = false, editing, submitLabel, onCancel }: { disabled?: boolean; editing: boolean; submitLabel: string; onCancel: () => void }) {
  return (
    <>
      <button className="mt-5 w-full rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-300" disabled={disabled} type="submit">{submitLabel}</button>
      {editing ? <button className="mt-2 w-full rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700" disabled={disabled} onClick={onCancel} type="button">Cancelar edicion</button> : null}
    </>
  );
}

function ActionButtons({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex justify-end gap-2">
      <button className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700" onClick={onEdit} type="button">Editar</button>
      <button className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700" onClick={onDelete} type="button">Borrar</button>
    </div>
  );
}

function MoneyTotals({ totals }: { totals: Array<{ currency: string; amount: number }> }) {
  if (totals.length === 0) return <MoneyAmount amount={0} currency={DEFAULT_CURRENCY} />;
  return <span className="space-y-1">{totals.map((total) => <span className="block" key={total.currency}><MoneyAmount amount={total.amount} currency={total.currency} /></span>)}</span>;
}

function SummaryCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function SimpleList({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-950">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

function ListRow({ title, detail, value, onEdit, onDelete }: { title: string; detail: string; value: React.ReactNode; onEdit?: () => void; onDelete?: () => void }) {
  return (
    <div className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-slate-950">{title}</p>
          <p className="text-sm text-slate-500">{detail}</p>
        </div>
        <p className="text-right text-sm font-semibold text-slate-900">{value}</p>
      </div>
      {onEdit && onDelete ? <div className="mt-2"><ActionButtons onEdit={onEdit} onDelete={onDelete} /></div> : null}
    </div>
  );
}

function TableCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <div className="mt-4 max-w-full overflow-x-auto">{children}</div>
    </div>
  );
}

function EmptyMessage({ text }: { text: string }) {
  return <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-600">{text}</p>;
}

function StatusMessage({ message }: { message: Message }) {
  const styles = {
    success: "border-green-200 bg-green-50 text-green-800",
    error: "border-red-200 bg-red-50 text-red-800",
    info: "border-slate-200 bg-slate-50 text-slate-700",
  };
  return <p className={`rounded-md border px-3 py-2 text-sm ${styles[message.type]}`}>{message.text}</p>;
}

function StatusPanel({ text }: { text: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">{text}</div>;
}
