export type WizardStep = 'date' | 'location' | 'time' | 'contact' | 'details';

export interface WizardState {
    step: WizardStep;
    date?: string;
    locationId?: number;
    locationName?: string;
    locationAddress?: string | null;
    timeSlotId?: number;
    timeSlotIds?: number[];
    startTime?: string;
    endTime?: string;
}

const STORAGE_KEY = 'stand.booking.wizard.v2';

export const initialWizardState: WizardState = { step: 'date' };

export function loadWizardState(): WizardState {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return initialWizardState;
        const parsed = JSON.parse(raw) as WizardState;

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
