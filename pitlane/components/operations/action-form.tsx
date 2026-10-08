"use client";
import { useActionState, type ReactNode } from "react";
import Link from "next/link";
import type { ActionState } from "@/app/operations-actions";
import { buttonClass } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import styles from "./operations.module.css";
export function ActionForm({
  action,
  children,
  label,
  confirm,
  variant = "primary",
  size = "md",
}: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  children?: ReactNode;
  label: string;
  confirm?: string;
  // Solo presentación: "danger" para acciones destructivas, "lg" para uso táctil en pista.
  variant?: "primary" | "secondary" | "danger";
  size?: "md" | "lg";
}) {
  const [state, submit, pending] = useActionState(action, {
    ok: false,
    message: "",
  });
  return (
    <form
      action={submit}
      className={styles.form}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      <fieldset
        className={styles.fieldset}
        disabled={pending || (state.ok && !!state.reservationId)}
      >
        {children}
        <button
          className={buttonClass({ variant, size, block: size === "lg", className: styles.button })}
          data-variant={variant}
          data-size={size}
          disabled={pending || (state.ok && !!state.reservationId)}
        >
          {pending ? "Guardando…" : label}
        </button>
      </fieldset>
      {state.message && (
        <Alert
          tone={state.ok ? "success" : "danger"}
          role={state.ok ? "status" : "alert"}
          title={state.message}
        />
      )}
      {state.ok && state.reservationId && (
        <Link
          className={buttonClass({ variant: "secondary", className: styles.link })}
          href={`/staff/venta?ticket=${state.reservationId}`}
        >
          Ver comprobante y QR / Nueva venta
        </Link>
      )}
    </form>
  );
}
