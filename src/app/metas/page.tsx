import { AppShell } from "@/components/app-shell";
import { GoalManager } from "@/components/goals/goal-manager";

export default function Page() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-950">Metas</h1>
        <p className="mt-2 text-slate-600">
          Define objetivos de ahorro, pago de deuda o fondos especificos y registra aportaciones.
        </p>
      </div>
      <GoalManager />
    </AppShell>
  );
}
