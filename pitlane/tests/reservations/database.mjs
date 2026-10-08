import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";

// Only for disposable test databases. Auth identity emulates Supabase's JWT GUC.
export async function bootstrap(db) {
  await db.exec(`
    do $$ begin
      if not exists(select from pg_roles where rolname='anon') then create role anon nologin; end if;
      if not exists(select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
      if not exists(select from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
    end $$;
    create schema auth;
    -- Storage prerequisite only: schema_base runs unchanged.
    create schema storage;
    create table storage.buckets(id text primary key, name text, public boolean);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, metadata jsonb, unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon,authenticated,service_role;
    grant all on storage.objects to anon,authenticated,service_role;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}', email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    -- Match the API grants enabled in supabase/config.toml. Migrations must
    -- explicitly revoke these instead of passing only on vanilla PostgreSQL.
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  `);
  const directory = new URL("../../supabase/migrations/", import.meta.url);
  for (const name of (await readdir(directory)).filter(name => name.endsWith(".sql")).sort()) {
    await db.exec(await readFile(new URL(name, directory), "utf8"));
  }
}

export async function fixture(db, { capacity = 10, track = 0, near = false } = {}) {
  const ids = Object.fromEntries(["user", "other", "event", "slot", "individual", "friends"].map(key => [key, randomUUID()]));
  await db.query("insert into auth.users(id,email_confirmed_at) values ($1,now()), ($2,now())", [ids.user, ids.other]);
  // Cada escenario usa una fecha distinta y el flujo real: borrador -> tanda -> publicar.
  const { rows: [timing] } = await db.query(`select case when $1 then date_trunc('second',clock_timestamp())+interval '2 minutes'
    else ((greatest(coalesce((select max(date) from public.events),current_date),current_date+1)+1)+time '12:00') at time zone 'America/El_Salvador' end as starts_at`, [near]);
  await db.query("insert into public.events(id,date,status,start_time,end_time) values ($1,($2::timestamptz at time zone 'America/El_Salvador')::date,'draft',($2::timestamptz at time zone 'America/El_Salvador')::time,'00:00')", [ids.event, timing.starts_at]);
  await db.query(`insert into public.slots(id,event_id,starts_at,ends_at,capacity,track_reserved_spots)
    values ($1,$2,$5::timestamptz,$5::timestamptz+interval '10 minutes',$3,$4)`, [ids.slot, ids.event, capacity, track, timing.starts_at]);
  await db.query("update public.events set status='open' where id=$1", [ids.event]);
  await db.query(`insert into public.packages(id,name,price,spots) values
    ($1,'Individual',15,1),($2,'Friends Combo',50,5)`, [ids.individual, ids.friends]);
  return ids;
}

export async function asUser(db, user, action, role = "authenticated") {
  if (!["authenticated", "anon", "service_role"].includes(role)) throw new Error("Invalid test role");
  await db.exec("begin");
  try {
    await db.exec(`set local role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [user ?? ""]);
    const result = await action();
    await db.exec("commit");
    return result;
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
}

export function reserve(db, ids, { key = randomUUID(), packageId = ids.individual, names = ["Ana"], rules = true } = {}) {
  return db.query("select public.create_reservation($1,$2,$3::jsonb,$4,$5) as reservation",
    [ids.slot, packageId, JSON.stringify(names.map(full_name => ({ full_name }))), key, rules]);
}
