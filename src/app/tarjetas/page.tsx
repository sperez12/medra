import { AppShell } from "@/components/app-shell";
import { CardManager } from "@/components/cards/card-manager";

export default function CardsPage() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-950">Tarjetas</h1>
        <p className="mt-2 text-slate-600">
          Crea, edita y revisa el gasto del periodo actual de cada tarjeta.
        </p>
      </div>
      <CardManager />
    </AppShell>
  );
}
