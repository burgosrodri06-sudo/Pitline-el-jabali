import Link from "next/link";
import type { ComponentProps } from "react";
import { cx } from "./cx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";
type Style = { variant?: Variant; size?: Size; block?: boolean };

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--pl-radius)] px-4 text-sm font-semibold " +
  "transition-[background-color,border-color,color,transform] duration-[var(--pl-dur-fast)] active:translate-y-px " +
  "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover disabled:hover:bg-brand",
  secondary: "border border-line-strong bg-surface-2 text-ink hover:border-muted hover:bg-surface-3",
  ghost: "text-muted hover:bg-surface-2 hover:text-ink",
  danger: "border border-danger/60 bg-danger/10 text-danger hover:bg-danger/20",
};

const sizes: Record<Size, string> = {
  md: "",
  lg: "min-h-13 px-6 text-base",
};

export function buttonClass({ variant = "primary", size = "md", block = false, className }: Style & { className?: string } = {}) {
  return cx(base, variants[variant], sizes[size], block && "w-full", className);
}

export function Button({ variant, size, block, className, type = "button", ...props }: ComponentProps<"button"> & Style) {
  return <button type={type} className={buttonClass({ variant, size, block, className })} {...props} />;
}

export function ButtonLink({ variant, size, block, className, ...props }: ComponentProps<typeof Link> & Style) {
  return <Link className={buttonClass({ variant, size, block, className })} {...props} />;
}
