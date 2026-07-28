import { InvestmentManager } from "@/components/investments/investment-manager";
import { AppShell } from "@/components/app-shell";

export default function Page() {
  return (
    <AppShell>
      <section className="mb-6">
        <h1 className="text-3xl font-bold text-slate-950">Inversiones</h1>
        <p className="mt-2 text-slate-600">
          Revisa tus posiciones, activos, precios y operaciones por plataforma.
        </p>
      </section>
      <InvestmentManager />
    </AppShell>
  );
}
