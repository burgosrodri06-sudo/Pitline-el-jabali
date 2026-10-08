import type { ReactNode } from "react";
import { cx } from "./cx";

// Encabezado de página: eyebrow + h1 + descripción + acciones.
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx("flex flex-wrap items-end justify-between gap-4 animate-enter", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-text">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-tight sm:text-4xl">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
