export type WizardStep = 'date' | 'location' | 'time' | 'contact';

export interface WizardState {
    step: WizardStep;
    date?: string;
    locationId?: number;
    locationName?: string;
    locationAddress?: string | null;
    timeSlotId?: number;
    startTime?: string;
    endTime?: string;
    holdToken?: string;
    holdExpiresAtUtc?: string;
}

const STORAGE_KEY = 'stand.booking.wizard.v1';

export const initialWizardState: WizardState = { step: 'date' };

export function loadWizardState(): WizardState {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return initialWizardState;
        const parsed = JSON.parse(raw) as WizardState;

        // If a previously held slot has already expired, drop back to the time step
        // rather than resurrecting a dead hold.
        if (parsed.holdExpiresAtUtc && new Date(parsed.holdExpiresAtUtc).getTime() <= Date.now()) {
            return { ...parsed, step: 'time', holdToken: undefined, holdExpiresAtUtc: undefined };
        }

        return parsed;
    } catch {
        return initialWizardState;
    }
}

export function saveWizardState(state: WizardState): void {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // ignore storage errors (e.g. private mode)
    }
}

export function clearWizardState(): void {
    try {
        sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        // ignore
    }
}
