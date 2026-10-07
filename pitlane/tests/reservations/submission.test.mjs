import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import * as submission from '../../domain/reservations/submission.ts';
import { resolveBookingSelection, bookingLoginHref } from '../../app/reservar/booking-form.ts';
import { eventDates, slots, packages } from '../../app/reservar/booking-data.ts';
import { createAttemptKeys, createSubmissionRunner, isReservationInput, isReceipt, runReservationSubmission, testBookingEnabled } from '../../domain/reservations/submission.ts';

const input = () => ({ slotId: randomUUID(), packageId: randomUUID(), idempotencyKey: randomUUID(), participants: [{ fullName: 'Ana' }], rulesAccepted: true });
const receipt = () => ({ id: randomUUID(), code: 'KRE-123456', status: 'pending_payment', amount: 15, spots: 1, expiresAt: '2026-10-10T20:00:00Z' });

test('same normalized content reuses key, material change gets another, A-B-A preserves A', () => {
  const keys = createAttemptKeys(randomUUID);
  const a = input();
  const key = keys(a);
  assert.equal(keys({ ...a, participants: [{ fullName: ' Ana ' }] }), key);
  assert.notEqual(keys({ ...a, slotId: randomUUID() }), key);
  assert.notEqual(keys({ ...a, packageId: randomUUID() }), key);
  assert.notEqual(keys({ ...a, participants: [{ fullName: 'Luis' }] }), key);
  assert.equal(keys(a), key);
});
test('booking is closed by default and production cannot use staging opt-in on Vercel', () => {
  const env = { RESERVATIONS_ENVIRONMENT: 'staging', RESERVATIONS_TEST_ENABLED: 'true', RESERVATIONS_TEST_SUPABASE_URL: 'https://test.supabase.co', NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co' };
  assert.equal(testBookingEnabled({}), false);
  assert.equal(testBookingEnabled(env), true);
  for (const change of [{ RESERVATIONS_ENVIRONMENT: 'production' }, { VERCEL_ENV: 'production' }, { RESERVATIONS_TEST_ENABLED: 'false' }, { NEXT_PUBLIC_SUPABASE_URL: 'https://shared.supabase.co' }]) assert.equal(testBookingEnabled({ ...env, ...change }), false);
});
test('action boundary rejects disabled or invalid inputs before invoking service', async () => {
  let calls = 0;
  const reserve = async () => { calls++; return { ok: true, reservation: receipt() }; };
  assert.equal((await runReservationSubmission(input(), false, reserve)).error, 'booking_disabled');
  for (const value of [null, {}, { ...input(), rulesAccepted: false }, { ...input(), slotId: 'mock-slot' }, { ...input(), participants: [{ fullName: '' }] }]) {
    assert.equal(isReservationInput(value), false);
    assert.equal((await runReservationSubmission(value, true, reserve)).error, 'invalid_input');
  }
  assert.equal(calls, 0);
});
test('double click invokes once; network retry keeps exact idempotency key', async () => {
  let release;
  const sent = [];
  const run = createSubmissionRunner(async value => { sent.push(value); await new Promise(resolve => { release = resolve; }); throw new Error('connection lost'); });
  const value = input();
  const first = run(value);
  assert.equal(await run(value), null);
  release();
  assert.equal((await first).error, 'reservation_unavailable');
  const retry = run(value);
  release();
  await retry;
  assert.equal(sent.length, 2);
  assert.equal(sent[0].idempotencyKey, sent[1].idempotencyKey);
});
test('only valid backend receipt yields success; preserves amount/status/expiry', async () => {
  const row = receipt();
  assert.deepEqual(await runReservationSubmission(input(), true, async () => ({ ok: true, reservation: row })), { ok: true, reservation: row });
  for (const invalid of [null, {}, { ...row, expiresAt: 'invalid' }, { ...row, amount: NaN }, { ...row, status: 'confirmed' }]) {
    assert.equal(isReceipt(invalid), false);
    assert.equal((await runReservationSubmission(input(), true, async () => ({ ok: true, reservation: invalid }))).error, 'reservation_unavailable');
  }
});
test('capacity, expired slot, invalid session and unverified email remain explicit errors', async () => {
  for (const error of ['insufficient_capacity', 'slot_unavailable', 'authentication_required', 'email_verification_required', 'idempotency_conflict']) {
    assert.deepEqual(await runReservationSubmission(input(), true, async () => ({ ok: false, error })), { ok: false, error });
  }
});

function realCatalog() {
  const event = { id: randomUUID(), date: '2026-11-20' };
  const slot = { id: randomUUID(), eventDateId: event.id, startMinutes: 1080, remainingKarts: 5 };
  const pack = { id: randomUUID(), name: 'Individual', price: 15, karts: 1, description: '' };
  return { eventDates: [event], slots: [slot], packages: [pack] };
}
test('every current KRE demo ID is rejected rather than mapped to real catalog entities', () => {
  const catalog = realCatalog();
  for (const event of eventDates) assert.deepEqual(resolveBookingSelection({ evento: event.id }, catalog), { initial: {}, invalidSelection: true });
  for (const slot of slots) assert.equal(resolveBookingSelection({ evento: catalog.eventDates[0].id, tanda: slot.id }, catalog).invalidSelection, true);
  for (const pack of packages) {
    assert.equal(resolveBookingSelection({ evento: catalog.eventDates[0].id, tanda: catalog.slots[0].id, paquete: pack.id }, catalog).invalidSelection, true);
    assert.equal(isReservationInput({ ...input(), packageId: pack.id }), false);
  }
});
test('real selection survives login roundtrip; malformed/cross-event/expired package links reset clearly', () => {
  const catalog = realCatalog();
  const selection = { dateId: catalog.eventDates[0].id, slotId: catalog.slots[0].id, packageId: catalog.packages[0].id };
  const login = new URL(bookingLoginHref(selection), 'https://pitlane.test');
  const query = Object.fromEntries(new URL(login.searchParams.get('next'), login.origin).searchParams);
  assert.deepEqual(resolveBookingSelection(query, catalog), { initial: selection, invalidSelection: false });
  assert.equal(resolveBookingSelection({}, catalog).invalidSelection, false);
  for (const change of [{ evento: ['a', 'b'] }, { evento: '' }, { tanda: randomUUID() }, { paquete: 'friends' }]) {
    assert.deepEqual(resolveBookingSelection({ ...query, ...change }, catalog), { initial: {}, invalidSelection: true });
  }
  assert.equal(resolveBookingSelection(query, { ...catalog, slots: [{ ...catalog.slots[0], eventDateId: randomUUID() }] }).invalidSelection, true);
  assert.equal(resolveBookingSelection(query, { ...catalog, packages: [{ ...catalog.packages[0], validTo: '2026-01-01' }] }).invalidSelection, true);
  assert.equal(resolveBookingSelection(query, { ...catalog, slots: [{ ...catalog.slots[0], remainingKarts: 0 }] }).invalidSelection, true);
});

// Execute actual action/service source with only infrastructure imports replaced.
// This checks wiring, not only the pure helpers; no network or real credentials.
async function loadServerModule(path, imports, env = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  vm.runInNewContext(compiled.outputText, { exports, process: { env }, require: name => {
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
    return imports[name];
  } });
  return exports;
}
test('direct Server Action call cannot override disabled server environment with browser flags', async () => {
  let calls = 0;
  const action = await loadServerModule('../../app/reservar/actions.ts', {
    '@/domain/reservations/submission': submission,
    '@/lib/services/reservations': { createReservation: async () => { calls++; return { ok: true, reservation: receipt() }; } },
  });
  const result = await action.submitReservation({ ...input(), bookingEnabled: true, RESERVATIONS_TEST_ENABLED: 'true' });
  assert.equal(result.error, 'booking_disabled');
  assert.equal(calls, 0);
});
test('actual service requires confirmed Auth user and only sends permitted fields to RPC', async () => {
  let user = null;
  const calls = [];
  const row = receipt();
  const service = await loadServerModule('../../lib/services/reservations.ts', {
    'server-only': {}, '@/domain/reservations/submission': submission,
    '@/lib/supabase/server': { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user }, error: null }) },
      rpc: async (name, args) => { calls.push({ name, args }); return { data: { ...row, private_field: 'not-for-browser' }, error: null }; },
    }) },
  });
  assert.equal((await service.createReservation(input())).error, 'authentication_required');
  user = { id: randomUUID(), email_confirmed_at: null, user_metadata: { email_verified: true } };
  assert.equal((await service.createReservation(input())).error, 'email_verification_required');
  assert.equal(calls.length, 0);
  user.email_confirmed_at = '2026-10-01';
  const result = await service.createReservation({ ...input(), userId: randomUUID(), amount: 1, status: 'paid' });
  assert.equal(result.ok, true);
  assert.equal(result.reservation.private_field, undefined);
  assert.deepEqual(Object.keys(result.reservation).sort(), ['amount', 'code', 'expiresAt', 'id', 'spots', 'status']);
  assert.deepEqual(Object.keys(calls[0].args).sort(), ['p_idempotency_key', 'p_package_id', 'p_participants', 'p_rules_accepted', 'p_slot_id']);
  assert.equal(calls[0].name, 'create_reservation');
});
