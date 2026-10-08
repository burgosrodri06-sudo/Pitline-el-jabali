import type { ReactNode } from "react";
import { cx } from "./cx";

// text-base (16px) evita que iOS haga zoom al tocar el input.
export const inputClass =
  "w-full min-h-11 rounded-[var(--pl-radius)] border border-line bg-surface px-3 py-2.5 text-base text-ink " +
  "placeholder:text-subtle transition-[border-color,box-shadow] duration-[var(--pl-dur-fast)] " +
  "outline-none focus:border-brand focus:ring-2 focus:ring-brand/35 aria-invalid:border-danger " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export const labelClass = "mb-1.5 block text-sm font-medium text-ink";

export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <span id={id} className="mt-1.5 block text-sm text-danger">
      {children}
    </span>
  );
}

export function FieldHint({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <span id={id} className={cx("mt-1.5 block text-sm text-muted", className)}>
      {children}
    </span>
  );
}
