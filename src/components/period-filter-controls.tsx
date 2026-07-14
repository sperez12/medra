"use client";

import type { PeriodFilterMode, PeriodFilterState } from "@/lib/period-filters";

type PeriodFilterControlsProps = {
  value: PeriodFilterState;
  onChange: (value: PeriodFilterState) => void;
};

export function PeriodFilterControls({ value, onChange }: PeriodFilterControlsProps) {
  function updateMode(mode: PeriodFilterMode) {
    onChange({ ...value, mode });
  }

  return (
    <div className="max-w-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-700">Periodo</p>
      <div className="mt-3 flex min-w-0 flex-wrap gap-2">
        <FilterButton active={value.mode === "card_current"} onClick={() => updateMode("card_current")}>
          Periodo actual
        </FilterButton>
        <FilterButton active={value.mode === "current_month"} onClick={() => updateMode("current_month")}>
          Mes actual
        </FilterButton>
        <FilterButton active={value.mode === "previous_month"} onClick={() => updateMode("previous_month")}>
          Mes anterior
        </FilterButton>
        <FilterButton active={value.mode === "custom"} onClick={() => updateMode("custom")}>
          Rango personalizado
        </FilterButton>
      </div>

      {value.mode === "custom" ? (
        <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-slate-600">Fecha inicial</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => onChange({ ...value, startDate: event.target.value })}
              type="date"
              value={value.startDate}
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-600">Fecha final</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => onChange({ ...value, endDate: event.target.value })}
              type="date"
              value={value.endDate}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={`max-w-full rounded-md border px-3 py-2 text-sm ${
        active
          ? "border-teal-600 bg-teal-50 text-teal-700"
          : "border-slate-200 bg-white text-slate-700 hover:border-teal-500"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
