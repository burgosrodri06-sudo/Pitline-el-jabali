import assert from "node:assert/strict";
import { test } from "node:test";
import { createLocalCheckIn } from "./check-in.mts";
import { createSimulatedReservations } from "./fixtures/simulated-reservations.mts";

const request = {
  code: "SIM-PAID",
  eventDate: "2026-09-25",
  slotId: "sim-slot-1800",
};
const firstTime = "2026-09-26T00:01:00.000Z";

function setup() {
  let clockCalls = 0;
  const service = createLocalCheckIn(createSimulatedReservations(), () => {
    clockCalls += 1;
    return new Date(clockCalls === 1 ? firstTime : "2026-09-26T00:02:00.000Z");
  });
  return { service, clockCalls: () => clockCalls };
}

test("registra una reserva pagada y devuelve titular, cupos y hora", () => {
  const { service, clockCalls } = setup();
  const before = service.listAttendance();
  assert.deepEqual(service.register(request), {
    outcome: "registered",
    attendance: { reservationId: "sim-reservation-1", checkedInAt: firstTime },
    holderName: "Piloto de prueba",
    seats: 5,
  });
  assert.equal(service.listAttendance().length, before.length + 1);
  assert.equal(clockCalls(), 1);
});

const rejectionCases = [
  ["código desconocido", { code: "SIM-UNKNOWN" }, "unknown_code"],
  ["pendiente", { code: "SIM-PENDING_PAYMENT" }, "reservation_not_paid"],
  ["en revisión", { code: "SIM-PAYMENT_REVIEW" }, "reservation_not_paid"],
  ["cancelada", { code: "SIM-CANCELLED" }, "reservation_not_paid"],
  ["expirada", { code: "SIM-EXPIRED" }, "reservation_not_paid"],
  ["ausente", { code: "SIM-NO_SHOW" }, "reservation_not_paid"],
  ["atendida sin marcación previa", { code: "SIM-ATTENDED" }, "reservation_not_paid"],
  ["otra fecha con la misma tanda", { eventDate: "2026-09-26" }, "wrong_date"],
  ["otra tanda con la misma fecha", { slotId: "sim-slot-1810" }, "wrong_slot"],
];

for (const [label, changes, reason] of rejectionCases) {
  test(`rechaza ${label} sin escribir asistencia ni consultar el reloj`, () => {
    const { service, clockCalls } = setup();
    const before = service.listAttendance();
    assert.deepEqual(service.register({ ...request, ...changes }), {
      outcome: "rejected", reason,
    });
    assert.deepEqual(service.listAttendance(), before);
    assert.equal(clockCalls(), 0);
  });
}

test("repetir el código conserva la primera hora y una sola marcación local", () => {
  const { service, clockCalls } = setup();
  const first = service.register(request);
  const before = service.listAttendance();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    assert.deepEqual(service.register(request), { ...first, outcome: "already_registered" });
  }
  assert.deepEqual(service.listAttendance(), before);
  assert.equal(clockCalls(), 1);
});

test("conserva una asistencia incluida en los datos iniciales", () => {
  const { service, clockCalls } = setup();
  const before = service.listAttendance();
  const result = service.register({ ...request, code: "SIM-ALREADY-REGISTERED" });
  assert.equal(result.outcome, "already_registered");
  assert.equal(result.attendance.checkedInAt, "2026-09-26T00:00:00.000Z");
  assert.deepEqual(service.listAttendance(), before);
  assert.equal(clockCalls(), 0);
});

test("una asistencia previa tampoco permite registrar en otra tanda", () => {
  const { service } = setup();
  const before = service.listAttendance();
  assert.deepEqual(service.register({
    ...request, code: "SIM-ALREADY-REGISTERED", slotId: "sim-other-slot",
  }), { outcome: "rejected", reason: "wrong_slot" });
  assert.deepEqual(service.listAttendance(), before);
});

test("un rechazo no impide registrar luego con la fecha correcta", () => {
  const { service } = setup();
  service.register({ ...request, eventDate: "2026-09-26" });
  assert.equal(service.register(request).outcome, "registered");
});

test("no modifica las reservas de entrada ni expone el registro interno", () => {
  const reservations = createSimulatedReservations();
  const original = structuredClone(reservations);
  const service = createLocalCheckIn(reservations, () => new Date(firstTime));
  const result = service.register(request);
  assert.deepEqual(reservations, original);
  result.attendance.checkedInAt = "alterada";
  const listed = service.listAttendance();
  listed.find((item) => item.reservationId === "sim-reservation-1").checkedInAt = "alterada";
  reservations[0].code = "alterado";
  assert.equal(service.register(request).attendance.checkedInAt, firstTime);
});

test("las instancias son independientes: no hay protección entre dispositivos", () => {
  const first = setup().service;
  const second = setup().service;
  assert.equal(first.register(request).outcome, "registered");
  assert.equal(second.register(request).outcome, "registered");
});

for (const field of ["id", "code"]) {
  test(`rechaza datos iniciales ambiguos con ${field} duplicado`, () => {
    const reservations = createSimulatedReservations();
    reservations[1][field] = reservations[0][field];
    assert.throws(() => createLocalCheckIn(reservations), /únicos/);
  });
}
