"use client";
import { InventoryShell } from "@/components/kre/InventoryShell";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <InventoryShell>
      <h1>No pudimos consultar los cupos</h1>
      <p role="alert">Revisa tu conexión y vuelve a intentar.</p>
      <button onClick={reset}>Reintentar</button>
    </InventoryShell>
  );
}
