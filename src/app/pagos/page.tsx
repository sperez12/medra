import { AppShell } from "@/components/app-shell";
import { PaymentManager } from "@/components/payments/payment-manager";

export default function PaymentsPage() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-950">Pagos</h1>
        <p className="mt-2 text-slate-600">
          Registra pagos hechos a tus tarjetas y consulta tus pagos recientes.
        </p>
      </div>
      <PaymentManager />
    </AppShell>
  );
}
