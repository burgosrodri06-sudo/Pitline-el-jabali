import type { Metadata } from "next";
import { eventDates, slots, packages } from "./booking-data";
import BookingWizard from "./booking-wizard";

export const metadata: Metadata = {
  title: "Reservar | PitLane · El Jabalí",
  description: "Elegí tu fecha, tanda y experiencia de karting en El Jabalí. Prototipo con disponibilidad simulada.",
};

export default async function BookingPage({searchParams}: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const query = await searchParams;
  const date = eventDates.find(item => item.id === query.evento);
  const slot = slots.find(item => date && item.eventDateId === date.id && item.id === query.tanda && item.remainingKarts > 0);
  const experience = packages.find(item => slot && item.id === query.paquete && item.karts <= slot.remainingKarts);
  const initial = {dateId:date?.id,slotId:slot?.id,packageId:experience?.id};
  return <BookingWizard key={`${initial.dateId}-${initial.slotId}-${initial.packageId}`} initial={initial} />;
}
