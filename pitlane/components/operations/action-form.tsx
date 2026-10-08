"use client";
import { useActionState, type ReactNode } from "react";
import Link from "next/link";
import type { ActionState } from "@/app/operations-actions";
import styles from "./operations.module.css";
export function ActionForm({
  action,
  children,
  label,
  confirm,
}: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  children?: ReactNode;
  label: string;
  confirm?: string;
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
          className={styles.button}
          disabled={pending || (state.ok && !!state.reservationId)}
        >
          {pending ? "Guardando…" : label}
        </button>
      </fieldset>
      {state.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={state.ok ? styles.success : styles.error}
        >
          {state.message}
        </p>
      )}
      {state.ok && state.reservationId && (
        <Link
          className={styles.link}
          href={`/staff/venta?ticket=${state.reservationId}`}
        >
          Ver comprobante y QR / Nueva venta
        </Link>
      )}
    </form>
  );
}
