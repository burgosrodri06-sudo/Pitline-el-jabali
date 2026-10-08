import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { bootstrap, fixture, asUser } from "../reservations/database.mjs";

let db;
before(async () => { db = new PGlite(); await bootstrap(db); });
after(async () => { await db?.close(); });

async function occupied({ web = 5, track = 5, reserved = 2, status = "paid" } = {}) {
  const ids = await fixture(db, { capacity: 10, track: reserved });
  await db.query("update profiles set role='kre_admin' where id=$1", [ids.other]);
  // Seed persisted sales; the edit itself runs under authenticated admin RLS.
  for (const [channel, count] of [["track", track], ["web", web]]) {
    if (count) await db.query(`insert into reservations(user_id,slot_id,package_id,spots,amount,status,channel,expires_at,rules_accepted_at)
      values($1,$2,$3,$4,15,$5,$6,now()+interval '1 hour',now())`, [ids.user, ids.slot, ids.individual, count, status, channel]);
  }
  return ids;
}
const edit = (ids, capacity, reserved) => asUser(db, ids.other, () => db.query(
  "update slots set capacity=$2,track_reserved_spots=$3 where id=$1", [ids.slot, capacity, reserved]));
const snapshot = async ids => (await db.query(`select capacity,track_reserved_spots,
  (select coalesce(sum(spots),0)::int from reservations where slot_id=s.id) as sold
  from slots s where id=$1`, [ids.slot])).rows[0];

test("regresión Andrés: 5 pista + 5 web no permiten capacidad 8 al quitar el apartado", async () => {
  const ids = await occupied();
  await assert.rejects(edit(ids, 8, 0), /cupos ya reservados/);
  assert.deepEqual(await snapshot(ids), { capacity: 10, track_reserved_spots: 2, sold: 10 });
});

test("reducir solo apartado no libera ventas; ajustes válidos siguen permitidos", async () => {
  const ids = await occupied();
  await edit(ids, 10, 0);
  assert.equal((await db.query("select slot_available_spots($1) n", [ids.slot])).rows[0].n, 0);
  await assert.rejects(edit(ids, 9, 0), /cupos ya reservados/);
  const spare = await occupied({ web: 3, track: 2 });
  await edit(spare, 5, 0);
  assert.deepEqual(await snapshot(spare), { capacity: 5, track_reserved_spots: 0, sold: 5 });
  await edit(spare, 8, 3);
  assert.equal((await db.query("select slot_available_spots($1) n", [spare.slot])).rows[0].n, 2);
  await assert.rejects(edit(spare, 8, 6), /cupos ya reservados/);
});

test("capacidad protege reservas en revisión, retenciones vigentes y ventas de un solo canal", async () => {
  for (const opts of [
    { status: "payment_review" }, { status: "pending_payment" },
    { web: 0, track: 10 }, { web: 8, track: 0 },
  ]) {
    const ids = await occupied(opts);
    await assert.rejects(edit(ids, (opts.web ?? 5) + (opts.track ?? 5) - 1, 0), /cupos ya reservados/);
  }
});

test("las retenciones vencidas y cancelaciones liberan cupos para una reducción válida", async () => {
  for (const status of ["pending_payment", "cancelled", "expired"]) {
    const ids = await occupied({ status });
    if (status === "pending_payment") await db.query("update reservations set expires_at=now()-interval '1 second' where slot_id=$1", [ids.slot]);
    await edit(ids, 1, 0);
    assert.equal((await snapshot(ids)).capacity, 1);
  }
});

test("historial de asistencia conserva su protección y el cálculo interno no queda expuesto", async () => {
  const ids = await occupied({ web: 1, track: 0, reserved: 0, status: "attended" });
  await assert.rejects(edit(ids, 9, 0), /historial de asistencia/);
  await assert.rejects(asUser(db, ids.user, () => db.query(
    "select operations_slot_web_balance($1,10,0)", [ids.slot])), /permission denied/);
  const publicAvailability = await asUser(db, null, () => db.query(
    "select available_spots from slot_availability where slot_id=$1", [ids.slot]), "anon");
  assert.equal(publicAvailability.rows[0].available_spots, 9);
});

test("upgrade desde el orden remoto reportado: comprobantes antes de operaciones y corrección", async () => {
  const operations = await readFile(new URL("../../supabase/migrations/20261008003200_rodrigo_operations.sql", import.meta.url), "utf8");
  const correction = await readFile(new URL("../../supabase/migrations/20261008003300_align_operations_capacity_guard.sql", import.meta.url), "utf8");
  const upgrade = new PGlite();
  try {
    // Verify the natural filename order; never reorder migrations in the test.
    const applied = [];
    await bootstrap({ exec: async sql => {
      if (sql === operations) {
        const state = (await upgrade.query("select to_regclass('public.payment_receipt_attempts') receipts,to_regclass('public.operation_slot_closures') operations")).rows[0];
        assert.ok(state.receipts);
        assert.equal(state.operations, null);
        applied.push("operations");
      }
      if (sql === correction) {
        assert.deepEqual(applied, ["operations"]);
        assert.ok((await upgrade.query("select to_regclass('public.operation_slot_closures') operations")).rows[0].operations);
        applied.push("correction");
      }
      return upgrade.exec(sql);
    }});
    assert.deepEqual(applied, ["operations", "correction"]);
    const ids = await fixture(upgrade, { capacity: 10, track: 2 });
    await upgrade.query("update profiles set role='kre_admin' where id=$1", [ids.other]);
    for (const channel of ["track", "web"]) await upgrade.query(
      `insert into reservations(user_id,slot_id,package_id,spots,amount,status,channel,rules_accepted_at)
       values($1,$2,$3,5,50,'paid',$4,now())`, [ids.user,ids.slot,ids.friends,channel]);
    await assert.rejects(asUser(upgrade, ids.other, () => upgrade.query(
      "update slots set capacity=8,track_reserved_spots=0 where id=$1", [ids.slot])), /cupos ya reservados/);
    assert.equal((await upgrade.query("select capacity from slots where id=$1", [ids.slot])).rows[0].capacity, 10);
  } finally { await upgrade.close(); }
});
