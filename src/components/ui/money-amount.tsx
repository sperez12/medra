import { DEFAULT_CURRENCY, getCurrencyFormatParts, normalizeCurrency } from "@/lib/currencies";

type MoneyAmountProps = {
  amount: number;
  currency?: string | null;
  className?: string;
  codeClassName?: string;
  compact?: boolean;
};

export function MoneyAmount({
  amount,
  currency = DEFAULT_CURRENCY,
  className = "",
  codeClassName = "",
  compact = false,
}: MoneyAmountProps) {
  const normalizedCurrency = normalizeCurrency(currency);
  const { prefix, suffix, decimals } = getCurrencyFormatParts(normalizedCurrency);
  const sign = amount < 0 ? "-" : "";
  const formattedAmount = Math.abs(amount).toLocaleString("es-MX", {
    minimumFractionDigits: compact ? 0 : decimals,
    maximumFractionDigits: compact ? 0 : decimals,
  });

  return (
    <span className={`inline-flex min-w-0 flex-wrap items-baseline gap-x-1 gap-y-0.5 ${className}`}>
      <span className="break-words">
        {sign}
        {prefix}
        {formattedAmount}
      </span>
      {suffix ? (
        <span className={`text-[0.58em] font-semibold uppercase tracking-[0.08em] opacity-70 ${codeClassName}`}>
          {suffix}
        </span>
      ) : null}
    </span>
  );
}
