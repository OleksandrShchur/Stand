import assert from 'node:assert/strict';
import test from 'node:test';
import { getClosestShifts } from './closestShifts.ts';

const shift = (id, date, startTime) => ({
    id, date, startTime, endTime: '18:00', locationName: 'Location', cancelToken: String(id),
});

test('preview shows two earliest individual shifts, including identical dates and times', () => {
    const shifts = [
        shift(4, '2026-10-16', '09:00'),
        shift(2, '2026-10-14', '09:00'),
        shift(3, '2026-10-15', '11:00'),
        shift(1, '2026-10-14', '09:00'),
    ];
    const originalIds = shifts.map((item) => item.id);
    const preview = getClosestShifts(shifts);
    assert.deepEqual(preview.map((item) => item.id), [1, 2]);
    assert.deepEqual(shifts.map((item) => item.id), originalIds);
});

test('preview sorts by date then start time and handles fewer than two shifts', () => {
    assert.deepEqual(getClosestShifts([]), []);
    const first = shift(1, '2026-10-14', '09:00');
    assert.deepEqual(getClosestShifts([first]), [first]);
    assert.deepEqual(getClosestShifts([
        shift(3, '2026-10-15', '08:00'),
        shift(2, '2026-10-14', '11:00'),
        first,
    ]).map((item) => item.id), [1, 2]);
});
