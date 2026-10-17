import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Run only against the isolated published server from perf/run.ps1.
const base = process.env.STAND_TEST_BASE || 'http://127.0.0.1:5116';
let cookie;
async function call(path, body, key) {
    const response = await fetch(base + path, {
        method: body ? 'POST' : 'GET',
        headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...(key ? { 'Idempotency-Key': key } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = response.headers.getSetCookie();
    if (setCookie.length) cookie = setCookie.map(value => value.split(';')[0]).join('; ');
    return { status: response.status, body: await response.json() };
}
assert.equal((await call('/api/auth/login', { phone: '+380670010000' })).status, 200);
const calendar = (await call('/api/calendar')).body;
const date = calendar.bookableDates.find(value => value > calendar.earliestBookableDate);
assert.ok(date, 'Enable at least one future date in the test fixture');
const location = (await call('/api/locations?date=' + date)).body.find(value => value.hasAvailableBookings);
assert.ok(location);
const slot = (await call(`/api/slots?date=${date}&locationId=${location.id}`)).body.find(value => value.isBookable);
assert.ok(slot);
const payload = { date, locationId: location.id, timeSlotIds: [slot.timeSlotId] };
const key = randomUUID();
let token;
try {
    const results = await Promise.all([call('/api/bookings/batch', payload, key), call('/api/bookings/batch', payload, key)]);
    token = results.find(value => value.status === 200)?.body[0]?.cancelToken;
    assert.deepEqual(results.map(value => value.status), [200, 200]);
    assert.ok(token);
    assert.ok(results.every(value => value.body[0].isBooked === true && !('status' in value.body[0])));
    assert.equal(results[1].body[0].cancelToken, token);
    assert.equal((await call('/api/bookings/batch', payload, 'invalid')).status, 400);
    assert.equal((await call('/api/bookings/batch', { ...payload, locationId: location.id + 10000 }, key)).status, 409);
    assert.equal((await call('/api/bookings/cancel', { cancelToken: token })).status, 200);
    assert.equal((await call('/api/bookings/cancel', { cancelToken: token })).status, 200);
    const replay = await call('/api/bookings/batch', payload, key);
    assert.equal(replay.status, 200);
    assert.equal(replay.body[0].cancelToken, token);
    assert.equal(replay.body[0].isBooked, false);
    assert.equal((await call('/api/bookings/' + token)).body.isBooked, false);
    console.log('PASS HTTP authentication, concurrent replay, invalid/mismatched keys, cancellation retries and replay after cancellation');
} finally {
    if (token) await call('/api/bookings/cancel', { cancelToken: token });
}
