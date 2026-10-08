import type { ReactNode } from "react";
import styles from "./inventory.module.css";
// Contenedor del calendario público y del inventario de admin.
// La navegación viene del layout: SiteHeader (público) o Race Control (/admin).
export function InventoryShell({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) {
  return (
    <div className={styles.root} data-admin={admin || undefined}>
      <main className="animate-enter">{children}</main>
    </div>
  );
}
