import assert from 'node:assert/strict';
import test from 'node:test';
import { groupShiftsByDate } from './shiftGroups.ts';

const shift = (id, date, startTime) => ({
    id, date, startTime, endTime: '18:00', locationName: 'Location', cancelToken: String(id),
});

test('preview uses two distinct dates, with the earliest shift first on each date', () => {
    const shifts = [
        shift(4, '2026-10-16', '09:00'),
        shift(2, '2026-10-14', '13:00'),
        shift(3, '2026-10-15', '11:00'),
        shift(1, '2026-10-14', '09:00'),
    ];
    const originalIds = shifts.map((item) => item.id);
    const preview = groupShiftsByDate(shifts).slice(0, 2);
    assert.deepEqual(preview.map((group) => group.date), ['2026-10-14', '2026-10-15']);
    assert.deepEqual(preview[0].shifts.map((item) => item.id), [1, 2]);
    assert.equal(preview[1].shifts[0].id, 3);
    assert.deepEqual(shifts.map((item) => item.id), originalIds);
});

test('empty and single-date schedules do not add extra preview dates', () => {
    assert.deepEqual(groupShiftsByDate([]), []);
    const groups = groupShiftsByDate([
        shift(1, '2026-10-14', '09:00'),
        shift(2, '2026-10-14', '11:00'),
    ]);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].shifts.length, 2);
});
