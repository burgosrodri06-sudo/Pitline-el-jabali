"use client";

import { useEffect, useRef, useState } from "react";
import Brand from "@/components/layout/Brand";
import NavLink from "@/components/layout/NavLink";
import { cx } from "@/components/ui/cx";
import {
  ArrowUpRight,
  BarChart,
  CalendarDays,
  Close,
  CreditCard,
  Menu,
  Package,
  ScanLine,
  Ticket,
} from "@/components/ui/icons";

const icons = {
  scan: ScanLine,
  ticket: Ticket,
  card: CreditCard,
  chart: BarChart,
  calendar: CalendarDays,
  package: Package,
};
export type RaceControlItem = { href: string; label: string; icon: keyof typeof icons };

const itemClass =
  "flex min-h-11 items-center gap-3 rounded-[var(--pl-radius)] border-l-2 border-transparent px-3 text-sm font-medium text-muted " +
  "transition-colors duration-[var(--pl-dur-fast)] hover:bg-surface-2 hover:text-ink " +
  "aria-[current=page]:border-brand aria-[current=page]:bg-surface-2 aria-[current=page]:text-ink";

// Navegación de Race Control: barra lateral en escritorio, panel desplegable en móvil.
// Solo presenta enlaces; cada página conserva su propio guard de rol en el servidor.
export function RaceControlNav({ items, roleLabel }: { items: RaceControlItem[]; roleLabel?: string }) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <aside className="sticky top-0 z-30 border-b border-line bg-surface lg:h-dvh lg:border-r lg:border-b-0">
      <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-5 lg:py-6">
        <Brand context="Race Control" />
        <button
          ref={toggle}
          type="button"
          className="-mr-2 inline-flex size-11 items-center justify-center rounded-[var(--pl-radius)] text-ink hover:bg-surface-2 lg:hidden"
          aria-expanded={open}
          aria-controls="race-control-nav"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          onClick={() => setOpen(!open)}
        >
          {open ? <Close size={22} /> : <Menu size={22} />}
        </button>
      </div>
      <div
        id="race-control-nav"
        className={cx(
          "border-t border-line px-3 pb-4 pt-3 lg:flex lg:h-[calc(100dvh-5.5rem)] lg:flex-col lg:border-t-0 lg:pt-0",
          open ? "block animate-enter" : "hidden",
        )}
      >
        {roleLabel && (
          <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-subtle">{roleLabel}</p>
        )}
        <nav aria-label="Race Control">
          <ul className="space-y-1">
            {items.map((item) => {
              const Icon = icons[item.icon];
              return (
                <li key={item.href}>
                  <NavLink href={item.href} className={itemClass} onClick={() => setOpen(false)}>
                    <Icon size={18} />
                    {item.label}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="mt-4 space-y-1 border-t border-line pt-4 lg:mt-auto">
          <NavLink href="/mis-reservas" className={itemClass} onClick={() => setOpen(false)}>
            <Ticket size={18} />
            Mis reservas
          </NavLink>
          <NavLink href="/karting/kartingrentalexperience" exact className={itemClass}>
            <ArrowUpRight size={18} />
            Sitio público
          </NavLink>
        </div>
      </div>
    </aside>
  );
}
