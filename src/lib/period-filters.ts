import { getCurrentCardPeriod } from "@/lib/periods";
import type { CreditCard } from "@/types/finance";

export type PeriodFilterMode = "card_current" | "current_month" | "previous_month" | "custom";

export type PeriodFilterState = {
  mode: PeriodFilterMode;
  startDate: string;
  endDate: string;
};

export function getDefaultPeriodFilter(): PeriodFilterState {
  const currentMonth = getMonthRange(0);

  return {
    mode: "card_current",
    startDate: toDateInputValue(currentMonth.start),
    endDate: toDateInputValue(currentMonth.end),
  };
}

export function getMonthRange(monthOffset: number) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const end = new Date(today.getFullYear(), today.getMonth() + monthOffset + 1, 0);

  return { start, end };
}

export function getRangeForCard(filter: PeriodFilterState, card: CreditCard) {
  if (filter.mode === "card_current") {
    return getCurrentCardPeriod(card.statement_cut_day);
  }

  return getRangeForFilter(filter);
}

export function getRangeForFilter(filter: PeriodFilterState) {
  if (filter.mode === "previous_month") {
    return getMonthRange(-1);
  }

  if (filter.mode === "custom") {
    return {
      start: parseDateInput(filter.startDate),
      end: parseDateInput(filter.endDate),
    };
  }

  return getMonthRange(0);
}

export function isDateInRange(dateValue: string, start: Date, end: Date) {
  const date = new Date(`${dateValue}T00:00:00`);
  return date >= start && date <= end;
}

export function isDateInSelectedPeriod({
  dateValue,
  cardId,
  cards,
  filter,
}: {
  dateValue: string;
  cardId: string | null;
  cards: CreditCard[];
  filter: PeriodFilterState;
}) {
  if (filter.mode === "card_current") {
    const card = cards.find((item) => item.id === cardId);
    if (!card) return false;

    const range = getCurrentCardPeriod(card.statement_cut_day);
    return isDateInRange(dateValue, range.start, range.end);
  }

  const range = getRangeForFilter(filter);
  return isDateInRange(dateValue, range.start, range.end);
}

export function getPeriodLabel(filter: PeriodFilterState) {
  if (filter.mode === "card_current") return "Periodo actual de cada tarjeta";
  if (filter.mode === "current_month") return "Mes actual";
  if (filter.mode === "previous_month") return "Mes anterior";

  return `${formatDisplayDate(parseDateInput(filter.startDate))} a ${formatDisplayDate(parseDateInput(filter.endDate))}`;
}

export function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string) {
  return new Date(`${value}T00:00:00`);
}

function formatDisplayDate(date: Date) {
  return date.toLocaleDateString("es-MX");
}
