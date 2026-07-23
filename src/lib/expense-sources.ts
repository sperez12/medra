import { DEFAULT_CURRENCY, normalizeCurrency } from "@/lib/currencies";
import {
  getRangeForFilter,
  isDateInRange,
  isDateInSelectedPeriod,
  type PeriodFilterState,
} from "@/lib/period-filters";
import type { Account, CreditCard, Expense } from "@/types/finance";

export type ExpenseSourceInfo = {
  type: "card" | "account" | "unknown";
  label: string;
  detail: string;
  badgeLabel: string;
  currency: string;
};

export function getExpenseSourceInfo(
  expense: Expense,
  cards: CreditCard[],
  accounts: Account[]
): ExpenseSourceInfo {
  if (expense.credit_card_id) {
    const card = cards.find((item) => item.id === expense.credit_card_id);

    return {
      type: "card",
      label: card?.name ?? "Tarjeta no encontrada",
      detail: card ? `${card.bank} - **** ${card.last_four_digits}` : "Sin tarjeta",
      badgeLabel: "Tarjeta",
      currency: normalizeCurrency(card?.currency ?? DEFAULT_CURRENCY),
    };
  }

  if (expense.account_id) {
    const account = accounts.find((item) => item.id === expense.account_id);
    const isCash = account?.account_type === "cash";

    return {
      type: "account",
      label: account?.name ?? "Cuenta no encontrada",
      detail: account?.institution ?? (isCash ? "Efectivo" : "Cuenta"),
      badgeLabel: isCash ? "Efectivo" : "Cuenta",
      currency: normalizeCurrency(account?.currency ?? DEFAULT_CURRENCY),
    };
  }

  return {
    type: "unknown",
    label: "Origen no encontrado",
    detail: "Sin fuente de pago",
    badgeLabel: "Sin origen",
    currency: DEFAULT_CURRENCY,
  };
}

export function getExpenseCurrency(expense: Expense, cards: CreditCard[], accounts: Account[]) {
  return getExpenseSourceInfo(expense, cards, accounts).currency;
}

export function isExpenseInSelectedPeriod({
  expense,
  cards,
  filter,
}: {
  expense: Expense;
  cards: CreditCard[];
  filter: PeriodFilterState;
}) {
  if (expense.credit_card_id) {
    return isDateInSelectedPeriod({
      dateValue: expense.expense_date,
      cardId: expense.credit_card_id,
      cards,
      filter,
    });
  }

  const range = getRangeForFilter(filter);
  return isDateInRange(expense.expense_date, range.start, range.end);
}
