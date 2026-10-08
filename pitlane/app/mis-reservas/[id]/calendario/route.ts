import { getReservationAccess } from "@/lib/operations/service";
import { reservationCalendar } from "@/lib/operations/calendar";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await getReservationAccess((await params).id);
  if (!r) return new Response("Reserva no disponible.", { status: 404 });
  const calendar = reservationCalendar({
    ...r,
    startsAt: r.slot.startsAt,
    endsAt: r.slot.endsAt,
  });
  return new Response(calendar, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="pitlane-${r.id}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
