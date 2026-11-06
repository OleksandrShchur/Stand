import assert from 'node:assert/strict';
import { test, vi } from 'vitest';

test('booking retries and reloads preserve identity; changed selections and confirmed bookings get new keys', async () => {
    const previous = globalThis.sessionStorage;
    const storage = new Map();
    globalThis.sessionStorage = {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: key => storage.delete(key),
    };
    try {
        const first = await import('../src/features/booking/bookingRequest');
        const key = first.bookingRequestKey('2026-10-17', 1, [2, 3]);
        assert.equal(first.bookingRequestKey('2026-10-17', 1, [3, 2]), key);
        vi.resetModules();
        const reloaded = await import('../src/features/booking/bookingRequest');
        assert.equal(reloaded.bookingRequestKey('2026-10-17', 1, [2, 3]), key);
        assert.notEqual(first.bookingRequestKey('2026-10-17', 2, [2, 3]), key);
        first.clearBookingRequest();
        assert.notEqual(first.bookingRequestKey('2026-10-17', 1, [2, 3]), key);
    } finally { globalThis.sessionStorage = previous; }
});
