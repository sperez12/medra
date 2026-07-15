"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  { label: "Dashboard", href: "/" },
  { label: "Tarjetas", href: "/tarjetas" },
  { label: "Gastos", href: "/gastos" },
  { label: "Pagos", href: "/pagos" },
  { label: "Cuentas", href: "/cuentas" },
  { label: "Inversiones", href: "/inversiones" },
  { label: "Presupuestos", href: "/presupuestos" },
  { label: "Metas", href: "/metas" },
  { label: "Calendario", href: "/calendario" },
  { label: "Reportes", href: "/reportes" },
  { label: "Configuracion", href: "/configuracion" },
];

export function SiteNavigation() {
  const pathname = usePathname();

  return (
    <nav className="-mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible" aria-label="Navegacion principal">
      {sections.map((section) => (
        <Link
          className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium shadow-sm transition ${
            isActivePath(pathname, section.href)
              ? "border-brand-500 bg-brand-500 text-white"
              : "border-finance-line bg-white/80 text-finance-muted hover:border-brand-500 hover:bg-white hover:text-brand-700"
          }`}
          href={section.href}
          key={section.href}
        >
          {section.label}
        </Link>
      ))}
    </nav>
  );
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}
