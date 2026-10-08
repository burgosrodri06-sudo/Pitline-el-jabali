import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./inventory.module.css";
export function InventoryShell({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) {
  return (
    <div className={styles.root}>
      <header>
        <Link href="/karting/kartingrentalexperience">
          <strong>PITLANE / EL JABALÍ</strong>
        </Link>
        <nav aria-label="Navegación KRE">
          <Link href="/karting/kartingrentalexperience/reservar">
            Calendario
          </Link>
          {admin ? (
            <>
              <Link href="/admin/eventos">Fechas y tandas</Link>
              <Link href="/admin/paquetes">Paquetes</Link>
            </>
          ) : (
            <Link href="/login">Iniciar sesión</Link>
          )}
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
