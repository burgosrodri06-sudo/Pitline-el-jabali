import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { validateCapacity, type SlotRow } from "@/domain/events/inventory";
import { checkDatabaseError } from "./inventory.service";
export async function getEventSlots(eventId: string): Promise<SlotRow[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("slots")
    .select("*")
    .eq("event_id", eventId)
    .order("starts_at");
  checkDatabaseError(error);
  if (!data?.length) return [];
  const availability = await db
    .from("slot_availability")
    .select("slot_id, available_spots")
    .in(
      "slot_id",
      data.map((s) => s.id),
    );
  checkDatabaseError(availability.error);
  const spots = new Map(
    (availability.data ?? []).map((a) => [a.slot_id, a.available_spots]),
  );
  return data.map((s) => {
    const available = spots.get(s.id);
    if (typeof available !== "number")
      throw new Error(
        "No se pudo consultar la disponibilidad de una tanda. Actualiza la página.",
      );
    return { ...s, available_spots: available } as SlotRow;
  });
}
export async function getSlotDetails(id: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    return null;
  const db = await createClient();
  const { data, error } = await db
    .from("slots")
    .select("event_id")
    .eq("id", id)
    .maybeSingle();
  checkDatabaseError(error);
  if (!data) return null;
  return (await getEventSlots(data.event_id)).find((s) => s.id === id) ?? null;
}
export async function generateSlots(
  eventId: string,
  capacity: number,
  trackReservedSpots: number,
) {
  await requireAdmin();
  validateCapacity(capacity, trackReservedSpots);
  const db = await createClient();
  const { data, error } = await db.rpc("kre_generate_slots", {
    p_event_id: eventId,
    p_capacity: capacity,
    p_track_reserved_spots: trackReservedSpots,
  });
  checkDatabaseError(error);
  return data as number;
}
export async function updateSlot(
  id: string,
  input: Pick<
    SlotRow,
    "starts_at" | "ends_at" | "capacity" | "track_reserved_spots" | "status"
  >,
) {
  await requireAdmin();
  validateCapacity(input.capacity, input.track_reserved_spots);
  if (!["available", "full", "closed", "cancelled"].includes(input.status))
    throw new Error("Estado inválido.");
  if (
    !Number.isFinite(Date.parse(input.starts_at)) ||
    Date.parse(input.ends_at) - Date.parse(input.starts_at) !== 600000
  )
    throw new Error("Cada tanda debe durar exactamente 10 minutos.");
  const db = await createClient();
  const { data, error } = await db
    .from("slots")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  checkDatabaseError(error);
  return data;
}
