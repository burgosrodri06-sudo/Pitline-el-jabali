import "server-only";
import type { Catalog } from "@/domain/events/types";
import { getPublishedEvents } from "./events.service";
import { getEventSlots } from "./slots.service";
import { getPackages } from "./packages.service";
export async function getLiveCatalog(): Promise<Catalog> {
  const [events, packages] = await Promise.all([
    getPublishedEvents(),
    getPackages(),
  ]);
  const slots = (
    await Promise.all(events.map((e) => getEventSlots(e.id)))
  ).flat();
  return {
    events: events.map((e) => ({
      id: e.id,
      date: e.date,
      name: "Karting Rental Experience",
      status: e.status === "open" ? "open" : "closed",
    })),
    slots: slots.map((s) => ({
      id: s.id,
      eventId: s.event_id,
      startsAt: s.starts_at,
      durationMinutes: 10,
      capacity: s.capacity,
      availableSeats: s.available_spots,
      status:
        s.status === "available" && Date.parse(s.starts_at) > Date.now()
          ? "open"
          : "closed",
    })),
    packages: packages.map((p) => ({
      id: p.id,
      name: p.name,
      priceCents: Math.round(p.price * 100),
      participants: p.spots,
      sessionsPerPerson: 1,
      minutesPerSession: p.duration_minutes,
      active: p.active,
    })),
  };
}
