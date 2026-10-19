import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/features/booking/slotSelection.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const selectionModuleUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
const { canAddSlot, getSlotDisabledReason, isContinuousSelection, toggleSlot } = await import(selectionModuleUrl);
const timeSource = readFileSync(new URL('../src/features/booking/slotTimeStatus.ts', import.meta.url), 'utf8');
const timeOutput = ts.transpileModule(timeSource, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const timeModuleUrl = `data:text/javascript;base64,${Buffer.from(timeOutput).toString('base64')}`;
const { getSlotTimeStatus } = await import(timeModuleUrl);
const locationSource = readFileSync(new URL('../src/features/booking/locationAvailability.ts', import.meta.url), 'utf8');
const locationOutput = ts.transpileModule(locationSource, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
    .replace(/from ['"]\.\/slotSelection['"]/g, `from '${selectionModuleUrl}'`)
    .replace(/from ['"]\.\/slotTimeStatus['"]/g, `from '${timeModuleUrl}'`);
const { loadLocationsWithAvailability, loadCalendarWithAvailability } = await import(`data:text/javascript;base64,${Buffer.from(locationOutput).toString('base64')}`);

const slot = (id, start, end, overrides = {}) => ({
    timeSlotId: id, startTime: start, endTime: end,
    isBookable: true, remaining: 1, isFull: false, isBlocked: false, isTooSoon: false,
    ...overrides,
});
const first = slot(1, '10:00', '11:00');
const next = slot(2, '11:00', '12:00');

test('any available slot can start a selection', () => {
    assert.equal(canAddSlot(first, []), true);
});

test('own bookings cannot be selected even when seats remain or an old selection is restored', () => {
    const mine = { ...next, isBookedByMe: true };
    assert.equal(canAddSlot(mine, []), false);
    assert.equal(canAddSlot(mine, [first]), false);
    assert.equal(isContinuousSelection([first, mine]), false);
    assert.deepEqual(toggleSlot(mine, []), []);
    assert.deepEqual(toggleSlot(mine, [first]), [first]);
    for (const selected of [[], [first], [mine]]) {
        const message = getSlotDisabledReason(mine, selected);
        assert.match(message, /Ви вже записані/);
        assert.match(message, /11:00–12:00/);
        assert.match(message, /Мої записи/);
    }
});

test('own booking explanation takes priority over full, blocked or finished states', () => {
    const mine = { ...first, isBookedByMe: true, remaining: 0, isFull: true, isBlocked: true, isTooSoon: true, isBookable: false };
    assert.match(getSlotDisabledReason(mine, [], true, 'finished'), /Ви вже записані/);
    assert.equal(canAddSlot(mine, []), false);
    assert.equal(canAddSlot({ ...first, isBookedByMe: false }, []), true);
});
test('extends either end and unlocks the next adjacent slot', () => {
    assert.equal(canAddSlot(slot(3, '09:00', '10:00'), [first]), true);
    assert.equal(canAddSlot(next, [first]), true);
    assert.equal(canAddSlot(slot(4, '12:00', '13:00'), [first]), false);
    assert.equal(canAddSlot(slot(4, '12:00', '13:00'), [next, first]), true);
});
test('rejects breaks, overlaps, duplicate slots and invalid durations', () => {
    assert.equal(canAddSlot(slot(3, '11:30', '12:30'), [first]), false);
    assert.equal(canAddSlot(slot(3, '10:30', '11:30'), [first]), false);
    assert.equal(canAddSlot(first, [first]), false);
    assert.equal(canAddSlot(slot(3, '11:00', '11:00'), [first]), false);
});
test('full, blocked, too-soon and otherwise unavailable slots cannot extend the range', () => {
    for (const overrides of [{ remaining: 0 }, { isFull: true }, { isBlocked: true }, { isTooSoon: true }, { isBookable: false }]) {
        assert.equal(canAddSlot({ ...next, ...overrides }, [first]), false);
    }
    assert.equal(canAddSlot(slot(3, '12:00', '13:00'), [first]), false);
});
test('requires a nonempty continuous bookable selection regardless of input order', () => {
    assert.equal(isContinuousSelection([]), false);
    assert.equal(isContinuousSelection([next, first]), true);
    assert.equal(isContinuousSelection([first, slot(3, '12:00', '13:00')]), false);
});

test('unchecking removes that slot and every later selected slot', () => {
    const last = slot(3, '12:00', '13:00');
    assert.deepEqual(toggleSlot(next, [last, first, next]), [first]);
    assert.deepEqual(toggleSlot(first, [first, next]), []);
    assert.deepEqual(toggleSlot(last, [first, next, last]), [first, next]);
});

test('clearing allows choosing a new range and gaps remain disabled', () => {
    assert.deepEqual(toggleSlot(slot(3, '12:00', '13:00'), [first]), [first]);
    const empty = toggleSlot(first, [first, next]);
    assert.deepEqual(toggleSlot(slot(3, '14:00', '15:00'), empty).map((item) => item.timeSlotId), [3]);
});

test('available adjacent slots need no warning', () => {
    assert.equal(getSlotDisabledReason(first, []), null);
    assert.equal(getSlotDisabledReason(next, [first]), null);
});

test('unavailable hints identify the actual availability restriction before adjacency', () => {
    const distant = slot(3, '14:00', '15:00');
    assert.match(getSlotDisabledReason({ ...distant, remaining: 0 }, [first]), /немає вільних місць/);
    assert.match(getSlotDisabledReason({ ...distant, isBlocked: true, isFull: true }, [first]), /заблоковано/);
    assert.match(getSlotDisabledReason({ ...distant, isTooSoon: true, isFull: true }, [first]), /замало часу/);
    assert.match(getSlotDisabledReason({ ...distant, isBookable: false }, [first]), /Запис на цей час недоступний/);
    assert.match(getSlotDisabledReason(first, [], true), /минулі дати/);
});

test('gap hints name the current range boundaries and forbid skipping unavailable slots', () => {
    const message = getSlotDisabledReason(slot(3, '14:00', '15:00'), [next, first]);
    assert.match(message, /10:00/);
    assert.match(message, /12:00/);
    assert.match(message, /без перерв/);
    assert.match(message, /Пропускати зайняті чи недоступні записи не можна/);
    assert.match(getSlotDisabledReason(slot(4, '10:30', '11:30'), [first]), /перетинається/);
});

test('selected slots can still be unchecked when their availability changes', () => {
    const changed = { ...first, isBookable: false, isBlocked: true };
    assert.equal(getSlotDisabledReason(changed, [changed]), null);
    assert.deepEqual(toggleSlot(changed, [changed, next]), []);
    assert.match(getSlotDisabledReason(slot(3, '12:00', '13:00'), [changed, next]), /більше недоступний/);
});

test('today distinguishes finished, running and upcoming shifts in Kyiv', () => {
    const now = new Date('2026-10-15T16:00:00+03:00');
    assert.equal(getSlotTimeStatus('2026-10-15', slot(1, '09:00', '11:00'), now), 'finished');
    assert.equal(getSlotTimeStatus('2026-10-15', slot(2, '15:00', '17:00'), now), 'in-progress');
    assert.equal(getSlotTimeStatus('2026-10-15', slot(3, '17:00', '19:00'), now), 'upcoming');
});

test('shift starts inclusively and finishes exactly at its end time', () => {
    const shift = slot(1, '15:00', '17:00');
    assert.equal(getSlotTimeStatus('2026-10-15', shift, new Date('2026-10-15T14:59:59+03:00')), 'upcoming');
    assert.equal(getSlotTimeStatus('2026-10-15', shift, new Date('2026-10-15T15:00:00+03:00')), 'in-progress');
    assert.equal(getSlotTimeStatus('2026-10-15', shift, new Date('2026-10-15T17:00:00+03:00')), 'finished');
});

test('Kyiv date boundaries work independently of the browser timezone', () => {
    const now = new Date('2026-10-14T21:30:00Z'); // 00:30 on 15 October in Kyiv.
    const shift = slot(1, '00:00', '01:00');
    assert.equal(getSlotTimeStatus('2026-10-14', shift, now), 'finished');
    assert.equal(getSlotTimeStatus('2026-10-15', shift, now), 'in-progress');
    assert.equal(getSlotTimeStatus('2026-10-16', shift, now), 'upcoming');
    assert.equal(getSlotTimeStatus('2026-12-15', shift, new Date('2026-12-14T22:30:00Z')), 'in-progress');
});

test('finished and running hints take priority over capacity and lead-time flags', () => {
    const unavailable = { ...first, isBookable: false, isTooSoon: true, isFull: true, remaining: 0 };
    assert.match(getSlotDisabledReason(unavailable, [], false, 'finished'), /вже завершено/);
    assert.match(getSlotDisabledReason(unavailable, [], false, 'in-progress'), /вже триває/);
    assert.match(getSlotDisabledReason({ ...first, isFull: true }, []), /Запис на цей час недоступний/);
    assert.equal(getSlotDisabledReason(unavailable, [unavailable], false, 'finished'), null);
});

test('missing location availability is resolved using actual slot availability', async () => {
    const result = await loadLocationsWithAvailability('2026-10-15', {
        getLocations: async () => [{ id: 1 }, { id: 2, hasAvailableBookings: null }],
        getSlots: async (_, id) => id === 1
            ? [slot(1, '17:00', '19:00', { isBookable: false, isTooSoon: true, isFull: true })]
            : [slot(2, '18:00', '20:00')],
    }, new Date('2026-10-15T16:30:00+03:00'));
    assert.equal(result[0].hasAvailableBookings, false);
    assert.equal(result[1].hasAvailableBookings, true);
});

test('location fallback does not advertise finished, running or full shifts', async () => {
    const result = await loadLocationsWithAvailability('2026-10-15', {
        getLocations: async () => [{ id: 1 }],
        getSlots: async () => [slot(1, '09:00', '11:00'), slot(2, '15:00', '17:00'), slot(3, '17:00', '19:00', { remaining: 0 })],
    }, new Date('2026-10-15T16:30:00+03:00'));
    assert.equal(result[0].hasAvailableBookings, false);
});

test('known server availability avoids extra slot requests', async () => {
    const locations = [{ id: 1, hasAvailableBookings: false }, { id: 2, hasAvailableBookings: true }];
    const result = await loadLocationsWithAvailability('2026-10-15', {
        getLocations: async () => locations,
        getSlots: async () => { assert.fail('Known availability should not trigger fallback requests'); },
    });
    assert.deepEqual(result, locations);
});

const calendar = {
    bookableDates: ['2026-10-15', '2026-10-16'],
    pastDates: ['2026-10-14'],
    earliestBookableDate: '2026-10-15', latestBookableDate: '2026-10-29',
};

test('current calendar availability avoids redundant location and slot requests', async () => {
    const current = { ...calendar, readOnlyDates: [] };
    const result = await loadCalendarWithAvailability({
        getCalendar: async () => current,
        getLocations: async () => assert.fail('Current server already checked today'),
        getSlots: async () => assert.fail('Current server already checked today'),
    }, new Date('2026-10-15T16:30:00+03:00'));
    assert.equal(result, current);
});

test('calendar makes 15 October read-only when every location has closed booking', async () => {
    const result = await loadCalendarWithAvailability({
        getCalendar: async () => calendar,
        getLocations: async () => [{ id: 1 }, { id: 2 }],
        getSlots: async () => [
            slot(1, '09:00', '11:00', { isTooSoon: true, isBookable: false }),
            slot(2, '15:00', '17:00', { isTooSoon: true, isBookable: false }),
            slot(3, '17:00', '19:00', { isTooSoon: true, isBookable: false }),
        ],
    }, new Date('2026-10-15T16:30:00+03:00'));
    assert.deepEqual(result.bookableDates, ['2026-10-16']);
    assert.deepEqual(result.readOnlyDates, ['2026-10-15']);
    assert.deepEqual(result.pastDates, ['2026-10-14']);
    assert.deepEqual(calendar.bookableDates, ['2026-10-15', '2026-10-16']);
});

test('calendar keeps today bookable if any location still has an available shift', async () => {
    const result = await loadCalendarWithAvailability({
        getCalendar: async () => calendar,
        getLocations: async () => [{ id: 1, hasAvailableBookings: false }, { id: 2, hasAvailableBookings: true }],
        getSlots: async () => { assert.fail('Server availability should be reused'); },
    }, new Date('2026-10-15T16:30:00+03:00'));
    assert.equal(result, calendar);
});

test('calendar refresh changes today to read-only when the final slot closes', async () => {
    const api = {
        getCalendar: async () => calendar,
        getLocations: async () => [{ id: 1 }],
        getSlots: async () => [slot(1, '17:00', '19:00')],
    };
    const before = await loadCalendarWithAvailability(api, new Date('2026-10-15T16:30:00+03:00'));
    const after = await loadCalendarWithAvailability(api, new Date('2026-10-15T17:00:00+03:00'));
    assert.equal(before.bookableDates.includes('2026-10-15'), true);
    assert.equal(after.bookableDates.includes('2026-10-15'), false);
    assert.equal(after.readOnlyDates.includes('2026-10-15'), true);
});

test('already read-only or unavailable dates do not trigger additional availability requests', async () => {
    const closed = { ...calendar, bookableDates: ['2026-10-16'], readOnlyDates: ['2026-10-15'] };
    const result = await loadCalendarWithAvailability({
        getCalendar: async () => closed,
        getLocations: async () => { assert.fail('Already read-only calendar needs no fallback'); },
        getSlots: async () => { assert.fail('Already read-only calendar needs no fallback'); },
    }, new Date('2026-10-15T16:30:00+03:00'));
    assert.equal(result, closed);
});
