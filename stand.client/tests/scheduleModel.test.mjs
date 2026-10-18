import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/features/admin/scheduleModel.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { generateRanges, getRangeErrors, validateRanges, matchingDates } = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
const range = (startTime, endTime, capacity = 2) => ({ startTime, endTime, capacity });

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
test('generation uses the default of two or the supplied location capacity', () => {
    assert.deepEqual(generateRanges('09:00', '10:00', 30), [range('09:00', '09:30'), range('09:30', '10:00')]);
    assert.deepEqual(generateRanges('09:00', '10:00', 30, 5), [range('09:00', '09:30', 5), range('09:30', '10:00', 5)]);
});
test('each interval supports an independent positive whole capacity', () => {
    assert.equal(validateRanges([range('09:00', '10:00', 1), range('10:00', '11:00', 5)]), null);
    for (const capacity of [0, -1, 1.5, NaN, Infinity, undefined, null, 2147483648]) {
        assert.ok(validateRanges([{ startTime: '09:00', endTime: '10:00', capacity }]));
        if (capacity !== undefined) assert.throws(() => generateRanges('09:00', '10:00', 30, capacity));
    }
});
test('capacity cannot fall below bookings for that exact interval', () => {
    const bookings = [range('09:00', '10:00'), range('09:00', '10:00'), range('10:00', '11:00')];
    assert.ok(validateRanges([range('09:00', '10:00', 1)], bookings));
    assert.equal(validateRanges([range('09:00', '10:00', 2), range('10:00', '11:00', 1)], bookings), null);
    assert.equal(validateRanges([range('09:00', '10:00', 1)], bookings.slice(1)), null);
});
test('reports errors for the original intervals without marking valid neighbors', () => {
    const errors = getRangeErrors([range('14:00', '15:00'), range('09:00', '10:00', 0), range('11:00', '10:00')]);
    assert.deepEqual(errors[0], {});
    assert.match(errors[1].capacity, /ціле число від 1/);
    assert.equal(errors[1].time, undefined);
    assert.match(errors[2].time, /Завершення має бути пізніше/);
    assert.equal(errors[2].capacity, undefined);
});
test('flags every overlapping interval, including nested ranges, and clears repaired errors', () => {
    const slots = [range('09:00', '14:00'), range('10:00', '11:00'), range('12:00', '13:00'), range('14:00', '15:00')];
    const errors = getRangeErrors(slots);
    assert.ok(errors.slice(0, 3).every(error => error.time));
    assert.match(errors[1].time, /09:00–14:00/);
    assert.deepEqual(errors[3], {});
    assert.deepEqual(getRangeErrors([range('09:00', '10:00'), ...slots.slice(1)]), [{}, {}, {}, {}]);
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
