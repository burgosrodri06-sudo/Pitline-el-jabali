import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "KRE | PitLane · El Jabalí",
  description:
    "Calendario, tandas y paquetes KRE. Prototipo con disponibilidad simulada.",
};
import { KreExperience } from "@/components/kre/KreExperience";
import { catalog } from "@/lib/catalog";
export default function Page() {
  return <KreExperience catalog={catalog} />;
}
