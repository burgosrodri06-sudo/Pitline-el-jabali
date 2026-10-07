import assert from "node:assert/strict";
import test from "node:test";
import { validateReservationPreparation } from "../domain/reservations/preparation.ts";
import { bookingLoginHref, resizeParticipants } from "../app/reservar/booking-form.ts";

const participant = (fullName) => ({ fullName });
const draft = (names, waiverAccepted = true) => ({
  participants: names.map(participant),
  waiverAccepted,
});

test("Individual requiere exactamente un participante", () => {
  assert.equal(validateReservationPreparation(draft(["Ana Pérez"]), 1).valid, true);
  assert.equal(validateReservationPreparation(draft([]), 1).valid, false);
  assert.equal(validateReservationPreparation(draft(["Ana", "Luis"]), 1).valid, false);
});

test("Friends exige cinco nombres; no acepta grupos parciales ni adicionales", () => {
  const names = ["Ana", "Luis", "Eva", "José", "María"];
  assert.equal(validateReservationPreparation(draft(names), 5).valid, true);
  assert.equal(validateReservationPreparation(draft(names.slice(0, 4)), 5).valid, false);
  assert.equal(validateReservationPreparation(draft([...names, "Leo"]), 5).valid, false);
  assert.equal(validateReservationPreparation(draft([...names.slice(0, 4), "  "]), 5).valid, false);
});

test("aceptar reglas es obligatorio, incluso con nombres válidos", () => {
  const result = validateReservationPreparation(draft(["Ana"], false), 1);
  assert.equal(result.valid, false);
  assert.ok(result.errors.waiver);
});

test("rechaza nombre vacío o mayor de 120 caracteres y permite el límite", () => {
  for (const name of ["", " \t\n ", "a".repeat(121)]) {
    const result = validateReservationPreparation(draft([name]), 1);
    assert.equal(result.valid, false);
    assert.ok(result.errors.participants[0]);
  }
  assert.equal(validateReservationPreparation(draft(["a".repeat(120)]), 1).valid, true);
});

test("normaliza extremos sin mutar el borrador ni restringir nombres reales", () => {
  const input = draft(["  María-José O’Neill  "]);
  const result = validateReservationPreparation(input, 1);
  assert.equal(result.valid, true);
  assert.deepEqual(result.data.participants, [participant("María-José O’Neill")]);
  assert.equal(input.participants[0].fullName, "  María-José O’Neill  ");
});

test("personas distintas pueden compartir nombre", () => {
  assert.equal(validateReservationPreparation(draft(Array(5).fill("Ana Pérez")), 5).valid, true);
});

test("sin paquete válido no habilita preparación", () => {
  for (const count of [0, -1, 1.5, 11, NaN]) {
    assert.equal(validateReservationPreparation(draft(["Ana"]), count).valid, false);
  }
});

test("cambiar Individual a Friends conserva principal y pide cuatro nombres nuevos", () => {
  const individual = [participant("Ana")];
  const friends = resizeParticipants(individual, 5);
  assert.deepEqual(friends, [participant("Ana"), ...Array.from({ length: 4 }, () => participant(""))]);
  assert.equal(validateReservationPreparation({ participants: friends, waiverAccepted: true }, 5).valid, false);
  assert.deepEqual(individual, [participant("Ana")]);
});

test("cambiar Friends a Individual descarta los adicionales y no los resucita", () => {
  const friends = ["Ana", "Luis", "Eva", "José", "María"].map(participant);
  const individual = resizeParticipants(friends, 1);
  assert.deepEqual(individual, [participant("Ana")]);
  assert.deepEqual(resizeParticipants(individual, 5).slice(1), Array.from({ length: 4 }, () => participant("")));
  assert.equal(friends.length, 5);
});

test("login conserva evento, tanda y paquete sin incluir datos personales", () => {
  const href = bookingLoginHref({ dateId: "event-1", slotId: "slot-1", packageId: "friends", participants: [participant("Privado")] });
  const login = new URL(href, "https://pitlane.test");
  const destination = new URL(login.searchParams.get("next"), login.origin);
  assert.equal(login.pathname, "/login");
  assert.equal(destination.pathname, "/reservar");
  assert.deepEqual([...destination.searchParams], [["evento", "event-1"], ["tanda", "slot-1"], ["paquete", "friends"]]);
  assert.equal(href.includes("Privado"), false);
});

test("retorno de login siempre es local aunque los IDs contengan caracteres de URL", () => {
  const value = "//externo.test/?next=/admin&x=1#fragment";
  const login = new URL(bookingLoginHref({ dateId: value }), "https://pitlane.test");
  const destination = new URL(login.searchParams.get("next"), login.origin);
  assert.equal(destination.origin, login.origin);
  assert.equal(destination.pathname, "/reservar");
  assert.equal(destination.searchParams.get("evento"), value);
  assert.equal(destination.searchParams.size, 1);
  assert.equal(destination.hash, "");
});

test("login permite selección parcial y entrada sin parámetros", () => {
  const next = (selection) => new URL(bookingLoginHref(selection), "https://pitlane.test").searchParams.get("next");
  assert.equal(next({}), "/reservar");
  assert.equal(next({ dateId: "event-1" }), "/reservar?evento=event-1");
});
