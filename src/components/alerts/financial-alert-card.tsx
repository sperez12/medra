import Link from "next/link";
import { MoneyAmount } from "@/components/ui/money-amount";
import {
  financialAlertSeverityLabels,
  financialAlertTypeLabels,
  type CalculatedFinancialAlert,
  type FinancialAlertSeverity,
} from "@/lib/financial-alerts";

type FinancialAlertCardProps = {
  alert: CalculatedFinancialAlert;
  compact?: boolean;
};

export function FinancialAlertCard({ alert, compact = false }: FinancialAlertCardProps) {
  return (
    <article className={`min-w-0 rounded-2xl border p-4 ${getAlertSeverityClass(alert.severity)}`}>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/70 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.08em]">
              {financialAlertTypeLabels[alert.type]}
            </span>
            <span className="rounded-full bg-white/50 px-2.5 py-1 text-[0.7rem] font-medium">
              {financialAlertSeverityLabels[alert.severity]}
            </span>
          </div>
          <h3 className="mt-3 break-words font-semibold">{alert.title}</h3>
          <p className="mt-1 break-words text-sm opacity-85">{alert.description}</p>
        </div>

        {typeof alert.amount === "number" && alert.currency ? (
          <p className="shrink-0 break-words text-sm font-semibold sm:text-right">
            <MoneyAmount amount={alert.amount} currency={alert.currency} />
          </p>
        ) : null}
      </div>

      {alert.href && !compact ? (
        <Link className="mt-3 inline-flex text-sm font-semibold underline-offset-4 hover:underline" href={alert.href}>
          Ver sección relacionada
        </Link>
      ) : null}
    </article>
  );
}

export function getAlertSeverityClass(severity: FinancialAlertSeverity) {
  if (severity === "critical") return "border-red-200 bg-red-50 text-red-800";
  if (severity === "warning") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-blue-200 bg-blue-50 text-blue-800";
}
