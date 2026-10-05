export type EventRow = {
  id: string;
  date: string;
  status: "draft" | "open" | "closed" | "cancelled";
  start_time: string;
  end_time: string;
  slot_minutes: number;
  buffer_minutes: number;
};
export type SlotRow = {
  id: string;
  event_id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  track_reserved_spots: number;
  status: "available" | "full" | "closed" | "cancelled";
  available_spots: number;
};
export type PackageRow = {
  id: string;
  name: string;
  price: number;
  spots: number;
  duration_minutes: number;
  active: boolean;
  valid_from: string | null;
  valid_to: string | null;
  eligibility: "none" | "requires_first_ride";
};
export type EventInput = Omit<EventRow, "id">;
export type PackageInput = Omit<PackageRow, "id">;
export function localToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/El_Salvador",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function timeInSalvador(value: string) {
  return new Intl.DateTimeFormat("es-SV", {
    timeZone: "America/El_Salvador",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
export function validateEvent(input: EventInput) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || input.date < localToday())
    throw new Error("La fecha no puede estar en el pasado.");
  if (!["draft", "open", "closed", "cancelled"].includes(input.status))
    throw new Error("Estado inválido.");
  if (
    !/^\d{2}:\d{2}(:\d{2})?$/.test(input.start_time) ||
    !/^\d{2}:\d{2}(:\d{2})?$/.test(input.end_time)
  )
    throw new Error("Revisa el horario.");
  const start = Date.parse(
    input.date + "T" + input.start_time.slice(0, 5) + ":00-06:00",
  );
  let end = Date.parse(
    input.date + "T" + input.end_time.slice(0, 5) + ":00-06:00",
  );
  if (input.end_time.slice(0, 5) === "00:00") end += 86400000;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 600000)
    throw new Error(
      "El horario debe permitir al menos una tanda de 10 minutos.",
    );
  if (
    input.slot_minutes !== 10 ||
    !Number.isInteger(input.buffer_minutes) ||
    input.buffer_minutes < 0 ||
    input.buffer_minutes > 60
  )
    throw new Error("Tandas de 10 minutos y buffer entre 0 y 60 minutos.");
}
export function validateCapacity(capacity: number, reserved: number) {
  if (
    !Number.isInteger(capacity) ||
    capacity < 1 ||
    capacity > 10 ||
    !Number.isInteger(reserved) ||
    reserved < 0 ||
    reserved > capacity
  )
    throw new Error(
      "La capacidad debe ser de 1 a 10 y los cupos de pista no pueden superarla.",
    );
}
export function validatePackage(input: PackageInput) {
  if (
    !["Individual", "Segunda vuelta", "Friends Combo"].includes(input.name) ||
    input.spots !== (input.name === "Friends Combo" ? 5 : 1) ||
    input.duration_minutes !== 10
  )
    throw new Error(
      "Usa Individual (1), Segunda vuelta (1) o Friends Combo (5), de 10 minutos.",
    );
  if (
    !Number.isFinite(input.price) ||
    input.price <= 0 ||
    input.price > 99999999.99
  )
    throw new Error("Introduce un precio válido.");
  if (
    input.eligibility !==
    (input.name === "Segunda vuelta" ? "requires_first_ride" : "none")
  )
    throw new Error("Segunda vuelta exige haber completado la primera.");
  if (
    (input.valid_from && !/^\d{4}-\d{2}-\d{2}$/.test(input.valid_from)) ||
    (input.valid_to && !/^\d{4}-\d{2}-\d{2}$/.test(input.valid_to))
  )
    throw new Error("Vigencia inválida.");
  if (input.valid_from && input.valid_to && input.valid_to < input.valid_from)
    throw new Error("Revisa el rango de vigencia.");
}
