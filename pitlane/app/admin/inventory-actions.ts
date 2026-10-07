"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  createEvent,
  updateEvent,
  setEventStatus,
} from "@/services/events.service";
import { generateSlots, updateSlot } from "@/services/slots.service";
import {
  createPackage,
  updatePackage,
  setPackageActive,
} from "@/services/packages.service";
import type {
  EventInput,
  PackageInput,
  SlotRow,
} from "@/domain/events/inventory";
export type ActionResult = { ok: boolean; message: string };
export async function saveInventory(
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const str = (key: string) => String(form.get(key) ?? "");
  const num = (key: string) => Number(str(key));
  const id = str("id");
  let message = "Cambios guardados.";
  try {
    switch (str("operation")) {
      case "event": {
        const input: EventInput = {
          date: str("date"),
          start_time: str("start_time"),
          end_time: str("end_time"),
          slot_minutes: 10,
          buffer_minutes: num("buffer_minutes"),
          status: str("status") as EventInput["status"],
        };
        if (id) await updateEvent(id, input);
        else await createEvent(input);
        message = id
          ? "Fecha actualizada."
          : "Fecha creada como borrador. Genera las tandas y publícala.";
        break;
      }
      case "event-status":
        await setEventStatus(id, str("status") as EventInput["status"]);
        message =
          "Estado actualizado. Cerrar o cancelar una fecha también cierra o cancela sus tandas.";
        break;
      case "generate": {
        const count = await generateSlots(
          id,
          num("capacity"),
          num("track_reserved_spots"),
        );
        message = count + " tandas creadas. Ya puedes publicar la fecha.";
        break;
      }
      case "slot": {
        const start = str("starts_at") + "-06:00";
        const end = new Date(Date.parse(start) + 600000).toISOString();
        await updateSlot(id, {
          starts_at: start,
          ends_at: end,
          capacity: num("capacity"),
          track_reserved_spots: num("track_reserved_spots"),
          status: str("status") as SlotRow["status"],
        });
        break;
      }
      case "package": {
        const name = str("name");
        const input: PackageInput = {
          name,
          price: num("price"),
          spots: name === "Friends Combo" ? 5 : 1,
          duration_minutes: 10,
          active: form.has("active"),
          valid_from: str("valid_from") || null,
          valid_to: str("valid_to") || null,
          eligibility:
            name === "Segunda vuelta" ? "requires_first_ride" : "none",
        };
        if (id) await updatePackage(id, input);
        else await createPackage(input);
        break;
      }
      case "package-active":
        await setPackageActive(id, str("active") === "true");
        break;
      default:
        throw new Error("Acción desconocida.");
    }
    for (const path of [
      "/admin/eventos",
      "/admin/paquetes",
      "/karting/kartingrentalexperience",
      "/karting/kartingrentalexperience/reservar",
    ])
      revalidatePath(path);
    return { ok: true, message };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "No fue posible guardar. Intenta de nuevo.",
    };
  }
}
