"use client";
import { cx } from "@/components/kre/styles";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className={cx("root wrap section")}>
      <h1>No pudimos cargar las fechas.</h1>
      <p>Vuelve a intentarlo para consultar el calendario.</p>
      <button className={cx("root button")} onClick={reset}>
        Reintentar
      </button>
    </main>
  );
}
