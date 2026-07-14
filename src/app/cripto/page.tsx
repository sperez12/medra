import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function CryptoPage() {
  return (
    <AppShell>
      <section className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-950">Cripto se gestiona desde Inversiones</h1>
        <p className="mt-3 text-slate-600">
          Las criptomonedas ahora viven como activos de tipo cripto dentro del modulo Inversiones. Ahi puedes registrar activos, holdings y actualizar precios con CoinGecko.
        </p>
        <Link
          className="mt-5 inline-flex rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          href="/inversiones"
        >
          Ir a Inversiones
        </Link>
      </section>
    </AppShell>
  );
}
