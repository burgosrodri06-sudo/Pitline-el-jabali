import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";

// Only for disposable test databases. Auth identity emulates Supabase's JWT GUC.
export async function bootstrap(db) {
  await db.exec(`
    do $$ begin
      if not exists(select from pg_roles where rolname='anon') then create role anon nologin; end if;
      if not exists(select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
      if not exists(select from pg_roles where rolname='service_role') then create role service_role nologin; end if;
    end $$;
    create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `);
  const directory = new URL("../../supabase/migrations/", import.meta.url);
  for (const name of (await readdir(directory)).filter(name => name.endsWith(".sql")).sort()) {
    await db.exec(await readFile(new URL(name, directory), "utf8"));
  }
}

export async function fixture(db, { capacity = 10, track = 0 } = {}) {
  const ids = Object.fromEntries(["user", "other", "event", "slot", "individual", "friends"].map(key => [key, randomUUID()]));
  await db.query("insert into auth.users(id) values ($1), ($2)", [ids.user, ids.other]);
  await db.query("insert into public.events(id,title,event_date,status) values ($1,'Test',(now() at time zone 'America/El_Salvador')::date + 2,'published')", [ids.event]);
  await db.query(`insert into public.slots(id,event_id,starts_at,ends_at,capacity,track_reserved_capacity)
    values ($1,$2,now()+interval '2 days',now()+interval '2 days 10 minutes',$3,$4)`, [ids.slot, ids.event, capacity, track]);
  await db.query(`insert into public.packages(id,code,name,price_cents,spots_required,active) values
    ($1::uuid,$1::uuid::text,'Individual',1500,1,true),($2::uuid,$2::uuid::text,'Friends Combo',5000,5,true)`, [ids.individual, ids.friends]);
  await db.exec("update public.reservation_settings set active_waiver_version='test-only-v1'");
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

export function reserve(db, ids, { key = randomUUID(), packageId = ids.individual, names = ["Ana"], waiver = true, version = "test-only-v1" } = {}) {
  return db.query("select public.create_reservation($1,$2,$3::jsonb,$4,$5,$6) as reservation",
    [ids.slot, packageId, JSON.stringify(names.map(full_name => ({ full_name }))), key, waiver, version]);
}
