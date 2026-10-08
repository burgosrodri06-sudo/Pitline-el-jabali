import type { ReactNode } from "react";
import { cx } from "./cx";
import { AlertTriangle, CheckCircle, Info, XCircle } from "./icons";
import { toneClass } from "./status";

const alertIcons = { info: Info, success: CheckCircle, warning: AlertTriangle, danger: XCircle };
type AlertTone = keyof typeof alertIcons;

// Mensaje con tono, icono y texto. role va explícito para no anunciar avisos estáticos.
export function Alert({
  tone = "info",
  title,
  children,
  role,
  className,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  role?: "alert" | "status";
  className?: string;
}) {
  const Icon = alertIcons[tone];
  return (
    <div role={role} className={cx("flex gap-3 rounded-[var(--pl-radius)] border px-4 py-3 text-sm animate-fade", toneClass[tone], className)}>
      <Icon size={20} className="mt-0.5 shrink-0" />
      <div className="min-w-0 space-y-1 text-ink">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed text-ink/85">{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-[var(--pl-radius)] border border-dashed border-line-strong px-5 py-8 text-center">
      <p className="font-display text-xl font-semibold uppercase tracking-wide">{title}</p>
      {children && <p className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx("animate-pulse rounded-[var(--pl-radius)] bg-surface-2", className)} />;
}

// Esqueleto de página para los loading.tsx.
export function PageSkeleton({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6" aria-busy="true">
      <p role="status" className="sr-only">
        {label}
      </p>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-4 h-10 w-2/3 max-w-md" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((n) => (
          <Skeleton key={n} className="h-40" />
        ))}
      </div>
    </div>
  );
}
