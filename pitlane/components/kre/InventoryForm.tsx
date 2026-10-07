"use client";
import { useActionState, type ReactNode } from "react";
import { saveInventory } from "@/app/admin/inventory-actions";
export function InventoryForm({
  children,
  label = "Guardar cambios",
  confirmation,
}: {
  children: ReactNode;
  label?: string;
  confirmation?: string;
}) {
  const [state, action, pending] = useActionState(saveInventory, {
    ok: false,
    message: "",
  });
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (confirmation && !window.confirm(confirmation)) e.preventDefault();
      }}
    >
      <fieldset disabled={pending}>
        {children}
        <button type="submit">{pending ? "Guardando…" : label}</button>
      </fieldset>
      {state.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={state.ok ? "success" : "error"}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
