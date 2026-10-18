import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/features/admin/bookingCardGroups.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { groupBookingCards } = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);

const booking = (id, startTime, endTime, overrides = {}) => ({
    id, startTime, endTime, date: '2026-10-28', locationId: 1,
    firstName: 'Василь', lastName: 'Пупкін', phone: '+380671234567',
    ...overrides,
});
const first = booking(1, '09:00', '11:00');
const second = booking(2, '11:00', '13:00');
const third = booking(3, '13:00', '15:00');

test('groups two or more adjacent bookings while keeping original objects and order', () => {
    const items = Object.freeze([Object.freeze(first), Object.freeze(second), Object.freeze(third)]);
    const groups = groupBookingCards(items);
    assert.deepEqual(groups.map(group => group.map(item => item.id)), [[1, 2, 3]]);
    groups.flat().forEach((item, index) => assert.equal(item, items[index]));
});

test('a different participant, day or location starts a new group', () => {
    for (const overrides of [{ phone: '+380971234567' }, { date: '2026-10-29' }, { locationId: 2 }]) {
        assert.deepEqual(groupBookingCards([first, { ...second, ...overrides }]).map(group => group.length), [1, 1]);
    }
});

test('identical names do not group bookings without a known matching phone', () => {
    for (const phone of [null, undefined, '']) {
        assert.deepEqual(groupBookingCards([{ ...first, phone }, { ...second, phone }]).map(group => group.length), [1, 1]);
    }
});

test('never brings matching bookings together across another card', () => {
    const otherUser = booking(4, '09:00', '11:00', { phone: '+380971234567' });
    assert.deepEqual(groupBookingCards([first, otherUser, second]).map(group => group.map(item => item.id)), [[1], [4], [2]]);
});

test('time gaps, overlaps and duplicate slots break a group', () => {
    for (const next of [booking(4, '12:00', '14:00'), booking(4, '10:00', '12:00'), { ...first, id: 4 }]) {
        assert.deepEqual(groupBookingCards([first, next]).map(group => group.length), [1, 1]);
    }
});

test('consecutive times also group in reverse order without sorting cards', () => {
    assert.deepEqual(groupBookingCards([third, second, first]).map(group => group.map(item => item.id)), [[3, 2, 1]]);
});

test('keeps separate consecutive runs on either side of a time gap', () => {
    const later = booking(4, '17:00', '19:00');
    const last = booking(5, '19:00', '21:00');
    assert.deepEqual(groupBookingCards([first, second, later, last]).map(group => group.map(item => item.id)), [[1, 2], [4, 5]]);
});

test('empty lists and single bookings remain unchanged', () => {
    assert.deepEqual(groupBookingCards([]), []);
    assert.deepEqual(groupBookingCards([first]), [[first]]);
});
