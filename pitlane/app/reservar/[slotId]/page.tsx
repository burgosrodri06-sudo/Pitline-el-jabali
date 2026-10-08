import { notFound, redirect } from "next/navigation";
import { getSlotDetails } from "@/services/slots.service";

export const dynamic = "force-dynamic";

// Conserva los enlaces del calendario e integra el formulario de reservas del equipo.
export default async function SlotDetail({ params, searchParams }: {
  params: Promise<{ slotId: string }>;
  searchParams: Promise<{ paquete?: string | string[] }>;
}) {
  const { slotId } = await params;
  const slot = await getSlotDetails(slotId);
  if (!slot) notFound();
  const { paquete } = await searchParams;
  const query = new URLSearchParams({ evento: slot.event_id, tanda: slot.id });
  if (typeof paquete === "string") query.set("paquete", paquete);
  redirect(`/reservar?${query}`);
}