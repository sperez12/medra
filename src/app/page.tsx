import { AppShell } from "@/components/app-shell";
import { getCurrentCardPeriod } from "@/lib/periods";

const demoPeriod = getCurrentCardPeriod(10, new Date());

export default function HomePage() {
  return (
    <AppShell>
      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
            Base inicial
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
            Patrimonio Personal
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-600">
            Una app para ver tarjetas, gastos, pagos, cuentas, inversiones,
            presupuestos, metas y reportes en un solo lugar.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Ejemplo de periodo de tarjeta
          </h2>
          <p className="mt-3 text-sm text-slate-600">
            Si una tarjeta corta el dia 10, el periodo actual calculado va de:
          </p>
          <div className="mt-4 rounded-md bg-slate-50 p-4 text-sm text-slate-700">
            <p>Inicio: {demoPeriod.start.toLocaleDateString("es-MX")}</p>
            <p>Fin: {demoPeriod.end.toLocaleDateString("es-MX")}</p>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
