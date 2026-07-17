import { findCategoryName, isSameCategoryName, normalizeCategoryName } from "@/lib/categories";
import { formatCurrency, normalizeCurrency } from "@/lib/currencies";
import { getCurrentCardPeriod } from "@/lib/periods";
import type {
  Account,
  AccountMovement,
  Budget,
  Category,
  CreditCard,
  Expense,
  InvestmentAsset,
  Payment,
  UserAlertPreference,
} from "@/types/finance";

export type FinancialAlertSeverity = "info" | "warning" | "critical";
export type FinancialAlertType = "card_payment" | "budget_limit" | "account_low_balance" | "investment_price";
export type FinancialAlertSource = "card" | "budget" | "account" | "investment";

export type CalculatedFinancialAlert = {
  id: string;
  type: FinancialAlertType;
  severity: FinancialAlertSeverity;
  title: string;
  description: string;
  amount?: number;
  currency?: string;
  href?: string;
  source: FinancialAlertSource;
  metadata?: {
    daysUntil?: number;
    percent?: number;
    status?: string;
  };
};

export type AlertPreferenceValues = Pick<
  UserAlertPreference,
  | "card_payment_warning_days"
  | "budget_warning_percent"
  | "investment_stale_price_days"
  | "low_balance_alert_enabled"
  | "investment_price_alerts_enabled"
>;

export const DEFAULT_ALERT_PREFERENCES: AlertPreferenceValues = {
  card_payment_warning_days: 7,
  budget_warning_percent: 80,
  investment_stale_price_days: 7,
  low_balance_alert_enabled: true,
  investment_price_alerts_enabled: true,
};

type BuildFinancialAlertsInput = {
  cards: CreditCard[];
  expenses: Expense[];
  payments: Payment[];
  categories: Category[];
  accounts: Account[];
  accountMovements: AccountMovement[];
  budgets: Budget[];
  assets: InvestmentAsset[];
  preferences?: Partial<AlertPreferenceValues> | null;
  today?: Date;
};

const MS_PER_DAY = 86400000;

export const financialAlertSeverityLabels: Record<FinancialAlertSeverity, string> = {
  critical: "Critica",
  warning: "Advertencia",
  info: "Informativa",
};

export const financialAlertTypeLabels: Record<FinancialAlertType, string> = {
  card_payment: "Tarjetas",
  budget_limit: "Presupuestos",
  account_low_balance: "Cuentas",
  investment_price: "Inversiones",
};

export function normalizeAlertPreferences(preferences?: Partial<AlertPreferenceValues> | null): AlertPreferenceValues {
  return {
    card_payment_warning_days: clampInteger(
      preferences?.card_payment_warning_days,
      1,
      30,
      DEFAULT_ALERT_PREFERENCES.card_payment_warning_days
    ),
    budget_warning_percent: clampInteger(
      preferences?.budget_warning_percent,
      50,
      100,
      DEFAULT_ALERT_PREFERENCES.budget_warning_percent
    ),
    investment_stale_price_days: clampInteger(
      preferences?.investment_stale_price_days,
      1,
      30,
      DEFAULT_ALERT_PREFERENCES.investment_stale_price_days
    ),
    low_balance_alert_enabled:
      typeof preferences?.low_balance_alert_enabled === "boolean"
        ? preferences.low_balance_alert_enabled
        : DEFAULT_ALERT_PREFERENCES.low_balance_alert_enabled,
    investment_price_alerts_enabled:
      typeof preferences?.investment_price_alerts_enabled === "boolean"
        ? preferences.investment_price_alerts_enabled
        : DEFAULT_ALERT_PREFERENCES.investment_price_alerts_enabled,
  };
}

export function isMissingAlertPreferencesTableError(error: string | null | undefined) {
  const message = error ?? "";
  return message.includes("user_alert_preferences") || message.includes("schema cache") || message.includes("42P01");
}

export function buildFinancialAlerts({
  accounts,
  accountMovements,
  assets,
  budgets,
  cards,
  categories,
  expenses,
  payments,
  preferences,
  today = new Date(),
}: BuildFinancialAlertsInput): CalculatedFinancialAlert[] {
  const safePreferences = normalizeAlertPreferences(preferences);
  const alerts: CalculatedFinancialAlert[] = [];
  const currentDay = startOfDay(today);

  cards
    .filter((card) => card.is_active)
    .map((card) => buildCardPaymentAlert(card, expenses, payments, safePreferences, currentDay))
    .filter((alert): alert is CalculatedFinancialAlert => Boolean(alert))
    .forEach((alert) => alerts.push(alert));

  budgets
    .filter((budget) => budget.is_active && budget.month.slice(0, 7) === getMonthKey(currentDay))
    .map((budget) => buildBudgetAlert(budget, categories, cards, expenses, safePreferences))
    .filter((alert): alert is CalculatedFinancialAlert => Boolean(alert))
    .forEach((alert) => alerts.push(alert));

  if (safePreferences.low_balance_alert_enabled) {
    accounts
      .filter((account) => account.is_active)
      .map((account) => buildAccountLowBalanceAlert(account, accountMovements))
      .filter((alert): alert is CalculatedFinancialAlert => Boolean(alert))
      .forEach((alert) => alerts.push(alert));
  }

  if (safePreferences.investment_price_alerts_enabled) {
    assets
      .filter((asset) => asset.is_active && asset.price_provider !== "manual")
      .map((asset) => buildInvestmentPriceAlert(asset, safePreferences, currentDay))
      .filter((alert): alert is CalculatedFinancialAlert => Boolean(alert))
      .forEach((alert) => alerts.push(alert));
  }

  return sortFinancialAlerts(alerts);
}

function buildCardPaymentAlert(
  card: CreditCard,
  expenses: Expense[],
  payments: Payment[],
  preferences: AlertPreferenceValues,
  today: Date
): CalculatedFinancialAlert | null {
  const currentPeriod = getCurrentCardPeriod(card.statement_cut_day, today);
  const spent = sumExpensesForCardPeriod(expenses, card.id, currentPeriod.start, currentPeriod.end);
  const paid = sumPaymentsForCardPeriod(payments, card.id, currentPeriod.start, currentPeriod.end);
  const pending = Math.max(spent - paid, 0);
  const daysToPayment = getDaysUntilDay(card.payment_due_day, today);

  if (pending <= 0 || daysToPayment < 0 || daysToPayment > preferences.card_payment_warning_days) {
    return null;
  }

  const dueText =
    daysToPayment === 0
      ? `Pago de ${card.name} vence hoy`
      : `Pago de ${card.name} vence en ${daysToPayment} dia(s)`;

  return {
    id: `card-payment-${card.id}`,
    type: "card_payment",
    severity: daysToPayment <= 2 ? "critical" : "warning",
    title: daysToPayment === 0 ? "Pago de tarjeta vence hoy" : "Pago de tarjeta proximo",
    description: `${dueText}. Saldo pendiente estimado: ${formatCurrency(pending, card.currency)}.`,
    amount: pending,
    currency: card.currency,
    href: "/tarjetas",
    source: "card",
    metadata: { daysUntil: daysToPayment },
  } satisfies CalculatedFinancialAlert;
}

function buildBudgetAlert(
  budget: Budget,
  categories: Category[],
  cards: CreditCard[],
  expenses: Expense[],
  preferences: AlertPreferenceValues
): CalculatedFinancialAlert | null {
  const limit = Number(budget.amount);
  if (limit <= 0) return null;

  const spent = calculateBudgetSpent(budget, categories, cards, expenses);
  const percent = (spent / limit) * 100;

  if (percent < preferences.budget_warning_percent) {
    return null;
  }

  const isExceeded = percent >= 100;

  return {
    id: `budget-${budget.id}`,
    type: "budget_limit",
    severity: isExceeded ? "critical" : "warning",
    title: isExceeded ? "Presupuesto excedido" : "Presupuesto cerca del limite",
    description: `${budget.name} lleva ${percent.toFixed(0)}% usado este mes.`,
    amount: spent,
    currency: budget.currency,
    href: "/presupuestos",
    source: "budget",
    metadata: { percent },
  } satisfies CalculatedFinancialAlert;
}

function buildAccountLowBalanceAlert(account: Account, movements: AccountMovement[]): CalculatedFinancialAlert | null {
  const balance = calculateAccountBalance(account, movements);

  if (balance > 0) return null;

  return {
    id: `account-${account.id}`,
    type: "account_low_balance",
    severity: "warning",
    title: "Cuenta con saldo bajo",
    description: `${account.name} tiene saldo estimado ${formatCurrency(balance, account.currency)}.`,
    amount: balance,
    currency: account.currency,
    href: "/cuentas",
    source: "account",
  } satisfies CalculatedFinancialAlert;
}

function buildInvestmentPriceAlert(
  asset: InvestmentAsset,
  preferences: AlertPreferenceValues,
  today: Date
): CalculatedFinancialAlert | null {
  if (asset.last_price_error) {
    return {
      id: `asset-error-${asset.id}`,
      type: "investment_price",
      severity: "critical",
      title: "Precio de activo con error",
      description: `${asset.symbol} usa precio automatico y tiene un error reciente: ${asset.last_price_error}.`,
      href: "/inversiones",
      source: "investment",
      metadata: { status: "error" },
    } satisfies CalculatedFinancialAlert;
  }

  if (!asset.last_price_updated_at) {
    return {
      id: `asset-missing-${asset.id}`,
      type: "investment_price",
      severity: "info",
      title: "Precio de activo pendiente",
      description: `${asset.symbol} usa precio automatico y aun no tiene fecha de actualizacion.`,
      href: "/inversiones",
      source: "investment",
      metadata: { status: "missing" },
    } satisfies CalculatedFinancialAlert;
  }

  const updatedAt = startOfDay(new Date(asset.last_price_updated_at));
  const ageInDays = getDayDifference(updatedAt, today);

  if (ageInDays <= preferences.investment_stale_price_days) {
    return null;
  }

  return {
    id: `asset-old-${asset.id}`,
    type: "investment_price",
    severity: "warning",
    title: "Precio de activo antiguo",
    description: `${asset.symbol} no se actualiza desde hace ${ageInDays} dia(s).`,
    href: "/inversiones",
    source: "investment",
    metadata: { daysUntil: ageInDays, status: "old" },
  } satisfies CalculatedFinancialAlert;
}

function calculateBudgetSpent(budget: Budget, categories: Category[], cards: CreditCard[], expenses: Expense[]) {
  const start = new Date(`${budget.month.slice(0, 7)}-01T00:00:00`);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const currency = normalizeCurrency(budget.currency);
  const budgetCategoryName = normalizeCategoryName(findCategoryName(categories, budget.category_id));

  return expenses
    .filter((expense) => {
      const card = cards.find((item) => item.id === expense.credit_card_id);
      const expenseDate = new Date(`${expense.expense_date}T00:00:00`);

      return (
        (expense.category_id === budget.category_id ||
          isSameCategoryName(categories, expense.category_id, budget.category_id) ||
          Boolean(budgetCategoryName && normalizeCategoryName(findCategoryName(categories, expense.category_id)) === budgetCategoryName)) &&
        normalizeCurrency(card?.currency) === currency &&
        expenseDate >= start &&
        expenseDate < end
      );
    })
    .reduce((total, expense) => total + Number(expense.amount), 0);
}

function calculateAccountBalance(account: Account, movements: AccountMovement[]) {
  return movements
    .filter((movement) => movement.account_id === account.id)
    .reduce((balance, movement) => {
      if (movement.movement_type === "income") return balance + Number(movement.amount);
      if (movement.movement_type === "expense") return balance - Number(movement.amount);
      if (movement.movement_type === "adjustment") return balance + Number(movement.amount);
      return balance;
    }, Number(account.initial_balance));
}

function sumExpensesForCardPeriod(expenses: Expense[], cardId: string, start: Date, end: Date) {
  return expenses
    .filter((expense) => {
      const expenseDate = new Date(`${expense.expense_date}T00:00:00`);
      return expense.credit_card_id === cardId && expenseDate >= start && expenseDate <= end;
    })
    .reduce((total, expense) => total + Number(expense.amount), 0);
}

function sumPaymentsForCardPeriod(payments: Payment[], cardId: string, start: Date, end: Date) {
  return payments
    .filter((payment) => {
      const paymentDate = new Date(`${payment.payment_date}T00:00:00`);
      return payment.credit_card_id === cardId && paymentDate >= start && paymentDate <= end;
    })
    .reduce((total, payment) => total + Number(payment.amount), 0);
}

function getDaysUntilDay(day: number, fromDate = new Date()) {
  const today = startOfDay(fromDate);
  const target = getNextDateForDay(day, today);

  return getDayDifference(today, target);
}

function getNextDateForDay(day: number, fromDate = new Date()) {
  const today = startOfDay(fromDate);
  const currentMonthTarget = dateWithSafeDay(today.getFullYear(), today.getMonth(), day);

  // Crear la fecha desde year/month/day evita saltos raros en meses cortos o al cruzar diciembre/enero.
  return currentMonthTarget >= today
    ? currentMonthTarget
    : dateWithSafeDay(today.getFullYear(), today.getMonth() + 1, day);
}

function dateWithSafeDay(year: number, month: number, day: number) {
  return new Date(year, month, Math.min(day, daysInMonth(year, month)));
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDayDifference(start: Date, end: Date) {
  return Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / MS_PER_DAY);
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function sortFinancialAlerts(alerts: CalculatedFinancialAlert[]) {
  const severityRank: Record<FinancialAlertSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  return [...alerts].sort((a, b) => {
    const severityDifference = severityRank[a.severity] - severityRank[b.severity];
    if (severityDifference !== 0) return severityDifference;

    const aDays = a.metadata?.daysUntil ?? Number.MAX_SAFE_INTEGER;
    const bDays = b.metadata?.daysUntil ?? Number.MAX_SAFE_INTEGER;
    if (aDays !== bDays) return aDays - bDays;

    return a.title.localeCompare(b.title);
  });
}

function clampInteger(value: number | null | undefined, min: number, max: number, fallback: number) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return fallback;

  return Math.min(Math.max(Math.round(numericValue), min), max);
}
