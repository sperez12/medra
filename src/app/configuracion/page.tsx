import { AppShell } from "@/components/app-shell";

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <section>
          <h1 className="text-3xl font-bold text-slate-950">Configuración</h1>
          <p className="mt-2 text-slate-600">
            Estado general de la app y próximos ajustes disponibles.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <InfoCard
            title="Sesión y seguridad"
            description="La app usa Supabase Auth. Tus datos se consultan con tu usuario autenticado."
          />
          <InfoCard
            title="Moneda principal"
            description="Los reportes usan MXN por defecto. Las tarjetas pueden mostrar otra moneda si la registras."
          />
          <InfoCard
            title="Categorías"
            description="Las categorías básicas de gastos se crean automáticamente para cada usuario."
          />
          <InfoCard
            title="Configuración avanzada"
            description="Perfil, preferencias y monedas se agregarán en una fase futura."
          />
        </section>
      </div>
    </AppShell>
  );
}

function InfoCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </div>
  );
}
