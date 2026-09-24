import { cx } from "@/components/kre/styles";
export default function Loading() {
  return (
    <main className={cx("root wrap section")} aria-busy="true">
      <p role="status">Cargando calendario y paquetes…</p>
      <div className={cx("root skeleton")} />
      <div className={cx("root skeleton")} />
    </main>
  );
}
