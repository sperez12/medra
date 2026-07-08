import { AppShell } from "@/components/app-shell";
import { ExpenseManager } from "@/components/expenses/expense-manager";

export default function ExpensesPage() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-950">Gastos</h1>
        <p className="mt-2 text-slate-600">
          Registra gastos manuales y marca compras recurrentes o a meses sin intereses.
        </p>
      </div>
      <ExpenseManager />
    </AppShell>
  );
}
