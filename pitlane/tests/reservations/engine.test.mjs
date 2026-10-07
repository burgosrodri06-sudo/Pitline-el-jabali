import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { bootstrap, fixture, asUser, reserve } from "./database.mjs";

let db;
before(async () => { db = new PGlite(); await bootstrap(db); });
after(async () => { await db?.close(); });
const availability = async slot => (await db.query("select public.slot_available_spots($1) as n", [slot])).rows[0].n;

test("main migrations run unchanged, including the three official packages", async () => {
  const { rows } = await db.query("select name,price::float,spots,eligibility from public.packages order by price");
  assert.deepEqual(rows, [
    { name: "Segunda vuelta", price: 10, spots: 1, eligibility: "requires_first_ride" },
    { name: "Individual", price: 15, spots: 1, eligibility: "none" },
    { name: "Friends Combo", price: 50, spots: 5, eligibility: "none" },
  ]);
  assert.equal((await db.query("select to_regclass('public.reservation_settings') as settings")).rows[0].settings, null);
});

test("Individual and Friends persist trusted snapshots, exact participants and one holder", async () => {
  const ids = await fixture(db);
  for (const [packageId, names, amount] of [[ids.individual, [" Ana "], 15], [ids.friends, ["A", "B", "C", "D", "E"], 50]]) {
    const receipt = (await asUser(db, ids.user, () => reserve(db, ids, { packageId, names }))).rows[0].reservation;
    assert.equal(receipt.amount, amount);
    assert.equal(receipt.spots, names.length);
    assert.equal(receipt.status, "pending_payment");
    const row = (await db.query("select *, extract(epoch from expires_at-created_at)::int as hold from public.reservations where id=$1", [receipt.id])).rows[0];
    assert.equal(row.user_id, ids.user);
    assert.equal(row.created_by, ids.user);
    assert.equal(row.channel, "web");
    assert.equal(row.hold, 900);
    assert.ok(row.rules_accepted_at);
    assert.ok(row.qr_token);
    const participants = (await db.query("select full_name,is_holder,first_ride_participant_id from public.reservation_participants where reservation_id=$1", [receipt.id])).rows;
    assert.equal(participants.length, names.length);
    assert.deepEqual(participants.map(p => p.full_name).sort(), names.map(n => n.trim()).sort());
    assert.deepEqual(participants.filter(p => p.is_holder).map(p => p.full_name), [names[0].trim()]);
    assert.ok(participants.every(p => p.first_ride_participant_id === null));
  }
  assert.equal(await availability(ids.slot), 4);
});

test("DB price/spots are authoritative; retries preserve snapshots after catalog edits", async () => {
  const ids = await fixture(db);
  await db.query("update public.packages set price=17.35,spots=5 where id=$1", [ids.individual]);
  await assert.rejects(asUser(db, ids.user, () => reserve(db, ids)), /participant_count_mismatch/);
  const options = { key: randomUUID(), names: ["A", "B", "C", "D", "E"] };
  const first = await asUser(db, ids.user, () => reserve(db, ids, options));
  assert.equal(first.rows[0].reservation.amount, 17.35);
  assert.equal(first.rows[0].reservation.spots, 5);
  await db.query("update public.packages set price=99,spots=1,active=false where id=$1", [ids.individual]);
  assert.deepEqual((await asUser(db, ids.user, () => reserve(db, ids, options))).rows, first.rows);
});

test("idempotency is per user; material changes including participant order conflict", async () => {
  const ids = await fixture(db);
  const key = randomUUID();
  const first = await asUser(db, ids.user, () => reserve(db, ids, { key, names: [" Ana "] }));
  assert.deepEqual((await asUser(db, ids.user, () => reserve(db, ids, { key }))).rows, first.rows);
  for (const options of [{ names: ["Otra"] }, { packageId: ids.friends }]) {
    await assert.rejects(asUser(db, ids.user, () => reserve(db, ids, { key, ...options })), /idempotency_conflict/);
  }
  await assert.rejects(asUser(db, ids.user, () => reserve(db, { ...ids, slot: randomUUID() }, { key })), /idempotency_conflict/);
  assert.notEqual((await asUser(db, ids.other, () => reserve(db, ids, { key }))).rows[0].reservation.id, first.rows[0].reservation.id);
  const combo = { key: randomUUID(), packageId: ids.friends, names: ["A", "B", "B", "D", "E"] };
  await asUser(db, ids.user, () => reserve(db, ids, combo));
  await assert.rejects(asUser(db, ids.user, () => reserve(db, ids, { ...combo, names: ["B", "A", "B", "D", "E"] })), /idempotency_conflict/);
});

test("official capacity rejects a second booking and never splits Friends", async () => {
  const ids = await fixture(db, { capacity: 10, track: 5 });
  await asUser(db, ids.user, () => reserve(db, ids, { packageId: ids.friends, names: ["A", "B", "C", "D", "E"] }));
  await assert.rejects(asUser(db, ids.other, () => reserve(db, ids)), /insufficient_capacity/);
  assert.equal(await availability(ids.slot), 0);
  const partial = await fixture(db, { capacity: 4 });
  await assert.rejects(asUser(db, partial.user, () => reserve(db, partial, { packageId: partial.friends, names: ["A", "B", "C", "D", "E"] })), /insufficient_capacity/);
  assert.equal(await availability(partial.slot), 4);
});

test("expired pending holds free spots via the official function without cleanup", async () => {
  const ids = await fixture(db, { capacity: 1 });
  const key = randomUUID();
  const first = (await asUser(db, ids.user, () => reserve(db, ids, { key }))).rows[0].reservation;
  await db.query("update public.reservations set expires_at=now()-interval '1 minute' where id=$1", [first.id]);
  assert.equal(await availability(ids.slot), 1);
  const view = await asUser(db, null, () => db.query("select available_spots from public.slot_availability where slot_id=$1", [ids.slot]), "anon");
  assert.equal(view.rows[0].available_spots, 1);
  const retry = (await asUser(db, ids.user, () => reserve(db, ids, { key }))).rows[0].reservation;
  assert.equal(retry.id, first.id);
  assert.ok(Date.parse(retry.expiresAt) < Date.now());
  await asUser(db, ids.other, () => reserve(db, ids));
  assert.equal(await availability(ids.slot), 0);
});

test("capacity follows main's status semantics, including attended/no_show", async () => {
  for (const status of ["payment_review", "paid", "attended", "no_show", "cancelled", "expired"]) {
    const ids = await fixture(db, { capacity: 1 });
    const row = (await asUser(db, ids.user, () => reserve(db, ids))).rows[0].reservation;
    await db.query("update public.reservations set status=$1 where id=$2", [status, row.id]);
    if (["payment_review", "paid", "attended", "no_show"].includes(status)) await assert.rejects(asUser(db, ids.other, () => reserve(db, ids)), /insufficient_capacity/);
    else await asUser(db, ids.other, () => reserve(db, ids));
  }
});

test("RLS isolates owners/participants and enables the four operational roles", async () => {
  const ids = await fixture(db);
  const receipt = (await asUser(db, ids.user, () => reserve(db, ids))).rows[0].reservation;
  const reservations = () => db.query("select id from public.reservations where id=$1", [receipt.id]);
  const participants = () => db.query("select id from public.reservation_participants where reservation_id=$1", [receipt.id]);
  assert.equal((await asUser(db, ids.user, reservations)).rows.length, 1);
  assert.equal((await asUser(db, ids.user, participants)).rows.length, 1);
  assert.equal((await asUser(db, ids.other, reservations)).rows.length, 0);
  assert.equal((await asUser(db, ids.other, participants)).rows.length, 0);
  for (const role of ["staff", "payments", "kre_admin", "system_admin"]) {
    await db.query("update public.profiles set role=$1 where id=$2", [role, ids.other]);
    assert.equal((await asUser(db, ids.other, reservations)).rows.length, 1);
    assert.equal((await asUser(db, ids.other, participants)).rows.length, 1);
  }
});

test("API roles cannot bypass RPC with direct writes", async () => {
  const ids = await fixture(db);
  await asUser(db, ids.user, () => reserve(db, ids));
  for (const role of ["authenticated", "anon", "service_role"]) {
    for (const sql of [
      "insert into public.reservations default values",
      "update public.reservations set amount=1,spots=1,status='paid'",
      "update public.reservations set user_id=null,channel='track'",
      "delete from public.reservations",
      "insert into public.reservation_participants default values",
      "update public.reservation_participants set is_holder=true",
      "delete from public.reservation_participants",
    ]) await assert.rejects(asUser(db, ids.user, () => db.exec(sql), role), /permission denied/);
  }
});

test("authentication and acceptance are mandatory; second lap is rejected", async () => {
  const ids = await fixture(db);
  await assert.rejects(asUser(db, null, () => reserve(db, ids)), /authentication_required/);
  for (const role of ["anon", "service_role"]) await assert.rejects(asUser(db, null, () => reserve(db, ids), role), /permission denied/);
  for (const rules of [false, null]) await assert.rejects(asUser(db, ids.user, () => reserve(db, ids, { rules })), /rules_required/);
  const second = (await db.query("select id from public.packages where eligibility='requires_first_ride' limit 1")).rows[0].id;
  await assert.rejects(asUser(db, ids.user, () => reserve(db, ids, { packageId: second })), /package_unavailable/);
});

test("unconfirmed email is rejected even with forged metadata; verified email enables creation", async () => {
  const ids = await fixture(db);
  await db.query(`update auth.users set email_confirmed_at=null,
    raw_user_meta_data='{"email_verified":true,"email_confirmed_at":"2026-01-01"}' where id=$1`, [ids.user]);
  await assert.rejects(asUser(db, ids.user, () => reserve(db, ids)), /email_verification_required/);
  assert.equal((await db.query("select id from public.reservations where slot_id=$1", [ids.slot])).rows.length, 0);
  await db.query("update auth.users set email_confirmed_at=now() where id=$1", [ids.user]);
  await asUser(db, ids.user, () => reserve(db, ids));
});

test("near slot hold is positive and expires strictly before start", async () => {
  const ids = await fixture(db);
  await db.query("update public.slots set starts_at=clock_timestamp()+interval '2 minutes', ends_at=clock_timestamp()+interval '12 minutes' where id=$1", [ids.slot]);
  await db.query("update public.events set date=(select (starts_at at time zone 'America/El_Salvador')::date from public.slots where id=$1) where id=$2", [ids.slot, ids.event]);
  const receipt = (await asUser(db, ids.user, () => reserve(db, ids))).rows[0].reservation;
  const row = (await db.query(`select r.expires_at > r.created_at as positive,
    r.expires_at < s.starts_at as before_start, r.expires_at <= r.created_at+interval '15 minutes' as bounded
    from public.reservations r join public.slots s on s.id=r.slot_id where r.id=$1`, [receipt.id])).rows[0];
  assert.deepEqual(row, { positive: true, before_start: true, bounded: true });
});

test("invalid names/count/holder injection leave no reservations", async () => {
  const ids = await fixture(db);
  for (const names of [[], [" "], ["a".repeat(121)], ["A", "B"]]) await assert.rejects(asUser(db, ids.user, () => reserve(db, ids, { names })));
  for (const payload of [null, {}, [null], [{ full_name: 1 }], [{ full_name: "Ana", is_holder: true }]]) {
    await assert.rejects(asUser(db, ids.user, () => db.query("select public.create_reservation($1,$2,$3::jsonb,$4,true)", [ids.slot, ids.individual, JSON.stringify(payload), randomUUID()])), /invalid_participants/);
  }
  assert.equal((await db.query("select id from public.reservations where slot_id=$1", [ids.slot])).rows.length, 0);
});

test("participant insert failure rolls back parent and idempotency key atomically", async () => {
  const ids = await fixture(db);
  await db.exec(`create function public.test_participant_failure() returns trigger language plpgsql as $$
    begin raise exception 'test_participant_failure'; end $$;
    create trigger test_participant_failure before insert on public.reservation_participants
    for each row execute function public.test_participant_failure();`);
  const key = randomUUID();
  try {
    await assert.rejects(asUser(db, ids.user, () => reserve(db, ids, { key })), /test_participant_failure/);
    assert.equal((await db.query("select id from public.reservations where slot_id=$1", [ids.slot])).rows.length, 0);
  } finally { await db.exec("drop trigger test_participant_failure on public.reservation_participants; drop function public.test_participant_failure()"); }
  await asUser(db, ids.user, () => reserve(db, ids, { key }));
});

test("closed/past slots, events and inactive/date-ineligible packages are rejected", async () => {
  const ids = await fixture(db);
  await db.query("update public.events set status='draft' where id=$1", [ids.event]);
  await assert.rejects(asUser(db, ids.user, () => reserve(db, ids)), /event_unavailable/);
  await db.query("update public.events set status='open' where id=$1", [ids.event]);
  await db.query("update public.slots set status='closed' where id=$1", [ids.slot]);
  await assert.rejects(asUser(db, ids.user, () => reserve(db, ids)), /slot_unavailable/);
  await db.query("update public.slots set status='available' where id=$1", [ids.slot]);
  await db.query("update public.packages set active=false where id=$1", [ids.individual]);
  await assert.rejects(asUser(db, ids.user, () => reserve(db, ids)), /package_unavailable/);
  await db.query("update public.packages set active=true,valid_from=current_date+10 where id=$1", [ids.individual]);
  await assert.rejects(asUser(db, ids.user, () => reserve(db, ids)), /package_unavailable/);
  await db.query("update public.packages set valid_from=null where id=$1", [ids.individual]);
  await db.query("update public.slots set starts_at=clock_timestamp()-interval '1 second' where id=$1", [ids.slot]);
  await assert.rejects(asUser(db, ids.user, () => reserve(db, ids)), /slot_unavailable/);
});

test("RPC privileges/search_path and stale transaction isolation fail closed", async () => {
  const acl = (await db.query(`select p.prosecdef,p.proconfig,
    exists(select 1 from aclexplode(p.proacl) a where a.grantee=0 and a.privilege_type='EXECUTE') as public_execute
    from pg_proc p where p.oid='public.create_reservation(uuid,uuid,jsonb,uuid,boolean)'::regprocedure`)).rows[0];
  assert.equal(acl.prosecdef, true);
  assert.equal(acl.public_execute, false);
  assert.ok(acl.proconfig.includes('search_path=""'));
  assert.ok(acl.proconfig.includes('row_security=off'));
  const ids = await fixture(db);
  await db.exec("begin isolation level repeatable read");
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [ids.user]);
    await assert.rejects(reserve(db, ids), /read_committed_required/);
  } finally { await db.exec("rollback"); }
});
