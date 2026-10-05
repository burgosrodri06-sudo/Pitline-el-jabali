import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { bootstrap, fixture, asUser, reserve } from "./database.mjs";

let db;
before(async () => { db = new PGlite(); await bootstrap(db); });
after(async () => { await db?.close(); });

test("configuración inicial es producción/oficial y no habilita waiver alguno", async () => {
  const { rows } = await db.query("select deployment_environment,waiver_mode,active_waiver_version from public.reservation_settings");
  assert.deepEqual(rows, [{ deployment_environment: "production", waiver_mode: "official", active_waiver_version: null }]);
});

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
  await assert.rejects(asUser(db, ids.user, () => db.query("select public.create_reservation($1,$2,'[]'::jsonb,$3,true,'DEV-ONLY:automated-tests',1,1)", [ids.slot, ids.individual, randomUUID()])), /does not exist/);
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
    values($1,$2,$3,$4,'Individual',1500,1,now()-interval '1 minute',$5,$6::jsonb,'DEV-ONLY:automated-tests',now()-interval '20 minutes',now()-interval '20 minutes')`,
  [expired, ids.user, ids.slot, ids.individual, key, JSON.stringify({ slot_id: ids.slot, package_id: ids.individual, participants: [{ full_name: "Ana" }], waiver_version: "DEV-ONLY:automated-tests" })]);
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
  await db.exec("update public.reservation_settings set active_waiver_version='DEV-ONLY:automated-tests',hold_minutes=1");
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
  const settingsBefore = (await db.query("select * from public.reservation_settings")).rows;
  const sql = await readFile(new URL("../../supabase/dev/reservation-catalog.sql", import.meta.url), "utf8");
  await assert.rejects(db.exec(sql), /explicit local opt-in/);
  await db.exec("set pitlane.allow_development_seed='yes'");
  await db.exec(sql);
  await db.exec(sql);
  const { rows } = await db.query("select code,price_cents,spots_required from public.packages where code in ('individual','friends') order by code");
  assert.deepEqual(rows, [{ code: "friends", price_cents: 5000, spots_required: 5 }, { code: "individual", price_cents: 1500, spots_required: 1 }]);
  assert.deepEqual((await db.query("select * from public.reservation_settings")).rows, settingsBefore);
});

test("waiver de prueba requiere entorno no productivo Y modo test; producción rechaza DEV-ONLY", async () => {
  const ids = await fixture(db);
  await db.exec("update public.reservation_settings set deployment_environment='production',waiver_mode='official',active_waiver_version=null");
  for (const version of ["DEV-ONLY", "dev-only:example", "DEV-ONLY:automated-tests"]) {
    await assert.rejects(db.query("update public.reservation_settings set active_waiver_version=$1", [version]), /waiver_environment_guard/);
  }
  await assert.rejects(db.exec("update public.reservation_settings set waiver_mode='test'"), /waiver_environment_guard/);
  await assert.rejects(asUser(db, ids.user, () => reserve(db, ids)), /waiver_unavailable/);
  // GUCs set by a caller are NOT trusted environment flags.
  await assert.rejects(asUser(db, ids.user, async () => {
    await db.exec("set local pitlane.deployment_environment='staging'; set local pitlane.allow_test_waiver='yes'");
    return reserve(db, ids);
  }), /waiver_unavailable/);
  await db.exec("update public.reservation_settings set deployment_environment='staging'");
  await assert.rejects(db.exec("update public.reservation_settings set active_waiver_version='DEV-ONLY:automated-tests'"), /waiver_environment_guard/);
  await db.exec("update public.reservation_settings set waiver_mode='test',active_waiver_version='DEV-ONLY:automated-tests'");
  const created = await asUser(db, ids.user, () => reserve(db, ids));
  const row = (await db.query("select waiver_version from public.reservations where id=$1", [created.rows[0].reservation.id])).rows[0];
  assert.equal(row.waiver_version, "DEV-ONLY:automated-tests");
  await assert.rejects(db.exec("update public.reservation_settings set deployment_environment='production'"), /waiver_environment_guard/);
  await db.exec("update public.reservation_settings set deployment_environment='production',waiver_mode='official',active_waiver_version=null");
});

test("ningún rol API puede habilitar el waiver de prueba, incluyendo system_admin y service_role", async () => {
  const ids = await fixture(db);
  for (const profileRole of ["pilot", "staff", "payments", "kre_admin", "system_admin"]) {
    await db.query("update public.profiles set role=$1 where id=$2", [profileRole, ids.user]);
    await assert.rejects(asUser(db, ids.user, () => db.exec("update public.reservation_settings set deployment_environment='staging'")), /permission denied/);
    const visible = await asUser(db, ids.user, () => db.query("select * from public.reservation_settings"));
    assert.equal(visible.rows.length, profileRole === "system_admin" ? 1 : 0);
  }
  for (const role of ["anon", "service_role"]) {
    await assert.rejects(asUser(db, null, () => db.exec("update public.reservation_settings set waiver_mode='test'"), role), /permission denied/);
  }
});

test("ACL explícitas sobreviven grants por defecto; nuevas funciones sin EXECUTE de PUBLIC", async () => {
  const signatures = [
    ["public.reservation_touch_updated_at()", false, false, false],
    ["public.protect_reservation_snapshot()", false, false, false],
    ["public.check_reservation_participants()", false, false, false],
    ["public.create_reservation(uuid,uuid,jsonb,uuid,boolean,text)", false, true, false],
    ["public.expire_reservations(integer)", false, false, true],
    ["public.get_slot_availability()", true, true, false],
  ];
  for (const [signature, anon, authenticated, serviceRole] of signatures) {
    const { rows } = await db.query(`select
      has_function_privilege('anon',p.oid,'EXECUTE') as anon,
      has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated,
      has_function_privilege('service_role',p.oid,'EXECUTE') as service,
      exists(select from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') as public_execute,
      p.proconfig from pg_proc p where p.oid=$1::regprocedure`, [signature]);
    assert.deepEqual({ ...rows[0], proconfig: undefined }, { anon, authenticated, service: serviceRole, public_execute: false, proconfig: undefined });
    assert.ok(rows[0].proconfig.some(value => value === 'search_path=""'), signature);
  }
});

test("profiles/auth.uid/has_role: metadata no concede roles y pilot no eleva privilegios", async () => {
  const id = randomUUID();
  await db.query("insert into auth.users(id,raw_user_meta_data) values($1,'{\"role\":\"system_admin\",\"full_name\":\"Ana\"}')", [id]);
  const own = await asUser(db, id, () => db.query("select auth.uid() as id,public.get_my_role() as role, public.has_role(array['system_admin']) as admin"));
  assert.deepEqual(own.rows[0], { id, role: "pilot", admin: false });
  await assert.rejects(asUser(db, id, () => db.query("update public.profiles set role='system_admin' where id=$1", [id])), /No puedes cambiar tu propio rol/);
  assert.equal((await asUser(db, null, () => db.query("select public.has_role(array['system_admin']) as admin"), "anon")).rows[0].admin, false);
  // Legacy PUBLIC grants on trigger functions are not callable privileged RPCs.
  for (const fn of ["handle_new_user", "protect_role_change"]) {
    await assert.rejects(asUser(db, id, () => db.query(`select public.${fn}()`)), /trigger functions can only be called as triggers/);
  }
});

test("disponibilidad cuenta reservas ajenas sin exponerlas ni revelar contadores internos", async () => {
  const ids = await fixture(db, { capacity: 10, track: 2 });
  await asUser(db, ids.user, () => reserve(db, ids));
  for (const [user, role] of [[null, "anon"], [ids.other, "authenticated"]]) {
    const result = await asUser(db, user, () => db.query("select * from public.get_slot_availability() where slot_id=$1", [ids.slot]), role);
    assert.deepEqual(result.rows, [{ slot_id: ids.slot, available_spots: 7 }]);
    for (const column of ["allocation_version", "updated_at"]) {
      await assert.rejects(asUser(db, user, () => db.query(`select ${column} from public.slots where id=$1`, [ids.slot]), role), /permission denied/);
    }
    const slots = await asUser(db, user, () => db.query("select id,capacity from public.slots where id=$1", [ids.slot]), role);
    assert.deepEqual(slots.rows, [{ id: ids.slot, capacity: 10 }]);
  }
  const otherNames = await asUser(db, ids.other, () => db.query("select full_name from public.reservation_participants where reservation_id in (select id from public.reservations where slot_id=$1)", [ids.slot]));
  assert.deepEqual(otherNames.rows, []);
  await assert.rejects(asUser(db, null, () => db.query("select * from public.reservations"), "anon"), /permission denied/);
  for (const change of ["update public.slots set status='closed' where id=$1", "update public.slots set status='open', starts_at=starts_at-interval '3 days',ends_at=ends_at-interval '3 days' where id=$1"]) {
    await db.query(change, [ids.slot]);
    assert.deepEqual((await asUser(db, null, () => db.query("select * from public.get_slot_availability() where slot_id=$1", [ids.slot]), "anon")).rows, []);
  }
  const privateEvent = await fixture(db);
  await db.query("update public.events set status='draft' where id=$1", [privateEvent.event]);
  assert.deepEqual((await asUser(db, null, () => db.query("select * from public.get_slot_availability() where slot_id=$1", [privateEvent.slot]), "anon")).rows, []);
});

test("vencimiento se limita al inicio y siempre es posterior a created_at", async () => {
  const ids = await fixture(db);
  await db.query("update public.events set event_date=(now() at time zone 'America/El_Salvador')::date where id=$1", [ids.event]);
  await db.query("update public.slots set starts_at=now()+interval '2 minutes',ends_at=now()+interval '12 minutes' where id=$1", [ids.slot]);
  const result = await asUser(db, ids.user, () => reserve(db, ids));
  const { rows } = await db.query("select r.expires_at=s.starts_at as clamped,r.expires_at>r.created_at as positive from public.reservations r join public.slots s on s.id=r.slot_id where r.id=$1", [result.rows[0].reservation.id]);
  assert.deepEqual(rows, [{ clamped: true, positive: true }]);
});

test("tanda que inicia durante la asignación produce slot_unavailable y revierte todo", async () => {
  const ids = await fixture(db);
  await db.exec(`create function public.test_allocation_delay() returns trigger language plpgsql as $$
    begin perform pg_sleep(0.75); return new; end $$;
    create trigger test_allocation_delay before update of allocation_version on public.slots
    for each row execute function public.test_allocation_delay();`);
  try {
    // Set both date and timestamps together to handle the operational midnight boundary.
    await db.query("update public.events set event_date=((clock_timestamp()+interval '0.5 seconds') at time zone 'America/El_Salvador')::date where id=$1", [ids.event]);
    await db.query("update public.slots set starts_at=statement_timestamp()+interval '0.5 seconds',ends_at=statement_timestamp()+interval '10 minutes 0.5 seconds' where id=$1", [ids.slot]);
    await assert.rejects(asUser(db, ids.user, () => reserve(db, ids)), error => error.code === "22023" && error.message === "slot_unavailable");
    const { rows } = await db.query("select allocation_version::int as version,(select count(*)::int from public.reservations where slot_id=$1) as reservations from public.slots where id=$1", [ids.slot]);
    assert.deepEqual(rows, [{ version: 0, reservations: 0 }]);
  } finally {
    await db.exec("drop trigger test_allocation_delay on public.slots; drop function public.test_allocation_delay()");
  }
});
