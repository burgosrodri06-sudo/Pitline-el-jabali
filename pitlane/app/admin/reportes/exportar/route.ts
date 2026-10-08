import { getReports, localToday } from "@/lib/operations/service";
import { toOperationsCsv } from "@/lib/operations/reports";
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const { summary: s } = await getReports({
    from: q.get("from") || localToday(),
    to: q.get("to") || localToday(),
    packageId: q.get("packageId") || "",
    method: q.get("method") || "",
  });
  const csv = toOperationsCsv(
    ["Métrica", "Valor"],
    [
      ["Capacidad", s.capacity],
      ["Participantes", s.bookedParticipants],
      ["Ocupación %", s.occupancyPercent],
      ["Asistencias", s.checkedInParticipants],
      ["Ausencias", s.noShowParticipants],
      ["No-show %", s.noShowPercent],
      ["Ingresos USD", s.revenueCents / 100],
      ["Transferencias USD", s.webRevenueCents / 100],
      ["Efectivo en pista USD", s.trackCashRevenueCents / 100],
      ["Créditos emitidos USD", s.creditsIssuedCents / 100],
      ...Object.entries(s.packagesSold).map(
        ([id, count]) => [`Paquete ${id}`, count] as const,
      ),
    ],
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="pitlane-operacion.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
