import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/api/requestActivity.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { requestActivity, trackRequest } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('keeps progress active until all concurrent requests finish', async () => {
    let finishFirst;
    let finishSecond;
    const first = trackRequest(() => new Promise((resolve) => { finishFirst = resolve; }));
    const second = trackRequest(() => new Promise((resolve) => { finishSecond = resolve; }));
    assert.equal(requestActivity.getSnapshot(), true);
    finishFirst('first');
    assert.equal(await first, 'first');
    assert.equal(requestActivity.getSnapshot(), true);
    finishSecond('second');
    assert.equal(await second, 'second');
    assert.equal(requestActivity.getSnapshot(), false);
});

test('clears progress and preserves errors on network failure or synchronous throws', async () => {
    const failure = new Error('offline');
    await assert.rejects(trackRequest(() => Promise.reject(failure)), (error) => error === failure);
    assert.equal(requestActivity.getSnapshot(), false);
    await assert.rejects(trackRequest(() => { throw failure; }), (error) => error === failure);
    assert.equal(requestActivity.getSnapshot(), false);
});

test('notifies subscribers and stops notifying after unsubscribe', async () => {
    const snapshots = [];
    const unsubscribe = requestActivity.subscribe(() => snapshots.push(requestActivity.getSnapshot()));
    await trackRequest(() => Promise.resolve());
    unsubscribe();
    await trackRequest(() => Promise.resolve());
    assert.deepEqual(snapshots, [true, false]);
});
