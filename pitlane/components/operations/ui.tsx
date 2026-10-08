import Link from "next/link";
import type { ReactNode } from "react";
import type { UserRole } from "@/types";
import { canAccessOperation } from "@/lib/operations/rules";
import styles from "./operations.module.css";
export { styles };
export function OperationsShell({
  title,
  description,
  role = "pilot",
  children,
}: {
  title: string;
  description: string;
  role?: UserRole;
  children: ReactNode;
}) {
  return (
    <main className={styles.shell} lang="es">
      <div className={styles.top}>
        <Link className={styles.brand} href="/karting/kartingrentalexperience">
          PIT<span>LANE</span>
        </Link>
        <nav className={styles.nav} aria-label="Operación">
          <Link href="/mis-reservas">Mis reservas</Link>
          {canAccessOperation(role, "track") && (
            <>
              <Link href="/staff/check-in">Check-in</Link>
              <Link href="/staff/venta">Venta en pista</Link>
            </>
          )}
          {canAccessOperation(role, "payments") && (
            <Link href="/cobros/verificacion">Cobros</Link>
          )}
          {canAccessOperation(role, "reports") && (
            <Link href="/admin/reportes">Reportes</Link>
          )}
        </nav>
      </div>
      <p className={styles.eyebrow}>KARTING RENTAL EXPERIENCE</p>
      <h1 className={styles.title}>{title}</h1>
      <p className={`${styles.muted} ${styles.lead}`}>{description}</p>
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
