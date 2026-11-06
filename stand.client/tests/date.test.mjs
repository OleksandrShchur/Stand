import assert from 'node:assert/strict';
import { test } from 'vitest';
import { todayIso, parseIsoDate, formatDate, formatWeekdayShort, formatDateTime, dateRangeIso } from '../src/utils/date.ts';

test('civil dates preserve calendar days while timestamps use Kyiv time', () => {
    assert.equal(parseIsoDate('2024-02-29').getDate(), 29);
    assert.equal(formatDate('2026-11-06'), '06.11.2026');
    assert.equal(formatWeekdayShort('2026-11-06'), 'пт');
    assert.equal(formatDateTime('2026-12-31T22:00:00Z'), '01.01.2027, 00:00');
    assert.deepEqual(dateRangeIso('2024-02-28', '2024-03-01'), ['2024-02-28', '2024-02-29', '2024-03-01']);
    assert.deepEqual(dateRangeIso('2026-11-07', '2026-11-06'), []);
    assert.deepEqual(dateRangeIso('2026-11-06', '2026-11-06'), ['2026-11-06']);
});

test('archive boundary follows midnight in Kyiv during summer time', () => {
    assert.equal(todayIso(new Date('2026-10-19T20:59:59Z')), '2026-10-19');
    assert.equal(todayIso(new Date('2026-10-19T21:00:00Z')), '2026-10-20');
});

test('archive boundary follows Kyiv through winter and a year boundary', () => {
    assert.equal(todayIso(new Date('2026-12-31T21:59:59Z')), '2026-12-31');
    assert.equal(todayIso(new Date('2026-12-31T22:00:00Z')), '2027-01-01');
});
