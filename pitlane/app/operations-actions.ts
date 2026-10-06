"use server";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import {
  checkInReservation,
  closeSlot,
  createCredit,
  createTrackSale,
  markFirstRideCompleted,
  OperationError,
  reviewPayment,
} from "@/lib/operations/service";

export type ActionState = {
  ok: boolean;
  message: string;
  reservationId?: string;
};
const field = (data: FormData, name: string) => String(data.get(name) ?? "");
async function perform(work: () => Promise<ActionState>): Promise<ActionState> {
  try {
    const result = await work();
    for (const path of [
      "/mis-reservas",
      "/cobros/verificacion",
      "/staff/check-in",
      "/staff/venta",
      "/admin/reportes",
      "/karting/kartingrentalexperience/reservar",
    ])
      revalidatePath(path);
    revalidatePath("/reservar/[slotId]", "page");
    revalidatePath("/reservas/[id]/pago", "page");
    return result;
  } catch (error) {
    unstable_rethrow(error);
    return {
      ok: false,
      message:
        error instanceof OperationError
          ? error.message
          : "No se pudo completar la operación. Actualiza la página e intenta de nuevo.",
    };
  }
}
export async function paymentAction(_: ActionState, data: FormData) {
  return perform(async () => {
    await reviewPayment(
      field(data, "paymentId"),
      field(data, "decision"),
      field(data, "reason"),
    );
    return { ok: true, message: "Pago actualizado correctamente." };
  });
}
export async function checkInAction(_: ActionState, data: FormData) {
  return perform(async () => {
    const count = await checkInReservation(
      field(data, "slotId"),
      field(data, "lookup"),
      field(data, "participantId"),
    );
    return {
      ok: true,
      message: count
        ? `Check-in registrado: ${count} participante(s).`
        : "Ya estaba registrado. Se conservó la hora original.",
    };
  });
}
export async function completeRideAction(_: ActionState, data: FormData) {
  return perform(async () => {
    await markFirstRideCompleted(field(data, "participantId"));
    return {
      ok: true,
      message:
        "Primera vuelta completada. Segunda vuelta habilitada para este participante.",
    };
  });
}
export async function closeSlotAction(_: ActionState, data: FormData) {
  return perform(async () => {
    const count = await closeSlot(field(data, "slotId"));
    return {
      ok: true,
      message: `Asistencia cerrada. ${count} ausencia(s) nuevas registradas.`,
    };
  });
}
export async function trackSaleAction(_: ActionState, data: FormData) {
  return perform(async () => {
    const reservationId = await createTrackSale(
      field(data, "slotId"),
      field(data, "packageId"),
      field(data, "name"),
      field(data, "requestId"),
      field(data, "firstParticipantId"),
    );
    return {
      ok: true,
      message:
        "Venta registrada y pagada en efectivo. Abre el comprobante para ver el código y QR.",
      reservationId,
    };
  });
}
export async function creditAction(_: ActionState, data: FormData) {
  return perform(async () => {
    if (field(data, "confirm") !== "yes")
      throw new OperationError(
        "Confirma la cancelación y emisión del crédito.",
      );
    await createCredit(field(data, "reservationId"), field(data, "reason"));
    return {
      ok: true,
      message:
        "Reserva cancelada y crédito emitido por el saldo realmente pagado. No vence.",
    };
  });
}
