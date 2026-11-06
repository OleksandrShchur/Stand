import { afterEach, expect, test, vi } from 'vitest';
import { clearWizardState, initialWizardState, loadWizardState, saveWizardState } from '../src/features/booking/wizardState';
import { bookingCopy } from '../src/features/booking/bookingCopy';

afterEach(() => vi.unstubAllGlobals());

test('a draft survives reload and clears after completion', () => {
    const map = new Map();
    vi.stubGlobal('sessionStorage', { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) });
    expect(loadWizardState()).toEqual(initialWizardState);
    const draft = { step: 'time', date: '2026-11-06', locationId: 12, timeSlotIds: [1, 2] };
    saveWizardState(draft);
    expect(loadWizardState()).toEqual(draft);
    clearWizardState();
    expect(loadWizardState()).toEqual(initialWizardState);
});

test('corrupt or unavailable storage safely falls back to a fresh draft', () => {
    vi.stubGlobal('sessionStorage', { getItem: () => '{invalid' });
    expect(loadWizardState()).toEqual(initialWizardState);
    const fail = () => { throw new Error('private browsing'); };
    vi.stubGlobal('sessionStorage', { getItem: fail, setItem: fail, removeItem: fail });
    expect(loadWizardState()).toEqual(initialWizardState);
    expect(() => saveWizardState({ step: 'date' })).not.toThrow();
    expect(() => clearWizardState()).not.toThrow();
});

test('occupancy text never advertises negative remaining places', () => {
    expect(bookingCopy.occupancy(3, 2)).toContain('0 вільно');
    expect(bookingCopy.occupancy(1, 2)).toContain('1 вільно');
    expect(bookingCopy.upcomingCount(4)).toContain('4');
});
