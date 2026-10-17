// Keep the same key across manual retries and reloads after an uncertain result.
// Clear it on success so a later intentional booking is a new operation.
const storageKey = 'stand_pending_booking_request';
let pending: { payload: string; key: string } | undefined;

export function bookingRequestKey(date: string, locationId: number, timeSlotIds: number[]): string {
    const payload = JSON.stringify([date, locationId, [...timeSlotIds].sort((a, b) => a - b)]);
    if (!pending) {
        try { pending = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') ?? undefined; } catch { /* Storage may be unavailable. */ }
    }
    if (!pending || pending.payload !== payload) {
        pending = { payload, key: crypto.randomUUID() };
        try { sessionStorage.setItem(storageKey, JSON.stringify(pending)); } catch { /* In-memory retries still work. */ }
    }
    return pending.key;
}

export function clearBookingRequest(): void {
    pending = undefined;
    try { sessionStorage.removeItem(storageKey); } catch { /* Storage may be unavailable. */ }
}
