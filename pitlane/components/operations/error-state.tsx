"use client";
import Link from "next/link";
import styles from "./operations.module.css";
export default function OperationsError({ reset }: { reset: () => void }) {
  return (
    <main className={styles.shell} lang="es">
      <h1 className={styles.title}>No pudimos cargar la información</h1>
      <p className={styles.muted}>
        Intenta nuevamente. Si el problema continúa, contacta al administrador.
      </p>
      <div className={styles.fields}>
        <button className={styles.button} onClick={reset}>
          Reintentar
        </button>
        <Link className={styles.link} href="/karting/kartingrentalexperience">
          Volver a KRE
        </Link>
      </div>
    </main>
  );
}
