import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/features/admin/scheduleModel.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { generateRanges, validateRanges, matchingDates } = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
const range = (startTime, endTime) => ({ startTime, endTime });

test('09:00 to 17:00 creates exactly eight hourly slots', () => {
    const slots = generateRanges('09:00', '17:00', 60);
    assert.equal(slots.length, 8);
    assert.deepEqual(slots[0], range('09:00', '10:00'));
    assert.deepEqual(slots.at(-1), range('16:00', '17:00'));
    assert.equal(validateRanges(slots), null);
});
test('supports fractional-hour starts and arbitrary minute durations', () => {
    assert.deepEqual(generateRanges('09:15', '10:45', 45), [range('09:15', '10:00'), range('10:00', '10:45')]);
});
test('custom unequal ranges allow adjacent slots and breaks', () => {
    assert.equal(validateRanges([range('14:00', '17:00'), range('09:00', '12:00'), range('12:00', '13:00')]), null);
});
test('rejects overlapping and duplicate slots', () => {
    assert.ok(validateRanges([range('09:00', '12:00'), range('11:00', '13:00')]));
    assert.ok(validateRanges([range('09:00', '12:00'), range('09:00', '12:00')]));
});
test('rejects invalid, zero, reverse and overnight ranges', () => {
    for (const slot of [range('', ''), range('9:00', '12:00'), range('09:60', '12:00'), range('12:00', '12:00'), range('17:00', '09:00'), range('23:00', '24:00')])
        assert.ok(validateRanges([slot]));
    assert.ok(validateRanges([]));
});
test('generation never silently truncates a remainder or invents a partial slot', () => {
    assert.throws(() => generateRanges('09:00', '10:30', 60));
    for (const duration of [0, -1, 0.5, NaN, Infinity]) assert.throws(() => generateRanges('09:00', '10:00', duration));
    assert.throws(() => generateRanges('00:00', '23:59', 1));
});
test('bulk copies include only explicitly selected weekdays across month boundaries', () => {
    assert.deepEqual(matchingDates('2026-10-30', '2026-11-04', [1, 3, 5]), ['2026-10-30', '2026-11-02', '2026-11-04']);
    assert.deepEqual(matchingDates('2026-10-17', '2026-10-17', [6]), ['2026-10-17']);
});
test('empty weekdays and invalid or oversized copy periods never imply all days', () => {
    for (const [from, to, weekdays] of [['2026-10-01', '2026-10-31', []], ['2026-11-01', '2026-10-01', [1]], ['', '2026-10-01', [1]], ['2026-02-30', '2026-03-10', [1]], ['2026-01-01', '2027-12-31', [1]]])
        assert.deepEqual(matchingDates(from, to, weekdays), []);
});
