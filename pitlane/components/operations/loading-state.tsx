import styles from "./operations.module.css";
export default function OperationsLoading() {
  return (
    <main className={styles.shell} lang="es" aria-busy="true">
      <p role="status" className={styles.muted}>
        Cargando información…
      </p>
      <div className={styles.grid}>
        {[1, 2, 3].map((n) => (
          <div key={n} className={styles.skeleton} />
        ))}
      </div>
    </main>
  );
}
