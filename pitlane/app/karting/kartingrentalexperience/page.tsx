import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "KRE | PitLane · El Jabalí",
  description: "Calendario, tandas y paquetes KRE con disponibilidad real.",
};
import { KreExperience } from "@/components/kre/KreExperience";
import { getLiveCatalog } from "@/services/catalog.service";
export const dynamic = "force-dynamic";
export default async function Page() {
  const catalog = await getLiveCatalog();
  return <KreExperience catalog={catalog} />;
}
