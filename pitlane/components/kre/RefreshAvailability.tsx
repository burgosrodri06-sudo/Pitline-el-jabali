"use client";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
export function RefreshAvailability() {
  const router = useRouter();
  const [pending, start] = useTransition();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") start(() => router.refresh());
    }, 30000);
    return () => clearInterval(timer);
  }, [router]);
  return (
    <p>
      <button disabled={pending} onClick={() => start(() => router.refresh())}>
        {pending ? "Actualizando…" : "Actualizar cupos"}
      </button>{" "}
      <span aria-live="polite">
        La disponibilidad se actualiza cada 30 segundos.
      </span>
    </p>
  );
}
