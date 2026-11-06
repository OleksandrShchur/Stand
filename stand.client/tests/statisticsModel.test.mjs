import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/features/admin/statisticsModel.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { availablePeriods, resolvePeriod, changePeriodType } = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
const months = [{ year: 2026, month: 10 }, { year: 2026, month: 11 }, { year: 2027, month: 2 }];

test('month, quarter and year choices contain only periods backed by data', () => {
    assert.deepEqual(availablePeriods(months, 'month'), [
        { period: 'month', year: 2027, value: 2 }, { period: 'month', year: 2026, value: 11 }, { period: 'month', year: 2026, value: 10 },
    ]);
    assert.deepEqual(availablePeriods(months, 'quarter'), [
        { period: 'quarter', year: 2027, value: 1 }, { period: 'quarter', year: 2026, value: 4 },
    ]);
    assert.deepEqual(availablePeriods(months, 'year'), [
        { period: 'year', year: 2027, value: 0 }, { period: 'year', year: 2026, value: 0 },
    ]);
});

test('defaults to the current Kyiv month if available, otherwise the latest data', () => {
    const options = availablePeriods(months, 'month');
    assert.equal(resolvePeriod(options, null, '2026-11-06').value, 11);
    assert.equal(resolvePeriod(options, null, '2026-12-06').year, 2027);
    assert.equal(resolvePeriod([], null, '2026-11-06'), null);
});

test('changing years never leaves an unavailable month selected', () => {
    assert.deepEqual(resolvePeriod(availablePeriods(months, 'month'), { period: 'month', year: 2027, value: 11 }, '2026-11-06'),
        { period: 'month', year: 2027, value: 2 });
});

test('switching period modes keeps the selected year and containing quarter', () => {
    const selected = { period: 'month', year: 2026, value: 11 };
    assert.deepEqual(changePeriodType(selected, 'quarter'), { period: 'quarter', year: 2026, value: 4 });
    assert.deepEqual(changePeriodType(selected, 'year'), { period: 'year', year: 2026, value: 0 });
    assert.deepEqual(resolvePeriod(availablePeriods(months, 'month'),
        changePeriodType({ period: 'year', year: 2026, value: 0 }, 'month'), '2026-11-06'), selected);
});

test('personal periods cannot fall back to another person or global periods', () => {
    assert.deepEqual(availablePeriods([{ year: 2026, month: 3 }], 'quarter'), [{ period: 'quarter', year: 2026, value: 1 }]);
    assert.deepEqual(availablePeriods([], 'year'), []);
});
