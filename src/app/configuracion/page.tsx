import { AppShell } from "@/components/app-shell";

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <section>
          <h1 className="text-3xl font-bold text-slate-950">Configuracion</h1>
          <p className="mt-2 text-slate-600">
            Estado general de la app y proximos ajustes disponibles.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <InfoCard
            title="Sesion y seguridad"
            description="La app usa Supabase Auth. Tus datos se consultan con tu usuario autenticado."
          />
          <InfoCard
            title="Monedas"
            description="MXN sigue como moneda inicial, pero puedes registrar tarjetas y cuentas en varias monedas sin mezclarlas en los totales."
          />
          <InfoCard
            title="Categorias"
            description="Las categorias basicas de gastos se crean automaticamente para cada usuario."
          />
          <InfoCard
            title="Configuracion avanzada"
            description="Perfil, preferencias y tipo de cambio automatico se agregaran en una fase futura."
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
