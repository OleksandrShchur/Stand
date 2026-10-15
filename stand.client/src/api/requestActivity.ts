// Track the whole request, including response parsing and file downloads.
let pending = 0;
const listeners = new Set<() => void>();

export const requestActivity = {
    subscribe(listener: () => void) {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
    },
    getSnapshot: () => pending > 0,
};

export async function trackRequest<T>(work: () => Promise<T>): Promise<T> {
    pending += 1;
    listeners.forEach((listener) => listener());
    try {
        return await work();
    } finally {
        pending -= 1;
        listeners.forEach((listener) => listener());
    }
}
