import Link from "next/link";

const sections = [
  { label: "Dashboard", href: "/" },
  { label: "Tarjetas", href: "/tarjetas" },
  { label: "Gastos", href: "/gastos" },
  { label: "Pagos", href: "/pagos" },
  { label: "Cuentas", href: "/cuentas" },
  { label: "Inversiones", href: "/inversiones" },
  { label: "Cripto", href: "/cripto" },
  { label: "Presupuestos", href: "/presupuestos" },
  { label: "Metas", href: "/metas" },
  { label: "Calendario", href: "/calendario" },
  { label: "Reportes", href: "/reportes" },
  { label: "Configuracion", href: "/configuracion" },
];

export function SiteNavigation() {
  return (
    <nav className="flex flex-wrap gap-2">
      {sections.map((section) => (
        <Link
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:border-teal-500 hover:text-teal-700"
          href={section.href}
          key={section.href}
        >
          {section.label}
        </Link>
      ))}
    </nav>
  );
}
