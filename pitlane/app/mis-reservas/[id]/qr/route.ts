import QRCode from "qrcode";
import { getReservationAccess } from "@/lib/operations/service";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await getReservationAccess((await params).id);
  if (!r) return new Response("Reserva no disponible.", { status: 404 });
  const buffer = await QRCode.toBuffer(`pitlane:qr:${r.qrToken}`, {
    width: 800,
    margin: 4,
    errorCorrectionLevel: "M",
  });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="pitlane-${r.id}.png"`,
      "Cache-Control": "private, no-store",
    },
  });
}
