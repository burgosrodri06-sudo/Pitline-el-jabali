"use client";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-bold uppercase">No pudimos cargar las fechas.</h1>
      <Alert tone="danger" role="alert" className="mt-5">
        Vuelve a intentarlo para consultar el calendario.
      </Alert>
      <Button className="mt-6" onClick={reset}>
        Reintentar
      </Button>
    </main>
  );
}
