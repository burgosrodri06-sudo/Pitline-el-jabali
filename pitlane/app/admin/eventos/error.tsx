"use client";
import { InventoryShell } from "@/components/kre/InventoryShell";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <InventoryShell admin>
      <h1>No pudimos cargar las fechas</h1>
      <p role="alert">Revisa la conexión e intenta de nuevo.</p>
      <button onClick={reset}>Reintentar</button>
    </InventoryShell>
  );
}
