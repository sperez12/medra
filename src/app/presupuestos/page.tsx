import { AppShell } from "@/components/app-shell";
import { BudgetManager } from "@/components/budgets/budget-manager";

export default function Page() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-950">Presupuestos</h1>
        <p className="mt-2 text-slate-600">
          Define limites mensuales por categoria y compara tu plan contra tus gastos reales.
        </p>
      </div>
      <BudgetManager />
    </AppShell>
  );
}
