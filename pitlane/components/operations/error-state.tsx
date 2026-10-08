"use client";
import { Button, ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
export default function OperationsError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6" lang="es">
      <h1 className="font-display text-3xl font-bold uppercase">No pudimos cargar la información</h1>
      <Alert tone="danger" role="alert" className="mt-5">
        Intenta nuevamente. Si el problema continúa, contacta al administrador.
      </Alert>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={reset}>Reintentar</Button>
        <ButtonLink variant="secondary" href="/karting/kartingrentalexperience">
          Volver a KRE
        </ButtonLink>
      </div>
    </main>
  );
}
