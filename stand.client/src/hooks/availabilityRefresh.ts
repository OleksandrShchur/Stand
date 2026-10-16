export type RefreshAvailability = (signal: AbortSignal, initial: boolean) => Promise<void>;

export function startAvailabilityRefresh(refresh: RefreshAvailability) {
    let disposed = false;
    let request: AbortController | undefined;
    let initial = true;
    let lastStarted = 0;
    const run = (force = false) => {
        if (disposed || document.visibilityState === 'hidden' || request || (!force && Date.now() - lastStarted < 1000)) return;
        const controller = new AbortController();
        request = controller;
        lastStarted = Date.now();
        const first = initial || force;
        initial = false;
        void Promise.resolve().then(() => {
            if (!controller.signal.aborted) return refresh(controller.signal, first);
        })
            .catch(() => { /* The view handles initial errors and preserves background data. */ })
            .finally(() => { if (request === controller) request = undefined; });
    };
    const onVisible = () => { run(); };
    const timer = window.setInterval(onVisible, 30000);
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    run(true);
    return {
        refresh: () => { run(true); },
        dispose: () => {
            disposed = true;
            request?.abort();
            window.clearInterval(timer);
            window.removeEventListener('focus', onVisible);
            document.removeEventListener('visibilitychange', onVisible);
        },
    };
}
