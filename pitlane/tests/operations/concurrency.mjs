import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import EmbeddedPostgres from "embedded-postgres";
import { initializeDatabase, seed, users } from "./database.mjs";

// Dedicated, randomly named local cluster. Never accepts an external DB URL.
const directory = await mkdtemp(join(tmpdir(), "pitlane-operations-pg-"));
const probe = createServer();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const cluster = new EmbeddedPostgres({
  databaseDir: join(directory, "data"),
  port,
  user: "postgres",
  password: randomUUID(),
  persistent: true,
  createPostgresUser: false,
  postgresFlags: ["-h", "127.0.0.1"],
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
  onError: () => {},
});
const clients = [];
async function connect(role) {
  const c = cluster.getPgClient("postgres", "127.0.0.1");
  await c.connect();
  clients.push(c);
  if (role) {
    await c.query(`select set_config('request.jwt.claim.sub',$1,false)`, [
      users[role],
    ]);
    await c.query("set role authenticated");
  }
  return c;
}
async function waitForLock(admin, pid) {
  for (let i = 0; i < 200; i++) {
    const { rows } = await admin.query(
      "select wait_event_type from pg_stat_activity where pid=$1",
      [pid],
    );
    if (rows[0]?.wait_event_type === "Lock") return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(
    "The competing transaction did not block on a database lock.",
  );
}
async function race(admin, a, b, first, second) {
  await a.query("begin");
  try {
    const one = await first();
    const pid = (await b.query("select pg_backend_pid() pid")).rows[0].pid;
    // Attach rejection immediately; an expected constraint failure is not unhandled.
    const competing = second().then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    await waitForLock(admin, pid);
    await a.query("commit");
    return [one, await competing];
  } catch (e) {
    await a.query("rollback");
    throw e;
  }
}
try {
  await cluster.initialise();
  await cluster.start();
  const admin = await connect();
  const db = {
    exec: (sql) => admin.query(sql),
    query: (sql, args) => admin.query(sql, args),
  };
  await initializeDatabase(db);
  const f = await seed(db);
  const a = await connect("staff");
  const b = await connect("staff");
  const paymentsA = await connect("payments");
  const paymentsB = await connect("payments");
  const [approval, repeatedApproval] = await race(
    admin,
    paymentsA,
    paymentsB,
    () =>
      paymentsA.query(`select operations_review_payment($1,'approve')`, [
        f.payment,
      ]),
    () =>
      paymentsB.query(`select operations_review_payment($1,'approve')`, [
        f.payment,
      ]),
  );
  assert.equal(approval.rows[0].operations_review_payment, f.reservation);
  assert.ok(repeatedApproval.value);
  assert.equal(
    (
      await admin.query(
        `select count(*)::int n from audit_logs where action='payment_approve'`,
      )
    ).rows[0].n,
    1,
  );
  console.log("PASS: two reviewers approve once.");
  await admin.query(
    "update slots set capacity=2,track_reserved_spots=1 where id=$1",
    [f.slot],
  );
  const [checkin, repeatedCheckin] = await race(
    admin,
    a,
    b,
    () => a.query("select operations_check_in($1,$2)", [f.slot, f.code]),
    () => b.query("select operations_check_in($1,$2)", [f.slot, f.code]),
  );
  assert.equal(checkin.rows[0].operations_check_in, 1);
  assert.equal(repeatedCheckin.value.rows[0].operations_check_in, 0);
  assert.equal(
    (await admin.query("select count(*)::int n from attendance")).rows[0].n,
    1,
  );
  console.log("PASS: two QR readers produce one attendance record.");
  const [, soldOut] = await race(
    admin,
    a,
    b,
    () =>
      a.query("select operations_track_sale($1,$2,$3,$4)", [
        f.slot,
        f.pkg,
        "Last seat A",
        randomUUID(),
      ]),
    () =>
      b.query("select operations_track_sale($1,$2,$3,$4)", [
        f.slot,
        f.pkg,
        "Last seat B",
        randomUUID(),
      ]),
  );
  assert.match(
    soldOut.error?.message ?? "",
    /operations_insufficient_capacity/,
  );
  assert.equal(
    (
      await admin.query(
        "select sum(spots)::int n from reservations where slot_id=$1",
        [f.slot],
      )
    ).rows[0].n,
    2,
  );
  console.log("PASS: simultaneous cash sales cannot oversell the last seat.");
  const next = (
    await admin.query(
      `insert into slots(event_id,starts_at,ends_at,capacity) values($1,now()+interval '20 minutes',now()+interval '30 minutes',1) returning id`,
      [f.event],
    )
  ).rows[0].id;
  const web = await connect("pilot");
  const [, webBlocked] = await race(
    admin,
    a,
    web,
    () =>
      a.query("select operations_track_sale($1,$2,$3,$4)", [
        next,
        f.pkg,
        "Cash",
        randomUUID(),
      ]),
    () =>
      web.query(
        `select create_reservation($1,$2,$3::jsonb,$4,true)`,
        [next, f.pkg, JSON.stringify([{ full_name: "Web" }]), randomUUID()],
      ),
  );
  assert.match(
    webBlocked.error?.message ?? "",
    /insufficient_capacity/,
  );
  console.log(
    "PASS: Gabriel's create_reservation and track sale share the same capacity lock.",
  );
  const ca = await connect("kre_admin");
  const cb = await connect("kre_admin");
  const [, duplicateCredit] = await race(
    admin,
    ca,
    cb,
    () =>
      ca.query(`select operations_create_credit($1,'Incident')`, [
        f.reservation,
      ]),
    () =>
      cb.query(`select operations_create_credit($1,'Repeated incident')`, [
        f.reservation,
      ]),
  );
  assert.match(
    duplicateCredit.error?.message ?? "",
    /operations_credit_exhausted/,
  );
  assert.equal(
    (await admin.query("select sum(amount)::text n from credits")).rows[0].n,
    "15.00",
  );
  console.log("PASS: concurrent credits never exceed the amount paid.");
} finally {
  await Promise.allSettled(clients.map((c) => c.end()));
  await cluster.stop();
  // Retain the uniquely-created temp cluster for diagnosis; no recursive deletion.
}
