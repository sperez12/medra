import { DEFAULT_DATE_FORMAT } from "@/lib/user-preferences";
import type { UserDateFormatPreference } from "@/types/finance";

export function formatDateForPreference(
  dateValue: Date | string | null | undefined,
  dateFormat: UserDateFormatPreference | string | null | undefined = DEFAULT_DATE_FORMAT
) {
  if (!dateValue) return "";

  const date = dateValue instanceof Date ? dateValue : new Date(`${dateValue.slice(0, 10)}T00:00:00`);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());

  if (dateFormat === "MM/DD/YYYY") {
    return `${month}/${day}/${year}`;
  }

  if (dateFormat === "YYYY-MM-DD") {
    return `${year}-${month}-${day}`;
  }

  return `${day}/${month}/${year}`;
}

export function formatDateTimeForPreference(
  dateValue: string | null | undefined,
  dateFormat: UserDateFormatPreference | string | null | undefined = DEFAULT_DATE_FORMAT
) {
  if (!dateValue) return "";

  const date = new Date(dateValue);
  const dateText = formatDateForPreference(date, dateFormat);
  const timeText = date.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${dateText} ${timeText}`;
}
