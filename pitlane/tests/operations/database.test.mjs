import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createDatabase, seed, asUser } from "./database.mjs";
let db;
before(async () => {
  db = await createDatabase();
});
after(async () => {
  await db?.close();
});

test("Friends permite asistencia parcial y no hereda la vuelta completada de otro participante", async () => scenario(async f => {
  const pkg = (await db.query("select id from packages where name='Friends Combo'")).rows[0].id;
  const r = (await db.query(`insert into reservations(slot_id,package_id,spots,amount,status,channel) values($1,$2,5,50,'paid','track') returning id,code`, [f.slot,pkg])).rows[0];
  const participants = (await db.query(`insert into reservation_participants(reservation_id,full_name) select $1,'Piloto '||n from generate_series(1,5) n returning id,full_name`, [r.id])).rows;
  await db.query(`insert into payments(reservation_id,amount,method,status) values($1,50,'track_cash','approved')`, [r.id]);
  const mark = id => asUser(db,'staff',()=>db.query('select operations_check_in($1,$2,$3)',[f.slot,r.code,id]));
  assert.equal((await mark(participants[0].id)).rows[0].operations_check_in,1);
  assert.equal((await mark(null)).rows[0].operations_check_in,4);
  assert.equal((await mark(null)).rows[0].operations_check_in,0);
  await db.query(`update slots set starts_at=now()-interval '12 minutes',ends_at=now()-interval '2 minutes' where id=$1`, [f.slot]);
  await asUser(db,'staff',()=>db.query('select operations_complete_ride($1)',[participants[0].id]));
  const next=(await db.query(`insert into slots(event_id,starts_at,ends_at) values($1,now()+interval '20 minutes',now()+interval '30 minutes') returning id`,[f.event])).rows[0].id;
  await denied(()=>asUser(db,'staff',()=>db.query('select operations_track_sale($1,$2,$3,gen_random_uuid(),$4)',[next,f.second,participants[1].full_name,participants[1].id])),/operations_first_ride_required/);
}));
async function scenario(work) {
  await db.exec("begin");
  try {
    await work(await seed(db));
  } finally {
    await db.exec("rollback");
  }
}
async function denied(work, pattern) {
  await db.exec("savepoint denied");
  try {
    await assert.rejects(work, pattern);
  } finally {
    await db.exec("rollback to savepoint denied");
  }
}
test("RLS: propietario, terceros, staff, reportes y comprobantes privados", async () =>
  scenario(async (f) => {
    assert.equal(
      await asUser(
        db,
        "pilot",
        async () => (await db.query("select * from reservations")).rows.length,
      ),
      1,
    );
    assert.equal(
      await asUser(
        db,
        "other",
        async () => (await db.query("select * from reservations")).rows.length,
      ),
      0,
    );
    assert.equal(
      await asUser(
        db,
        "other",
        async () =>
          (await db.query("select * from reservation_participants")).rows
            .length,
      ),
      0,
    );
    assert.equal(
      await asUser(
        db,
        "staff",
        async () => (await db.query("select * from payments")).rows.length,
      ),
      0,
    );
    assert.equal(
      await asUser(
        db,
        "staff",
        async () =>
          (await db.query("select * from storage.objects")).rows.length,
      ),
      0,
    );
    assert.equal(
      await asUser(
        db,
        "payments",
        async () =>
          (await db.query("select * from storage.objects")).rows.length,
      ),
      1,
    );
    await db.query(`update events set status='closed' where id=$1`, [f.event]);
    assert.equal(
      await asUser(
        db,
        "pilot",
        async () => (await db.query("select * from slots")).rows.length,
      ),
      1,
    );
    assert.equal(
      await asUser(
        db,
        "pilot",
        async () => (await db.query("select * from events")).rows.length,
      ),
      1,
    );
    await denied(
      () =>
        asUser(db, "staff", () =>
          db.query(`select operations_review_payment($1,'approve')`, [
            f.payment,
          ]),
        ),
      /operations_forbidden/,
    );
    await denied(
      () =>
        asUser(db, "pilot", () =>
          db.query(
            `insert into attendance(participant_id,reservation_id) values($1,$2)`,
            [f.participant, f.reservation],
          ),
        ),
      /permission denied/,
    );
  }));
test("SQL real: aprobación → QR → check-in único → vuelta completada → efectivo → reporte", async () =>
  scenario(async (f) => {
    await asUser(db, "payments", () =>
      db.query(`select operations_review_payment($1,'approve')`, [f.payment]),
    );
    await asUser(db, "payments", () =>
      db.query(`select operations_review_payment($1,'approve')`, [f.payment]),
    );
    assert.equal(
      (
        await db.query("select status from reservations where id=$1", [
          f.reservation,
        ])
      ).rows[0].status,
      "paid",
    );
    const first = await asUser(db, "staff", () =>
      db.query("select operations_check_in($1,$2)", [
        f.slot,
        "pitlane:qr:" + f.token,
      ]),
    );
    assert.equal(first.rows[0].operations_check_in, 1);
    assert.equal(
      (
        await asUser(db, "staff", () =>
          db.query("select operations_check_in($1,$2)", [f.slot, f.code]),
        )
      ).rows[0].operations_check_in,
      0,
    );
    await denied(
      () =>
        asUser(db, "staff", () =>
          db.query("select operations_complete_ride($1)", [f.participant]),
        ),
      /operations_ride_not_ready/,
    );
    await db.query(
      `update slots set starts_at=now()-interval '12 minutes',ends_at=now()-interval '2 minutes' where id=$1`,
      [f.slot],
    );
    await asUser(db, "staff", () =>
      db.query("select operations_complete_ride($1)", [f.participant]),
    );
    const next = (
      await db.query(
        `insert into slots(event_id,starts_at,ends_at) values($1,now()+interval '20 minutes',now()+interval '30 minutes') returning id`,
        [f.event],
      )
    ).rows[0].id;
    const request = "00000000-0000-4000-8000-000000000099";
    const sold = (
      await asUser(db, "staff", () =>
        db.query("select operations_track_sale($1,$2,$3,$4,$5)", [
          next,
          f.second,
          "Piloto Uno",
          request,
          f.participant,
        ]),
      )
    ).rows[0].operations_track_sale;
    assert.equal(
      (
        await asUser(db, "staff", () =>
          db.query("select operations_track_sale($1,$2,$3,$4,$5)", [
            next,
            f.second,
            "Piloto Uno",
            request,
            f.participant,
          ]),
        )
      ).rows[0].operations_track_sale,
      sold,
    );
    assert.equal(
      (
        await db.query(
          "select status,method from payments where reservation_id=$1",
          [sold],
        )
      ).rows[0].method,
      "track_cash",
    );
    const report = (
      await asUser(db, "kre_admin", () =>
        db.query(`select operations_report(current_date-1,current_date+1)`),
      )
    ).rows[0].operations_report;
    assert.equal(report.payments.length, 2);
    assert.equal(
      report.payments.reduce((n, p) => n + p.amountCents, 0),
      2500,
    );
    assert.ok(report.payments.every((p) => !("receipt_path" in p)));
  }));
test("capacidad: track no descuenta dos veces; attended sigue consumiendo; sobreventa revierte", async () =>
  scenario(async (f) => {
    assert.equal(
      (await db.query("select slot_available_spots($1)", [f.slot])).rows[0]
        .slot_available_spots,
      7,
    );
    await asUser(db, "staff", () =>
      db.query("select operations_track_sale($1,$2,$3,gen_random_uuid())", [
        f.slot,
        f.pkg,
        "Walk-in",
      ]),
    );
    assert.equal(
      (await db.query("select slot_available_spots($1)", [f.slot])).rows[0]
        .slot_available_spots,
      7,
    );
    await db.query(`update reservations set status='attended' where id=$1`, [
      f.reservation,
    ]);
    assert.equal(
      (await db.query("select slot_available_spots($1)", [f.slot])).rows[0]
        .slot_available_spots,
      7,
    );
    await db.query(
      "update slots set capacity=2,track_reserved_spots=1 where id=$1",
      [f.slot],
    );
    await denied(
      () =>
        asUser(db, "staff", () =>
          db.query("select operations_track_sale($1,$2,$3,gen_random_uuid())", [
            f.slot,
            f.pkg,
            "No cabe",
          ]),
        ),
      /operations_insufficient_capacity/,
    );
    assert.equal(
      (await db.query("select count(*)::int n from reservations")).rows[0].n,
      2,
    );
  }));
test("rechazo exige motivo; crédito no duplica monto ni expone saldo ajeno", async () =>
  scenario(async (f) => {
    await denied(
      () =>
        asUser(db, "payments", () =>
          db.query(`select operations_review_payment($1,'reject',' ')`, [
            f.payment,
          ]),
        ),
      /operations_reason_required/,
    );
    await asUser(db, "payments", () =>
      db.query(`select operations_review_payment($1,'approve')`, [f.payment]),
    );
    await asUser(db, "kre_admin", () =>
      db.query(`select operations_create_credit($1,'Incidente en pista')`, [
        f.reservation,
      ]),
    );
    assert.equal(
      (await db.query("select amount from credits")).rows[0].amount,
      "15.00",
    );
    await denied(
      () =>
        asUser(db, "kre_admin", () =>
          db.query(`select operations_create_credit($1,'Reintento')`, [
            f.reservation,
          ]),
        ),
      /operations_credit_exhausted/,
    );
    assert.equal(
      await asUser(
        db,
        "other",
        async () => (await db.query("select * from credits")).rows.length,
      ),
      0,
    );
    assert.equal(
      await asUser(
        db,
        "pilot",
        async () => (await db.query("select * from credits")).rows.length,
      ),
      1,
    );
  }));
test("cierre registra ausencias una vez y bloquea check-in tardío", async () =>
  scenario(async (f) => {
    await asUser(db, "payments", () =>
      db.query(`select operations_review_payment($1,'approve')`, [f.payment]),
    );
    await db.query(
      `update slots set starts_at=now()-interval '12 minutes',ends_at=now()-interval '2 minutes' where id=$1`,
      [f.slot],
    );
    assert.equal(
      (
        await asUser(db, "staff", () =>
          db.query("select operations_close_slot($1)", [f.slot]),
        )
      ).rows[0].operations_close_slot,
      1,
    );
    assert.equal(
      (
        await asUser(db, "staff", () =>
          db.query("select operations_close_slot($1)", [f.slot]),
        )
      ).rows[0].operations_close_slot,
      0,
    );
    assert.equal(
      (
        await db.query("select status from reservations where id=$1", [
          f.reservation,
        ])
      ).rows[0].status,
      "no_show",
    );
    await denied(
      () =>
        asUser(db, "staff", () =>
          db.query("select operations_check_in($1,$2)", [f.slot, f.code]),
        ),
      /operations_slot_unavailable/,
    );
  }));
