import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/hooks/availabilityRefresh.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { startAvailabilityRefresh } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('availability refresh pauses hidden tabs, coalesces events, retries and aborts on disposal', async () => {
    const previous = { document: globalThis.document, window: globalThis.window, now: Date.now };
    const doc = Object.assign(new EventTarget(), { visibilityState: 'hidden' });
    let interval, cleared = false, now = 2000, release;
    const win = Object.assign(new EventTarget(), {
        setInterval: callback => { interval = callback; return 1; },
        clearInterval: () => { cleared = true; },
    });
    globalThis.document = doc;
    globalThis.window = win;
    Date.now = () => now;
    const calls = [];
    const flush = async () => { await new Promise(resolve => setImmediate(resolve)); };
    let poller;
    try {
        poller = startAvailabilityRefresh(async (signal, initial) => {
            calls.push({ signal, initial });
            await new Promise(resolve => { release = resolve; });
        });
        interval();
        await flush();
        assert.equal(calls.length, 0);
        doc.visibilityState = 'visible';
        doc.dispatchEvent(new Event('visibilitychange'));
        win.dispatchEvent(new Event('focus'));
        await flush();
        assert.equal(calls.length, 1);
        assert.equal(calls[0].initial, true);
        now += 30000;
        interval();
        poller.refresh();
        assert.equal(calls.length, 1, 'An unfinished refresh must not overlap');
        release();
        await flush();
        doc.visibilityState = 'hidden';
        interval();
        await flush();
        assert.equal(calls.length, 1);
        doc.visibilityState = 'visible';
        win.dispatchEvent(new Event('focus'));
        await flush();
        assert.equal(calls.length, 2);
        assert.equal(calls[1].initial, false);
        release();
        await flush();
        poller.refresh();
        await flush();
        assert.equal(calls.length, 3);
        assert.equal(calls[2].initial, true, 'Manual retry can display its loading/error state');
        poller.dispose();
        assert.equal(calls[2].signal.aborted, true);
        assert.equal(cleared, true);
        const abortedBeforeStart = startAvailabilityRefresh(async () => assert.fail('Disposed setup must not start requests'));
        abortedBeforeStart.dispose();
        await flush();
        release();
        await flush();
        now += 30000;
        interval();
        win.dispatchEvent(new Event('focus'));
        await flush();
        assert.equal(calls.length, 3);
    } finally {
        poller?.dispose();
        globalThis.document = previous.document;
        globalThis.window = previous.window;
        Date.now = previous.now;
    }
});
