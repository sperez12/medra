import { getDefaultPeriodFilter, type PeriodFilterState } from "@/lib/period-filters";
import type { UserDashboardPeriodPreference } from "@/types/finance";

export const DEFAULT_DASHBOARD_PERIOD: UserDashboardPeriodPreference = "current_period";
export const DEFAULT_DATE_FORMAT = "DD/MM/YYYY";

export const dashboardPeriodOptions: Array<{ value: UserDashboardPeriodPreference; label: string }> = [
  { value: "current_period", label: "Periodo actual de cada tarjeta" },
  { value: "current_month", label: "Mes actual" },
  { value: "previous_month", label: "Mes anterior" },
];

export const dateFormatOptions = [
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
] as const;

export function getPeriodFilterFromPreference(preference: string | null | undefined): PeriodFilterState {
  const filter = getDefaultPeriodFilter();

  if (preference === "current_month") {
    return { ...filter, mode: "current_month" };
  }

  if (preference === "previous_month") {
    return { ...filter, mode: "previous_month" };
  }

  return filter;
}

export function isMissingPreferencesTableError(error: string) {
  return error.includes("user_preferences") || error.includes("schema cache") || error.includes("42P01");
}
