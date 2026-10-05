import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { bootstrap, fixture, asUser, reserve } from "./database.mjs";

let db;
before(async () => { db = new PGlite(); await bootstrap(db); });
after(async () => { await db?.close(); });

test("migraciones reales: Individual y Friends consumen 1 y 5, con todos sus participantes", async () => {
  const ids = await fixture(db);
  const one = await asUser(db, ids.user, () => reserve(db, ids));
  const five = await asUser(db, ids.user, () => reserve(db, ids, { packageId: ids.friends, names: ["A", "B", "C", "D", "E"] }));
  assert.equal(one.rows[0].reservation.spots_snapshot, 1);
  assert.equal(one.rows[0].reservation.price_cents_snapshot, 1500);
  assert.equal(five.rows[0].reservation.spots_snapshot, 5);
  assert.equal(five.rows[0].reservation.price_cents_snapshot, 5000);
  const { rows } = await db.query("select count(*)::int as count from public.reservation_participants where reservation_id=$1", [five.rows[0].reservation.id]);
  assert.equal(rows[0].count, 5);
});

test("no sobrevende y respeta cupos de pista; combo nunca parcial", async () => {
  const ids = await fixture(db, { capacity: 10, track: 5 });
  await asUser(db, ids.user, () => reserve(db, ids, { packageId: ids.friends, names: ["A", "B", "C", "D", "E"] }));
  await assert.rejects(asUser(db, ids.other, () => reserve(db, ids)), /insufficient_capacity/);
  const { rows } = await db.query("select count(*)::int as count, sum(spots_snapshot)::int as spots from public.reservations where slot_id=$1", [ids.slot]);
  assert.deepEqual(rows[0], { count: 1, spots: 5 });
});

test("idempotencia por usuario, payload normalizado y conflicto material", async () => {
  const ids = await fixture(db);
  const key = randomUUID();
  const first = await asUser(db, ids.user, () => reserve(db, ids, { key, names: [" Ana "] }));
  const retry = await asUser(db, ids.user, () => reserve(db, ids, { key }));
  assert.deepEqual(retry.rows, first.rows);
  await assert.rejects(asUser(db, ids.user, () => reserve(db, ids, { key, names: ["Otra persona"] })), /idempotency_conflict/);
  await assert.rejects(asUser(db, ids.user, () => reserve(db, ids, { key, version: "otra-version" })), /idempotency_conflict/);
  await assert.rejects(asUser(db, ids.user, () => reserve(db, ids, { key, packageId: ids.friends })), /idempotency_conflict/);
  const other = await asUser(db, ids.other, () => reserve(db, ids, { key }));
  assert.notEqual(other.rows[0].reservation.id, first.rows[0].reservation.id);
});

test("snapshot conserva precio/cupos tras editar catálogo; reintento no recalcula", async () => {
  const ids = await fixture(db);
  const key = randomUUID();
  const first = await asUser(db, ids.user, () => reserve(db, ids, { key }));
  await db.query("update public.packages set price_cents=9000,spots_required=3,active=false where id=$1", [ids.individual]);
  assert.deepEqual((await asUser(db, ids.user, () => reserve(db, ids, { key }))).rows, first.rows);
  await assert.rejects(db.query("update public.reservations set spots_snapshot=2 where id=$1", [first.rows[0].reservation.id]), /immutable_reservation_snapshot/);
});

test("RLS separa usuarios y permite lectura operativa con los roles existentes", async () => {
  const ids = await fixture(db);
  await asUser(db, ids.user, () => reserve(db, ids));
  const read = () => db.query("select * from public.reservations where slot_id=$1", [ids.slot]);
  assert.equal((await asUser(db, ids.user, read)).rows.length, 1);
  assert.equal((await asUser(db, ids.other, read)).rows.length, 0);
  assert.equal((await asUser(db, ids.other, () => db.query("select p.* from public.reservation_participants p join public.reservations r on r.id=p.reservation_id where r.slot_id=$1", [ids.slot]))).rows.length, 0);
  for (const role of ["staff", "payments", "kre_admin", "system_admin"]) {
    await db.query("update public.profiles set role=$1 where id=$2", [role, ids.other]);
    assert.equal((await asUser(db, ids.other, read)).rows.length, 1);
  }
});

test("pilot no inserta ni altera reservas, snapshots, participantes o capacidad", async () => {
  const ids = await fixture(db);
  for (const sql of [
    "insert into public.reservations default values",
    "update public.reservations set status='paid'",
    "update public.reservations set price_cents_snapshot=1, spots_snapshot=1",
    "delete from public.reservations",
    "insert into public.reservation_participants default values",
    "update public.slots set capacity=10",
    "update public.reservation_settings set hold_minutes=60",
  ]) await assert.rejects(asUser(db, ids.user, () => db.exec(sql)), /permission denied/);
  await assert.rejects(asUser(db, ids.user, () => db.query("select public.create_reservation($1,$2,'[]'::jsonb,$3,true,'test-only-v1',1,1)", [ids.slot, ids.individual, randomUUID()])), /does not exist/);
});

test("participantes incorrectos y waiver ausente no dejan filas", async () => {
  const ids = await fixture(db);
  for (const options of [{ names: [] }, { names: [" "] }, { names: ["a".repeat(121)] }, { names: ["A", "B"] }, { waiver: false }, { version: "inventada" }]) {
    await assert.rejects(asUser(db, ids.user, () => reserve(db, ids, options)));
  }
  await assert.rejects(asUser(db, ids.user, () => reserve(db, ids, { packageId: ids.friends, names: ["A", "B", "C", "D"] })), /participant_count_mismatch/);
  const { rows } = await db.query("select count(*)::int as count from public.reservations where slot_id=$1", [ids.slot]);
  assert.equal(rows[0].count, 0);
});

test("constraint diferible revierte el padre si falta un participante", async () => {
  const ids = await fixture(db);
  await assert.rejects(asUser(db, ids.user, async () => {
    const result = await reserve(db, ids);
    await db.exec("reset role");
    await db.query("delete from public.reservation_participants where reservation_id=$1", [result.rows[0].reservation.id]);
  }), /participant_count_mismatch/);
  assert.equal((await db.query("select count(*)::int as n from public.reservations where slot_id=$1", [ids.slot])).rows[0].n, 0);
});

test("vencida libera cupo antes de cleanup; expiración es restringida e idempotente", async () => {
  const ids = await fixture(db, { capacity: 1 });
  const expired = randomUUID();
  const key = randomUUID();
  await db.exec("begin");
  await db.query(`insert into public.reservations(id,user_id,slot_id,package_id,package_name_snapshot,price_cents_snapshot,spots_snapshot,
    expires_at,idempotency_key,request_payload,waiver_version,waiver_accepted_at,created_at)
    values($1,$2,$3,$4,'Individual',1500,1,now()-interval '1 minute',$5,$6::jsonb,'test-only-v1',now()-interval '20 minutes',now()-interval '20 minutes')`,
  [expired, ids.user, ids.slot, ids.individual, key, JSON.stringify({ slot_id: ids.slot, package_id: ids.individual, participants: [{ full_name: "Ana" }], waiver_version: "test-only-v1" })]);
  await db.query("insert into public.reservation_participants(reservation_id,position,full_name) values($1,1,'Ana')", [expired]);
  await db.exec("commit");
  const available = await asUser(db, null, () => db.query("select * from public.get_slot_availability() where slot_id=$1", [ids.slot]), "anon");
  assert.equal(available.rows[0].available_spots, 1);
  const replay = await asUser(db, ids.user, () => reserve(db, ids, { key }));
  assert.equal(replay.rows[0].reservation.id, expired);
  assert.ok(Date.parse(replay.rows[0].reservation.expires_at) < Date.now());
  await asUser(db, ids.other, () => reserve(db, ids));
  await assert.rejects(asUser(db, ids.user, () => db.query("select public.expire_reservations()")), /permission denied/);
  assert.equal((await asUser(db, null, () => db.query("select public.expire_reservations() as n"), "service_role")).rows[0].n, 1);
  assert.equal((await db.query("select public.expire_reservations() as n")).rows[0].n, 0);
  assert.equal((await asUser(db, ids.user, () => reserve(db, ids, { key }))).rows[0].reservation.status, "expired");
});

test("catálogo privado/cerrado y sin autenticación no permite reservar", async () => {
  const ids = await fixture(db);
  await assert.rejects(asUser(db, null, () => reserve(db, ids)), /authentication_required/);
  await assert.rejects(asUser(db, null, () => reserve(db, ids), "anon"), /permission denied/);
  await db.query("update public.events set status='draft' where id=$1", [ids.event]);
  assert.equal((await asUser(db, null, () => db.query("select * from public.events where id=$1", [ids.event]), "anon")).rows.length, 0);
  await assert.rejects(asUser(db, ids.user, () => reserve(db, ids)), /event_unavailable/);
});

test("slot cerrado/iniciado y paquete inactivo son rechazados", async () => {
  const ids = await fixture(db);
  await db.query("update public.slots set status='closed' where id=$1", [ids.slot]);
  await assert.rejects(asUser(db, ids.user, () => reserve(db, ids)), /slot_unavailable/);
  await db.query("update public.slots set status='open' where id=$1", [ids.slot]);
  await db.query("update public.packages set active=false where id=$1", [ids.individual]);
  await assert.rejects(asUser(db, ids.user, () => reserve(db, ids)), /package_unavailable/);
  await db.query("update public.packages set active=true where id=$1", [ids.individual]);
  await db.query("update public.slots set starts_at=now()-interval '1 minute',ends_at=now()+interval '9 minutes' where id=$1", [ids.slot]);
  await assert.rejects(asUser(db, ids.user, () => reserve(db, ids)), /slot_unavailable/);
});

test("configuración pendiente de waiver bloquea creación y DB calcula retención", async () => {
  const ids = await fixture(db);
  await db.exec("update public.reservation_settings set active_waiver_version=null");
  await assert.rejects(asUser(db, ids.user, () => reserve(db, ids)), /waiver_unavailable/);
  await db.exec("update public.reservation_settings set active_waiver_version='test-only-v1',hold_minutes=1");
  const result = await asUser(db, ids.user, () => reserve(db, ids));
  const row = (await db.query("select extract(epoch from expires_at-created_at)::int as seconds from public.reservations where id=$1", [result.rows[0].reservation.id])).rows[0];
  assert.equal(row.seconds, 60);
  await db.exec("update public.reservation_settings set hold_minutes=15");
});

test("estados activos consumen capacidad; cancelled y expired la liberan", async () => {
  for (const status of ["payment_review", "paid", "attended", "no_show", "cancelled", "expired"]) {
    const ids = await fixture(db, { capacity: 1 });
    const result = await asUser(db, ids.user, () => reserve(db, ids));
    await db.query("update public.reservations set status=$1 where id=$2", [status, result.rows[0].reservation.id]);
    if (["cancelled", "expired"].includes(status)) await asUser(db, ids.other, () => reserve(db, ids));
    else await assert.rejects(asUser(db, ids.other, () => reserve(db, ids)), /insufficient_capacity/);
  }
});

test("seed separado exige opt-in y puede repetirse sin duplicar catálogo", async () => {
  const sql = await readFile(new URL("../../supabase/dev/reservation-catalog.sql", import.meta.url), "utf8");
  await assert.rejects(db.exec(sql), /explicit local opt-in/);
  await db.exec("set pitlane.allow_development_seed='yes'");
  await db.exec(sql);
  await db.exec(sql);
  const { rows } = await db.query("select code,price_cents,spots_required from public.packages where code in ('individual','friends') order by code");
  assert.deepEqual(rows, [{ code: "friends", price_cents: 5000, spots_required: 5 }, { code: "individual", price_cents: 1500, spots_required: 1 }]);
});
