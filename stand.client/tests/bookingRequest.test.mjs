import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/features/booking/bookingRequest.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;

test('booking retries and reloads preserve identity; changed selections and confirmed bookings get new keys', async () => {
    const previous = globalThis.sessionStorage;
    const storage = new Map();
    globalThis.sessionStorage = {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: key => storage.delete(key),
    };
    try {
        const first = await import(moduleUrl);
        const key = first.bookingRequestKey('2026-10-17', 1, [2, 3]);
        assert.equal(first.bookingRequestKey('2026-10-17', 1, [3, 2]), key);
        const reloaded = await import(moduleUrl + '#reload');
        assert.equal(reloaded.bookingRequestKey('2026-10-17', 1, [2, 3]), key);
        assert.notEqual(first.bookingRequestKey('2026-10-17', 2, [2, 3]), key);
        first.clearBookingRequest();
        assert.notEqual(first.bookingRequestKey('2026-10-17', 1, [2, 3]), key);
    } finally { globalThis.sessionStorage = previous; }
});
