import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import vm from 'node:vm';
import ts from 'typescript';
import { readFile } from 'node:fs/promises';
import { testBookingEnabled } from '../../domain/reservations/submission.ts';
import { PGlite } from '@electric-sql/pglite';
import { bootstrap, fixture, asUser, reserve } from './database.mjs';
import { normalizeReceipt, boundedReceiptForm, MAX_RECEIPT_BYTES } from '../../domain/reservations/receipt-file.ts';
import { transferReceipt } from '../../domain/reservations/receipt-transfer.ts';

let db;
before(async () => { db = new PGlite(); await bootstrap(db); });
after(async () => { await db?.close(); });
async function setup(database = db) {
  const ids = await fixture(database);
  const r = (await asUser(database, ids.user, () => reserve(database, ids))).rows[0].reservation;
  return { ids, r, key: randomUUID(), hash: 'a'.repeat(64), ref: randomUUID() };
}
async function call(x, final = false, database = db) {
  return (await asUser(database, null, () => database.query('select public.prepare_payment_receipt($1,$2,$3,$4,$5,$6,$7) as result',
    [x.ids.user, x.r.id, x.key, x.hash, x.ref, '1234', final]), 'service_role')).rows[0].result;
}
async function upload(x, database = db) {
  const a = await call(x, false, database);
  await database.query("insert into storage.objects(bucket_id,name) values ('payment-receipts',$1)", [a.objectPath]);
  return a;
}
test('real JPEG/PNG decoded, normalized and deterministic; invalid/truncated/oversized inputs rejected', async () => {
  for (const format of ['jpeg', 'png']) {
    const bytes = await sharp({ create: { width: 3, height: 3, channels: 3, background: 'red' } }).toFormat(format).toBuffer();
    const a = await normalizeReceipt(bytes);
    assert.equal((await sharp(a.bytes).metadata()).format, 'png');
    assert.equal(a.hash, (await normalizeReceipt(bytes)).hash);
    await assert.rejects(normalizeReceipt(bytes.subarray(0, 20)), /invalid_file/);
  }
  for (const bytes of [Buffer.from('<svg></svg>'), Buffer.from('%PDF-1.7'), Buffer.from('<html>fake.png</html>'), Buffer.alloc(0), Buffer.alloc(MAX_RECEIPT_BYTES + 1)]) {
    await assert.rejects(normalizeReceipt(bytes), /invalid_file/);
  }
  await assert.rejects(boundedReceiptForm(new Request('https://example.test', { method: 'POST', body: Buffer.alloc(MAX_RECEIPT_BYTES + 65537) })), /invalid_file/);
});
test('upload success with ambiguous SQL result retries without another payment or deleting object', async () => {
  let committed = false; let uploads = 0; const id = randomUUID();
  const deps = { prepare: async () => committed ? { submitted: true, paymentId: id } : { submitted: false, objectPath: 'private' },
    uploadOrVerify: async () => { uploads++; }, finalize: async () => { committed = true; throw Error('lost response'); } };
  await assert.rejects(transferReceipt(deps));
  assert.deepEqual(await transferReceipt(deps), { submitted: true, paymentId: id });
  assert.equal(uploads, 1);
  await assert.rejects(transferReceipt({ ...deps, prepare: async () => ({ submitted: true, paymentId: 'bad' }) }), /unavailable/);
});
test('actual HTTP boundary enforces server gate, Origin, confirmed Auth and trusted actor; hides errors', async () => {
  const env = {};
  let user = { id: randomUUID(), email_confirmed_at: '2026-10-07' }; let received; let fail = false;
  const imports = {
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) },
    '@/domain/reservations/submission': { testBookingEnabled },
    '@/domain/reservations/receipt-file': { boundedReceiptForm, normalizeReceipt },
    '@/lib/services/payment-receipts': { storePaymentReceipt: async args => { received = args; if (fail) throw new Error('SECRET SQL OTHER USER'); return { submitted: true, paymentId: randomUUID() }; } },
  };
  const source = await readFile(new URL('../../app/api/payment-receipts/route.ts', import.meta.url), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, process: { env }, Response, File, Error, URL, Uint8Array, require: name => imports[name] });
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).png().toBuffer();
  const request = (origin = 'https://pitlane.test') => {
    const form = new FormData();
    for (const [k,v] of Object.entries({ reservationId: randomUUID(), key: randomUUID(), reference: ' ref ', last4: '1234', userId: 'ATTACKER', amount: '1', objectPath: '../other' })) form.set(k,v);
    form.set('file', new File([bytes], '../../evil.png', { type: 'text/html' }));
    return new Request('https://pitlane.test/api/payment-receipts', { method: 'POST', headers: { origin }, body: form });
  };
  assert.equal((await exports.POST(request())).status,403);
  Object.assign(env, { RESERVATIONS_ENVIRONMENT:'staging', RESERVATIONS_TEST_ENABLED:'true', RESERVATIONS_TEST_SUPABASE_URL:'https://staging.test', NEXT_PUBLIC_SUPABASE_URL:'https://staging.test', PAYMENT_RECEIPTS_TEST_ENABLED:'true', SUPABASE_RECEIPT_SERVICE_ROLE_KEY:'FAKE' });
  env.VERCEL_ENV='production'; assert.equal((await exports.POST(request())).status,403); delete env.VERCEL_ENV;
  assert.equal((await exports.POST(request('https://attacker.test'))).status,403);
  user.email_confirmed_at=null; assert.equal((await exports.POST(request())).status,401);
  user.email_confirmed_at='2026-10-07';
  assert.equal((await exports.POST(request())).status,200);
  assert.equal(received.userId,user.id); assert.equal(received.reference,'ref');
  assert.equal(received.amount,undefined); assert.equal(received.objectPath,undefined);
  fail=true;
  const response = await exports.POST(request());
  assert.equal(response.status,503); assert.deepEqual(await response.json(),{ error:'receipt_unavailable' });
  user=null; assert.equal((await exports.POST(request())).status,401);
});
test('trusted snapshot, safe path, uploaded/payment_review transaction and repeat acknowledgement', async () => {
  const x = await setup(); const a = await upload(x);
  assert.equal(a.objectPath, `${x.ids.user}/${x.r.id}/${x.key}.png`);
  const result = await call(x, true);
  assert.deepEqual(await call(x), result);
  assert.deepEqual(await call(x, true), result);
  const p = (await db.query('select amount::float,status,reference,last4 from payments where reservation_id=$1', [x.r.id])).rows;
  assert.deepEqual(p, [{ amount: 15, status: 'uploaded', reference: x.ref, last4: '1234' }]);
  assert.equal((await db.query('select status from reservations where id=$1', [x.r.id])).rows[0].status, 'payment_review');
  await assert.rejects(call({ ...x, hash: 'b'.repeat(64) }), /idempotency_conflict/);
  await assert.rejects(call({ ...x, ref: 'changed' }), /idempotency_conflict/);
  await assert.rejects(call({ ...x, key: randomUUID() }), /resubmission_blocked/);
});
test('actual Storage service recovers ambiguous upload and SQL failure, refuses mismatched bytes', async () => {
  const objects = new Map(); let committed = false; let failSql = true; let uploads = 0;
  const paymentId = randomUUID();
  const bucket = {
    upload: async (path, bytes, options) => {
      assert.equal(options.upsert,false); uploads++;
      if (!objects.has(path)) objects.set(path,Buffer.from(bytes));
      return { error: { message:'ambiguous or already exists' } };
    },
    download: async path => ({ data: new Blob([objects.get(path)]) }),
  };
  const client = { storage: { from: name => { assert.equal(name,'payment-receipts'); return bucket; } },
    rpc: async (name, args) => {
      assert.equal(name,'prepare_payment_receipt'); assert.equal(args.p_user,'trusted-user');
      if (args.p_finalize && failSql) return { error:{ message:'receipt_unavailable' } };
      if (args.p_finalize) committed=true;
      return { data:committed ? { submitted:true,paymentId } : { submitted:false,objectPath:'safe/path.png' } };
    } };
  const imports = { 'server-only': {}, '@supabase/supabase-js': { createClient: () => client }, 'node:crypto': { createHash }, '@/domain/reservations/receipt-transfer': { transferReceipt } };
  const exports = {};
  const source = await readFile(new URL('../../lib/services/payment-receipts.ts',import.meta.url),'utf8');
  vm.runInNewContext(ts.transpileModule(source,{ compilerOptions:{ module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022 } }).outputText,
    { exports, Error, Buffer, process:{ env:{ SUPABASE_RECEIPT_SERVICE_ROLE_KEY:'FAKE' } }, require:name=>imports[name] });
  const bytes=Buffer.from('validated canonical image');
  const input={ userId:'trusted-user',bytes,hash:createHash('sha256').update(bytes).digest('hex') };
  await assert.rejects(exports.storePaymentReceipt(input),/unavailable/);
  assert.equal(objects.size,1);
  failSql=false;
  assert.equal((await exports.storePaymentReceipt(input)).paymentId,paymentId);
  assert.equal(uploads,2);
  await exports.storePaymentReceipt(input); assert.equal(uploads,2);
  committed=false; objects.set('safe/path.png',Buffer.from('different'));
  await assert.rejects(exports.storePaymentReceipt(input),/idempotency_conflict/);
});
test('ownership and confirmed email required; authenticated/anon cannot execute service RPC or access attempts', async () => {
  const x = await setup();
  await assert.rejects(call({ ...x, ids: { ...x.ids, user: x.ids.other } }), /unavailable/);
  await db.query('update auth.users set email_confirmed_at=null where id=$1', [x.ids.user]);
  await assert.rejects(call(x), /auth_required/);
  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(asUser(db, x.ids.user, () => db.query('select public.prepare_payment_receipt($1,$2,$3,$4,$5,$6)', [x.ids.user,x.r.id,x.key,x.hash,x.ref,'1234']), role), /permission denied/);
    await assert.rejects(asUser(db, x.ids.user, () => db.query('select * from payment_receipt_attempts'), role), /permission denied/);
    await assert.rejects(asUser(db, x.ids.user, () => db.query("insert into storage.objects(bucket_id,name) values ('payment-receipts','fake')"), role), /row-level security/);
  }
  await db.exec('create policy test_permissive_insert on storage.objects for insert to authenticated with check (true)');
  await assert.rejects(asUser(db,x.ids.user,()=>db.query("insert into storage.objects(bucket_id,name) values ('payment-receipts','bypass')")),/row-level security/);
  await db.exec('drop policy test_permissive_insert on storage.objects');
});
test('expiry during upload cannot revive hold and leaves no partial payment', async () => {
  const x = await setup(); await upload(x);
  await db.query("update reservations set created_at=now()-interval '1 hour',expires_at=now()-interval '1 second' where id=$1", [x.r.id]);
  await assert.rejects(call(x, true), /expired_or_unavailable/);
  assert.equal((await db.query('select count(*)::int as n from payments where reservation_id=$1', [x.r.id])).rows[0].n, 0);
  assert.equal((await db.query('select payment_id from payment_receipt_attempts where id=$1', [x.key])).rows[0].payment_id, null);
});
test('missing upload, full capacity corruption and duplicate reference fail without transition', async () => {
  const x = await setup(); await call(x);
  await assert.rejects(call(x, true), /object_missing/);
  await upload(x); await call(x, true);
  const y = await setup(); y.ref = x.ref; await upload(y);
  await assert.rejects(call(y, true), /unique constraint/);
  assert.equal((await db.query('select status from reservations where id=$1', [y.r.id])).rows[0].status, 'pending_payment');
  await assert.rejects(db.query('update slots set capacity=1,track_reserved_spots=1 where id=$1', [y.ids.slot]), /reservados/);
  // Corrupción intencional únicamente en la base desechable: comprobar defensa adicional del pago.
  await db.exec('alter table public.slots disable trigger kre_guard_slot');
  try {
    await db.query('update slots set capacity=1,track_reserved_spots=1 where id=$1', [y.ids.slot]);
  } finally { await db.exec('alter table public.slots enable trigger kre_guard_slot'); }
  await assert.rejects(call(y, true), /capacity_unavailable/);
});
test('compatible with Rodrigo migration: review can approve our submission; owner isolation', async () => {
  const operations = execFileSync('git', ['show', 'origin/feature/operations:pitlane/supabase/migrations/20261007182818_rodrigo_operations.sql'], { encoding: 'utf8' });
  const otherDb = new PGlite();
  try {
    await bootstrap(otherDb, operations);
    const x = await setup(otherDb); await upload(x, otherDb); const p = await call(x, true, otherDb);
    assert.equal((await asUser(otherDb, x.ids.other, () => otherDb.query('select * from payments'))).rows.length, 0);
    assert.equal((await asUser(otherDb, x.ids.user, () => otherDb.query('select * from payments'))).rows.length, 1);
    assert.equal((await asUser(otherDb, x.ids.other, () => otherDb.query('select * from storage.objects'))).rows.length, 0);
    assert.equal((await asUser(otherDb, x.ids.user, () => otherDb.query('select * from storage.objects'))).rows.length, 1);
    await otherDb.query("update profiles set role='payments' where id=$1", [x.ids.other]);
    await asUser(otherDb, x.ids.other, () => otherDb.query("select operations_review_payment($1,'approve',null)", [p.paymentId]));
    assert.equal((await otherDb.query('select status from reservations where id=$1',[x.r.id])).rows[0].status,'paid');
    assert.deepEqual(await call(x, false, otherDb), p);
  } finally { await otherDb.close(); }
});
