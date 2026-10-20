import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/utils/date.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { todayIso } = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);

test('archive boundary follows midnight in Kyiv during summer time', () => {
    assert.equal(todayIso(new Date('2026-10-19T20:59:59Z')), '2026-10-19');
    assert.equal(todayIso(new Date('2026-10-19T21:00:00Z')), '2026-10-20');
});

test('archive boundary follows Kyiv through winter and a year boundary', () => {
    assert.equal(todayIso(new Date('2026-12-31T21:59:59Z')), '2026-12-31');
    assert.equal(todayIso(new Date('2026-12-31T22:00:00Z')), '2027-01-01');
});
