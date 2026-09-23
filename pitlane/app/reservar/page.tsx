import type { Metadata } from "next";
import BookingWizard from "./booking-wizard";

export const metadata: Metadata = {
  title: "Reservar | PitLane · El Jabalí",
  description: "Elegí tu fecha, tanda y experiencia de karting en El Jabalí. Prototipo con disponibilidad simulada.",
};

export default function BookingPage() {
  return <BookingWizard />;
}
