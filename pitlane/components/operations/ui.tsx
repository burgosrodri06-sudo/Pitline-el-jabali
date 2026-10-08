import Link from "next/link";
import type { ReactNode } from "react";
import type { UserRole } from "@/types";
import { PageHeader } from "@/components/ui/page-header";
import styles from "./operations.module.css";
export { styles };
// Contenido de página. El piloto recibe el SiteHeader de su layout y el personal la
// barra de Race Control (app/{staff,cobros,admin}/layout.tsx).
export function OperationsShell({
  title,
  description,
  role = "pilot",
  eyebrow,
  children,
}: {
  title: string;
  description: string;
  role?: UserRole;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <main className={styles.shell} lang="es">
      <PageHeader
        eyebrow={eyebrow ?? (role === "pilot" ? "Karting Rental Experience" : "Race Control")}
        title={title}
        description={description}
        className="mb-8"
      />
      {children}
    </main>
  );
}
// Etiquetas y tonos de estado: mapa único en components/ui/status.
export { StatusBadge, statusLabel } from "@/components/ui/status";
export const money = (value: number) =>
  new Intl.NumberFormat("es-SV", { style: "currency", currency: "USD" }).format(
    value,
  );
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat("es-SV", {
    timeZone: "America/El_Salvador",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
export const time = (value: string) =>
  new Intl.DateTimeFormat("es-SV", {
    timeZone: "America/El_Salvador",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
export function EmptyState({ children }: { children: ReactNode }) {
  return <div className={styles.empty}>{children}</div>;
}
export function Pagination({
  page,
  total,
  href,
}: {
  page: number;
  total: number;
  href: string;
}) {
  const separator = href.includes("?") ? "&" : "?";
  return total > 20 ? (
    <nav className={styles.pager} aria-label="Paginación">
      {page > 1 && (
        <Link
          className={styles.link}
          href={`${href}${separator}page=${page - 1}`}
        >
          Anterior
        </Link>
      )}
      <span>
        Página {page} de {Math.ceil(total / 20)}
      </span>
      {page * 20 < total && (
        <Link
          className={styles.link}
          href={`${href}${separator}page=${page + 1}`}
        >
          Siguiente
        </Link>
      )}
    </nav>
  ) : null;
}
export function pageNumber(value: string | string[] | undefined) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= 100000 ? n : 1;
}
