import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/features/booking/slotSelection.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { canAddSlot, getSlotDisabledReason, isContinuousSelection, toggleSlot } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

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
    assert.match(getSlotDisabledReason({ ...distant, isBookable: false }, [first]), /Запис на цю зміну недоступний/);
    assert.match(getSlotDisabledReason(first, [], true), /минулі дати/);
});

test('gap hints name the current range boundaries and forbid skipping unavailable slots', () => {
    const message = getSlotDisabledReason(slot(3, '14:00', '15:00'), [next, first]);
    assert.match(message, /10:00/);
    assert.match(message, /12:00/);
    assert.match(message, /без перерв/);
    assert.match(message, /Пропускати зайняті чи недоступні зміни не можна/);
    assert.match(getSlotDisabledReason(slot(4, '10:30', '11:30'), [first]), /перетинається/);
});

test('selected slots can still be unchecked when their availability changes', () => {
    const changed = { ...first, isBookable: false, isBlocked: true };
    assert.equal(getSlotDisabledReason(changed, [changed]), null);
    assert.deepEqual(toggleSlot(changed, [changed, next]), []);
    assert.match(getSlotDisabledReason(slot(3, '12:00', '13:00'), [changed, next]), /більше недоступна/);
});
