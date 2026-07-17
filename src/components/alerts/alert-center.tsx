"use client";

import { useEffect, useMemo, useState } from "react";
import { FinancialAlertCard } from "@/components/alerts/financial-alert-card";
import {
  buildFinancialAlerts,
  financialAlertSeverityFilterLabels,
  financialAlertTypeLabels,
  type CalculatedFinancialAlert,
  type FinancialAlertSeverity,
  type FinancialAlertType,
} from "@/lib/financial-alerts";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserAlertPreferences } from "@/lib/use-user-alert-preferences";
import type {
  Account,
  AccountMovement,
  Budget,
  Category,
  CreditCard,
  Expense,
  InvestmentAsset,
  Payment,
} from "@/types/finance";

type Message = {
  type: "error" | "info";
  text: string;
};

type AlertData = {
  cards: CreditCard[];
  expenses: Expense[];
  payments: Payment[];
  categories: Category[];
  accounts: Account[];
  accountMovements: AccountMovement[];
  budgets: Budget[];
  assets: InvestmentAsset[];
};

type SeverityFilter = "all" | FinancialAlertSeverity;
type TypeFilter = "all" | FinancialAlertType;

const emptyAlertData: AlertData = {
  cards: [],
  expenses: [],
  payments: [],
  categories: [],
  accounts: [],
  accountMovements: [],
  budgets: [],
  assets: [],
};

export function AlertCenter() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { alertPreferences, needsMigration } = useUserAlertPreferences();
  const [data, setData] = useState<AlertData>(emptyAlertData);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [message, setMessage] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAlertData();
  }, []);

  async function loadAlertData() {
    if (!supabase) {
      setMessage({ type: "error", text: "Falta configurar Supabase para cargar el centro de alertas." });
      setIsLoading(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "info", text: "Inicia sesión para ver tus alertas financieras." });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const [
      { data: cardData, error: cardError },
      { data: expenseData, error: expenseError },
      { data: paymentData, error: paymentError },
      { data: categoryData, error: categoryError },
      { data: accountData, error: accountError },
      { data: movementData, error: movementError },
      { data: budgetData, error: budgetError },
      { data: assetData, error: assetError },
    ] = await Promise.all([
      supabase
        .from("credit_cards")
        .select("*")
        .eq("user_id", userData.user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase.from("expenses").select("*").eq("user_id", userData.user.id).order("expense_date", { ascending: false }),
      supabase.from("payments").select("*").eq("user_id", userData.user.id).order("payment_date", { ascending: false }),
      supabase.from("categories").select("*").eq("user_id", userData.user.id),
      supabase
        .from("accounts")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("account_movements")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("movement_date", { ascending: false }),
      supabase
        .from("budgets")
        .select("*")
        .eq("user_id", userData.user.id)
        .eq("is_active", true)
        .order("month", { ascending: false }),
      supabase.from("assets").select("*").eq("user_id", userData.user.id).order("symbol"),
    ]);

    if (cardError || expenseError || paymentError || categoryError || accountError || movementError || budgetError || assetError) {
      setMessage({
        type: "error",
        text:
          cardError?.message ??
          expenseError?.message ??
          paymentError?.message ??
          categoryError?.message ??
          accountError?.message ??
          movementError?.message ??
          budgetError?.message ??
          assetError?.message ??
          "No se pudo cargar el centro de alertas.",
      });
      setIsLoading(false);
      return;
    }

    setData({
      cards: (cardData ?? []) as CreditCard[],
      expenses: (expenseData ?? []) as Expense[],
      payments: (paymentData ?? []) as Payment[],
      categories: (categoryData ?? []) as Category[],
      accounts: (accountData ?? []) as Account[],
      accountMovements: (movementData ?? []) as AccountMovement[],
      budgets: (budgetData ?? []) as Budget[],
      assets: (assetData ?? []) as InvestmentAsset[],
    });
    setMessage(null);
    setIsLoading(false);
  }

  const alerts = buildFinancialAlerts({
    accountMovements: data.accountMovements,
    accounts: data.accounts,
    assets: data.assets,
    budgets: data.budgets,
    cards: data.cards,
    categories: data.categories,
    expenses: data.expenses,
    payments: data.payments,
    preferences: alertPreferences,
  });

  const filteredAlerts = alerts.filter((alert) => {
    const matchesSeverity = severityFilter === "all" || alert.severity === severityFilter;
    const matchesType = typeFilter === "all" || alert.type === typeFilter;

    return matchesSeverity && matchesType;
  });

  const severityCounts = getSeverityCounts(alerts);

  if (isLoading) {
    return <StatusPanel text="Cargando centro de alertas..." />;
  }

  if (message) {
    return <StatusPanel text={message.text} tone={message.type} />;
  }

  return (
    <div className="max-w-full space-y-6 overflow-x-hidden">
      <section className="pp-card p-5 sm:p-6">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="pp-badge w-fit">Centro de alertas</p>
          <h1 className="pp-display text-4xl text-finance-ink">Atención financiera</h1>
          <p className="max-w-3xl text-sm leading-6 text-finance-muted">
            Alertas calculadas con tus datos actuales. No se guardan como historial, no se envían por correo y no crean
            notificaciones push.
          </p>
        </div>

        {needsMigration ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Estas alertas usan valores por defecto. Para guardar preferencias personalizadas, ejecuta la migración
            pendiente en Supabase.
          </p>
        ) : null}
      </section>

      <section className="grid min-w-0 gap-4 md:grid-cols-3">
        <SeveritySummary
          description="Requieren atención inmediata o ya están fuera de rango."
          label="Críticas"
          value={severityCounts.critical}
          tone="critical"
        />
        <SeveritySummary
          description="Conviene revisarlas pronto."
          label="Advertencias"
          value={severityCounts.warning}
          tone="warning"
        />
        <SeveritySummary
          description="Datos o recordatorios de baja urgencia."
          label="Informativas"
          value={severityCounts.info}
          tone="info"
        />
      </section>

      <section className="pp-card p-5 sm:p-6">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-finance-ink">Alertas activas</h2>
            <p className="text-sm text-finance-muted">
              Puedes filtrar sin cambiar los datos guardados ni las reglas financieras base.
            </p>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-finance-muted">Severidad</span>
              <select
                className="pp-input mt-1"
                onChange={(event) => setSeverityFilter(event.target.value as SeverityFilter)}
                value={severityFilter}
              >
                <option value="all">Todas</option>
                {Object.entries(financialAlertSeverityFilterLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block min-w-0">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-finance-muted">Tipo</span>
              <select
                className="pp-input mt-1"
                onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
                value={typeFilter}
              >
                <option value="all">Todos</option>
                {Object.entries(financialAlertTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {alerts.length === 0 ? (
          <p className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
            No hay alertas importantes por ahora.
          </p>
        ) : filteredAlerts.length === 0 ? (
          <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            No hay alertas con esos filtros. Prueba ver todas las severidades o todos los tipos.
          </p>
        ) : (
          <div className="mt-4 grid min-w-0 gap-3 xl:grid-cols-2">
            {filteredAlerts.map((alert) => (
              <FinancialAlertCard alert={alert} key={alert.id} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatusPanel({ text, tone = "info" }: { text: string; tone?: "error" | "info" }) {
  return (
    <div
      className={`rounded-lg border p-6 shadow-sm ${
        tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-slate-200 bg-white text-slate-600"
      }`}
    >
      {text}
    </div>
  );
}

function SeveritySummary({
  description,
  label,
  tone,
  value,
}: {
  description: string;
  label: string;
  tone: FinancialAlertSeverity;
  value: number;
}) {
  const toneClasses = {
    critical: "border-red-200 bg-red-50 text-red-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    info: "border-blue-200 bg-blue-50 text-blue-800",
  };

  return (
    <article className={`min-w-0 rounded-2xl border p-5 shadow-sm ${toneClasses[tone]}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
      <p className="mt-2 text-sm leading-5 opacity-80">{description}</p>
    </article>
  );
}

function getSeverityCounts(alerts: CalculatedFinancialAlert[]) {
  return alerts.reduce(
    (counts, alert) => ({
      ...counts,
      [alert.severity]: counts[alert.severity] + 1,
    }),
    { critical: 0, warning: 0, info: 0 }
  );
}
