"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { cx } from "@/components/ui/cx";

// Enlace de navegación que marca la sección activa (aria-current + estilo).
export default function NavLink({
  href,
  className,
  activeClassName = "text-ink",
  exact = false,
  ...props
}: ComponentProps<typeof Link> & { href: string; activeClassName?: string; exact?: boolean }) {
  const pathname = usePathname() ?? "";
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(className, active && activeClassName)}
      {...props}
    />
  );
}
