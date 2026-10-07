// Native PostgreSQL only: independent connections and real lock waits.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { bootstrap, fixture, asUser, reserve } from "./database.mjs";

const raw = process.env.RESERVATION_TEST_ADMIN_URL;
if (!raw) throw new Error("Set RESERVATION_TEST_ADMIN_URL to a disposable LOCAL PostgreSQL admin connection. Never use Supabase shared credentials.");
const url = new URL(raw);
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("Only loopback test databases are accepted");
const admin = new pg.Client({ connectionString: raw });
const database = `pitlane_test_${randomUUID().replaceAll("-", "")}`;
const clients = [];
const wrap = client => ({ query: (sql, args) => client.query(sql, args), exec: sql => client.query(sql) });
await admin.connect();
let created = false;
try {
  await admin.query(`create database "${database}"`);
  created = true;
  url.pathname = `/${database}`;
  for (let i = 0; i < 3; i++) {
    const client = new pg.Client({ connectionString: url.toString() });
    await client.connect();
    clients.push(client);
    await client.query("set statement_timeout='15s'");
  }
  const [setup, first, second] = clients.map(wrap);
  await bootstrap(setup);
  // Observer proves that the second transaction waits for the first, rather
  // than merely sending two requests that might run sequentially by chance.
  const secondPid = (await second.query("select pg_backend_pid() as pid")).rows[0].pid;
  async function waitForLock() {
    for (let i = 0; i < 100; i++) {
      const result = await setup.query("select wait_event_type from pg_stat_activity where pid=$1", [secondPid]);
      if (result.rows[0]?.wait_event_type === "Lock") return;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw new Error("Second connection did not demonstrably wait on a lock");
  }
  async function race({ capacity, combo = false, sameKey = false }) {
    const ids = await fixture(setup, { capacity });
    const options = { key: randomUUID(), ...(combo ? { packageId: ids.friends, names: ["A", "B", "C", "D", "E"] } : {}) };
    await first.exec("begin; set local role authenticated");
    await first.query("select set_config('request.jwt.claim.sub',$1,true)", [ids.user]);
    const original = await reserve(first, ids, options);
    const competing = asUser(second, sameKey ? ids.user : ids.other, () => reserve(second, ids, { ...options, key: sameKey ? options.key : randomUUID() }))
      .then(value => ({ value }), error => ({ error }));
    await waitForLock();
    await first.exec("commit");
    const result = await competing;
    if (sameKey) assert.deepEqual(result.value.rows, original.rows);
    else assert.match(result.error?.message ?? "", /insufficient_capacity/);
    const rows = (await setup.query("select spots from public.reservations where slot_id=$1", [ids.slot])).rows;
    assert.deepEqual(rows, [{ spots: combo ? 5 : 1 }]);
    const available = (await setup.query("select public.slot_available_spots($1) as n", [ids.slot])).rows[0].n;
    assert.equal(available, capacity - (combo ? 5 : 1));
  }
  await race({ capacity: 1 });
  await race({ capacity: 9, combo: true });
  await race({ capacity: 1, sameKey: true });
  console.log("PASS: last spot, indivisible combos, concurrent idempotency (3 real lock-wait scenarios)");
} finally {
  await Promise.all(clients.map(client => client.end()));
  if (created) await admin.query(`drop database "${database}"`);
  await admin.end();
}
