import Link from "next/link";
import { notFound } from "next/navigation";
import { getSlotDetails } from "@/services/slots.service";
import { getPackages } from "@/services/packages.service";
import { timeInSalvador } from "@/domain/events/inventory";
import { InventoryShell } from "@/components/kre/InventoryShell";
export const dynamic = "force-dynamic";
export const metadata = { title: 'Detalle de tanda | PitLane' };
// Punto de integración de P-03 con P-04. Gabriel incorpora aquí el motor de reservas.
export default async function SlotDetail({
  params,
}: {
  params: Promise<{ slotId: string }>;
}) {
  const { slotId } = await params;
  const slot = await getSlotDetails(slotId);
  if (!slot) notFound();
  const date = new Date(Date.parse(slot.starts_at) - 21600000)
    .toISOString()
    .slice(0, 10);
  const packages = await getPackages(false, date);
  return (
    <InventoryShell>
      <p className="eyebrow">TU TANDA</p>
      <h1>
        {date} · {timeInSalvador(slot.starts_at)}
      </h1>
      <p>
        10 minutos · {slot.available_spots} cupos disponibles · estado:{" "}
        {{ available: 'Disponible', full: 'Llena', closed: 'Cerrada', cancelled: 'Cancelada' }[slot.status]}
      </p>
      <div className="grid">
        {packages.map((pack) => (
          <article key={pack.id}>
            <h2>{pack.name}</h2>
            <p>
              ${pack.price.toFixed(2)} · {pack.spots} {pack.spots === 1 ? 'cupo' : 'cupos'}
            </p>
            {pack.eligibility === "requires_first_ride" && (
              <p>Requiere primera vuelta completada.</p>
            )}
            {pack.spots > slot.available_spots && (
              <p>No hay cupos suficientes para este paquete.</p>
            )}
          </article>
        ))}
      </div>
      <section>
        <h2>Reservas próximamente</h2>
        <p>
          La reserva de esta tanda aún no está habilitada. Esta selección no
          aparta cupos.
        </p>
        <Link href={"/karting/kartingrentalexperience/reservar?fecha=" + date}>
          Volver al calendario
        </Link>
      </section>
    </InventoryShell>
  );
}
