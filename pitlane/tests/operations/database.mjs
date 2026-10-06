import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";

// Only the Supabase platform schemas are minimal fixtures. All application SQL
// below is loaded verbatim from the actual versioned migrations.
export async function createDatabase() {
  const db = new PGlite();
  await initializeDatabase(db);
  return db;
}
export async function initializeDatabase(db) {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table storage.buckets(id text primary key,name text,public boolean);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant usage on schema public,auth,storage to anon,authenticated;
    grant select on storage.objects to authenticated;
    alter default privileges in schema public grant all on tables to anon,authenticated;
  `);
  const directory = new URL("../../supabase/migrations/", import.meta.url);
  for (const name of (await readdir(directory))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    await db.exec(await readFile(new URL(name, directory), "utf8"));
  }
}

export const users = {
  pilot: "00000000-0000-4000-8000-000000000001",
  other: "00000000-0000-4000-8000-000000000002",
  staff: "00000000-0000-4000-8000-000000000003",
  payments: "00000000-0000-4000-8000-000000000004",
  kre_admin: "00000000-0000-4000-8000-000000000005",
  system_admin: "00000000-0000-4000-8000-000000000006",
};
export async function seed(db) {
  for (const [role, id] of Object.entries(users)) {
    await db.query(
      `insert into auth.users(id,raw_user_meta_data) values($1,jsonb_build_object('full_name',$2::text))`,
      [id, role],
    );
    await db.query(`update public.profiles set role=$1 where id=$2`, [
      role === "other" ? "pilot" : role,
      id,
    ]);
  }
  const e = (
    await db.query(`insert into events(date,status,start_time,end_time) values(
    (clock_timestamp() at time zone 'America/El_Salvador')::date,'open','00:00','23:59') returning id`)
  ).rows[0].id;
  const s = (
    await db.query(
      `insert into slots(event_id,starts_at,ends_at,track_reserved_spots)
    values($1,clock_timestamp()+interval '2 minutes',clock_timestamp()+interval '12 minutes',2) returning id`,
      [e],
    )
  ).rows[0].id;
  const pkg = (
    await db.query(`select id from packages where name='Individual'`)
  ).rows[0].id;
  const second = (
    await db.query(`select id from packages where name='Segunda vuelta'`)
  ).rows[0].id;
  const r = (
    await db.query(
      `insert into reservations(user_id,slot_id,package_id,spots,amount,status,rules_accepted_at,expires_at)
    values($1,$2,$3,1,15,'payment_review',now(),now()+interval '10 minutes') returning id,code,qr_token`,
      [users.pilot, s, pkg],
    )
  ).rows[0];
  const participant = (
    await db.query(
      `insert into reservation_participants(reservation_id,full_name,is_holder) values($1,'Piloto Uno',true) returning id`,
      [r.id],
    )
  ).rows[0].id;
  const payment = (
    await db.query(
      `insert into payments(reservation_id,amount,method,reference,last4,receipt_path,status)
    values($1,15,'bank_transfer','REF-1','1234','test/receipt.png','uploaded') returning id`,
      [r.id],
    )
  ).rows[0].id;
  await db.exec(
    `insert into storage.objects(bucket_id,name) values('payment-receipts','test/receipt.png')`,
  );
  return {
    event: e,
    slot: s,
    pkg,
    second,
    reservation: r.id,
    code: r.code,
    token: r.qr_token,
    participant,
    payment,
  };
}
export async function asUser(db, role, work) {
  await db.exec("savepoint user_work");
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [
    users[role],
  ]);
  await db.exec("set role authenticated");
  try {
    return await work();
  } catch (error) {
    await db.exec("rollback to savepoint user_work");
    throw error;
  } finally {
    await db.exec("reset role");
    await db.exec(`select set_config('request.jwt.claim.sub','',false)`);
    await db.exec("release savepoint user_work");
  }
}
