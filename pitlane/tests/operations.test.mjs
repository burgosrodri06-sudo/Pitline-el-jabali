import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canAccessOperation,
  canDisplayQr,
  creditableAmountCents,
  validateFirstRideCompletion,
  validatePaymentReview,
  validateSecondRide,
} from "../lib/operations/rules.ts";
import {
  summarizeOperations,
  toOperationsCsv,
} from "../lib/operations/reports.ts";
import { reservationCalendar } from "../lib/operations/calendar.ts";

const payment = {
  role: "payments",
  action: "approve",
  reservationStatus: "payment_review",
  paymentStatus: "uploaded",
  isTrackCash: false,
  amountCents: 1500,
  reservationTotalCents: 1500,
};
const ride = {
  participantId: "participant-1",
  reservationId: "reservation-1",
  reservationStatus: "paid",
  checkedInAt: "2026-10-10T00:00:00Z",
  firstRideCompletedAt: null,
};

test("permisos: staff no aprueba pagos y payments no opera la pista", () => {
  for (const role of ["pilot", "staff", "kre_admin"]) {
    assert.equal(
      validatePaymentReview({ ...payment, role }).reason,
      "forbidden",
    );
  }
  for (const role of ["payments", "system_admin"]) {
    assert.equal(validatePaymentReview({ ...payment, role }).ok, true);
  }
  assert.equal(canAccessOperation("payments", "track"), false);
  assert.equal(canAccessOperation("kre_admin", "reports"), true);
  assert.equal(canAccessOperation("payments", "reports"), true);
  assert.equal(canAccessOperation("staff", "reports"), false);
});

test("solo paid y attended muestran QR; revisión y cancelación no lo habilitan", () => {
  for (const status of [
    "pending_payment",
    "payment_review",
    "cancelled",
    "expired",
    "no_show",
  ]) {
    assert.equal(canDisplayQr(status), false);
  }
  assert.equal(canDisplayQr("paid"), true);
  assert.equal(canDisplayQr("attended"), true);
});

test("aprobar requiere revisión pendiente y el importe exacto", () => {
  assert.equal(validatePaymentReview(payment).ok, true);
  for (const amountCents of [1499, 1501]) {
    assert.equal(
      validatePaymentReview({ ...payment, amountCents }).reason,
      "amount_mismatch",
    );
  }
  for (const amountCents of [
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.equal(
      validatePaymentReview({ ...payment, amountCents }).reason,
      "invalid_amount",
    );
  }
  for (const reservationStatus of [
    "paid",
    "cancelled",
    "expired",
    "no_show",
    "attended",
    "pending_payment",
  ]) {
    assert.equal(
      validatePaymentReview({ ...payment, reservationStatus }).ok,
      false,
    );
  }
  for (const paymentStatus of [
    "pending",
    "approved",
    "reconciled",
    "rejected",
  ]) {
    assert.equal(
      validatePaymentReview({ ...payment, paymentStatus }).ok,
      false,
    );
  }
});

test("rechazar exige motivo y permite señalar un monto incorrecto", () => {
  assert.equal(
    validatePaymentReview({ ...payment, action: "reject", reason: "  " }).ok,
    false,
  );
  assert.equal(
    validatePaymentReview({
      ...payment,
      action: "reject",
      reason: "Monto incorrecto",
      amountCents: 1000,
    }).ok,
    true,
  );
  assert.equal(
    validatePaymentReview({
      ...payment,
      action: "reject",
      reason: "x".repeat(1001),
    }).ok,
    false,
  );
});

test("conciliar requiere pago aprobado, no vuelve a aprobar y excluye efectivo", () => {
  const input = {
    ...payment,
    action: "reconcile",
    paymentStatus: "approved",
    reservationStatus: "paid",
  };
  assert.equal(validatePaymentReview(input).ok, true);
  assert.equal(
    validatePaymentReview({ ...input, paymentStatus: "reconciled" }).ok,
    false,
  );
  for (const action of ["approve", "reject", "reconcile"]) {
    assert.equal(
      validatePaymentReview({ ...input, action, isTrackCash: true }).reason,
      "track_cash_not_reviewable",
    );
  }
});

test("primera vuelta exige check-in y personal autorizado; no se completa dos veces", () => {
  assert.equal(validateFirstRideCompletion("staff", ride).ok, true);
  assert.equal(validateFirstRideCompletion("pilot", ride).reason, "forbidden");
  assert.equal(
    validateFirstRideCompletion("staff", { ...ride, checkedInAt: null }).reason,
    "check_in_required",
  );
  assert.equal(
    validateFirstRideCompletion("staff", {
      ...ride,
      reservationStatus: "payment_review",
    }).ok,
    false,
  );
  assert.equal(
    validateFirstRideCompletion("staff", {
      ...ride,
      firstRideCompletedAt: "2026-10-10T00:10:00Z",
    }).reason,
    "ride_already_completed",
  );
});

test("segunda vuelta exige finalización real del mismo participante, no del grupo", () => {
  assert.equal(
    validateSecondRide("participant-1", ride).reason,
    "first_ride_not_completed",
  );
  const completed = { ...ride, firstRideCompletedAt: "2026-10-10T00:10:00Z" };
  assert.equal(validateSecondRide("participant-1", completed).ok, true);
  assert.equal(
    validateSecondRide("participant-2", completed).reason,
    "participant_evidence_required",
  );
  assert.equal(validateSecondRide("participant-1", null).ok, false);
  assert.equal(
    validateSecondRide("participant-1", { ...completed, checkedInAt: null }).ok,
    false,
  );
  assert.equal(
    validateSecondRide("participant-1", {
      ...completed,
      firstRideCompletedAt: "invalid",
    }).ok,
    false,
  );
  assert.equal(
    validateSecondRide("participant-1", {
      ...completed,
      firstRideCompletedAt: "2026-10-09T23:59:00Z",
    }).ok,
    false,
  );
});

test("crédito parte de pagos aprobados/conciliados y descuenta TODO crédito emitido", () => {
  const payments = [
    { id: "p1", status: "reconciled", amountCents: 5000 },
    { id: "p2", status: "rejected", amountCents: 5000 },
    { id: "p3", status: "uploaded", amountCents: 5000 },
  ];
  assert.equal(
    creditableAmountCents(payments, [{ id: "c1", amountCents: 1500 }]),
    3500,
  );
  assert.equal(
    creditableAmountCents(payments, [{ id: "c1", amountCents: 5000 }]),
    0,
  );
  assert.throws(() =>
    creditableAmountCents(payments, [{ id: "c1", amountCents: 5001 }]),
  );
  assert.throws(() => creditableAmountCents([...payments, payments[0]], []));
  assert.throws(() =>
    creditableAmountCents(payments, [
      { id: "c1", amountCents: 100 },
      { id: "c1", amountCents: 100 },
    ]),
  );
  assert.equal(creditableAmountCents([], []), 0);
});

function facts() {
  return {
    slots: [
      { id: "s1", capacity: 10 },
      { id: "s2", capacity: 10 },
    ],
    reservations: [
      {
        id: "r1",
        slotId: "s1",
        packageId: "friends",
        status: "attended",
        spotsRequired: 5,
      },
      {
        id: "r2",
        slotId: "s2",
        packageId: "individual",
        status: "paid",
        spotsRequired: 1,
      },
    ],
    participants: [
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `u${i}`,
        reservationId: "r1",
        checkedIn: i < 4,
        noShow: i === 4,
      })),
      { id: "u5", reservationId: "r2", checkedIn: false, noShow: false },
    ],
    payments: [
      {
        id: "p1",
        reservationId: "r1",
        status: "reconciled",
        amountCents: 5000,
        isTrackCash: false,
      },
      {
        id: "p2",
        reservationId: "r2",
        status: "approved",
        amountCents: 1500,
        isTrackCash: true,
      },
      {
        id: "p3",
        reservationId: "r1",
        status: "rejected",
        amountCents: 5000,
        isTrackCash: false,
      },
    ],
    credits: [{ id: "c1", reservationId: "r1", amountCents: 1000 }],
  };
}

test("reporte cuenta combo como un paquete y cinco participantes, sin multiplicar pagos", () => {
  const report = summarizeOperations(facts());
  assert.equal(report.capacity, 20);
  assert.equal(report.bookedParticipants, 6);
  assert.equal(report.occupancyPercent, 30);
  assert.equal(report.checkedInParticipants, 4);
  assert.equal(report.noShowParticipants, 1);
  assert.equal(report.noShowPercent, 20); // el piloto pendiente de llegada no es ausencia
  assert.equal(report.webRevenueCents, 5000);
  assert.equal(report.trackCashRevenueCents, 1500);
  assert.equal(report.revenueCents, 6500);
  assert.equal(report.creditsIssuedCents, 1000);
  assert.equal(report.packagesSold.friends, 1);
});

test("reporte vacío devuelve ceros, nunca NaN", () => {
  const report = summarizeOperations({
    slots: [],
    reservations: [],
    participants: [],
    payments: [],
    credits: [],
  });
  assert.equal(report.occupancyPercent, 0);
  assert.equal(report.noShowPercent, 0);
  assert.equal(report.revenueCents, 0);
});

test("cancelación tras un incidente conserva asistencia, ingreso cobrado y crédito separados", () => {
  const input = facts();
  input.reservations[0].status = "cancelled";
  const report = summarizeOperations(input);
  assert.equal(report.checkedInParticipants, 4);
  assert.equal(report.webRevenueCents, 5000);
  assert.equal(report.creditsIssuedCents, 1000);
  assert.equal(report.bookedParticipants, 1);
});

test("reporte rechaza joins duplicados, filas incompletas y asistencia contradictoria", () => {
  for (const key of [
    "slots",
    "reservations",
    "participants",
    "payments",
    "credits",
  ]) {
    const input = facts();
    input[key].push(input[key][0]);
    assert.throws(() => summarizeOperations(input), /duplicadas/);
  }
  const missing = facts();
  missing.participants.pop();
  assert.throws(() => summarizeOperations(missing), /Faltan participantes/);
  const invalid = facts();
  invalid.participants[0].noShow = true;
  assert.throws(() => summarizeOperations(invalid), /inconsistente/);
  const overbooked = facts();
  overbooked.slots[0].capacity = 4;
  assert.throws(() => summarizeOperations(overbooked), /capacidad/);
});

test("CSV escapa comas, comillas, saltos de línea y fórmulas; conserva cifras", () => {
  const csv = toOperationsCsv(
    ["Nombre", "Centavos"],
    [
      ['Piloto, "A"', 1500],
      ['=HYPERLINK("https://example.test")', 0],
      ["  +SUM(1,2)", -10],
      ["\ttexto", 2],
    ],
  );
  assert.ok(csv.startsWith('\uFEFF"Nombre","Centavos"\r\n'));
  assert.ok(csv.includes('"Piloto, ""A""",1500'));
  assert.ok(csv.includes("\"'=HYPERLINK"));
  assert.ok(csv.includes('"\'  +SUM(1,2)",-10'));
  assert.ok(csv.includes('"\'\ttexto",2'));
  assert.throws(() => toOperationsCsv(["Uno"], [["a", "b"]]));
  assert.throws(() => toOperationsCsv(["Uno"], [[NaN]]));
});

test("calendario conserva el horario UTC-6, escapa texto y pliega UTF-8 sin cortar caracteres", () => {
  const calendar = reservationCalendar(
    {
      id: "r1",
      code: "KRE-001",
      packageName: "Individual;\nBEGIN:EVIL," + "ñ".repeat(70),
      startsAt: "2026-10-09T18:00:00-06:00",
      endsAt: "2026-10-09T18:10:00-06:00",
    },
    new Date("2026-10-01T00:00:00Z"),
  );
  assert.ok(
    calendar.includes("DTSTART:20261010T000000Z\r\nDTEND:20261010T001000Z"),
  );
  assert.ok(!calendar.includes("\r\nBEGIN:EVIL"));
  assert.ok(calendar.includes("\\;\\nBEGIN:EVIL\\,"));
  for (const line of calendar.split("\r\n"))
    assert.ok(Buffer.byteLength(line, "utf8") <= 75);
  assert.throws(() =>
    reservationCalendar({
      id: "r",
      code: "c",
      packageName: "p",
      startsAt: "invalid",
      endsAt: "invalid",
    }),
  );
});
