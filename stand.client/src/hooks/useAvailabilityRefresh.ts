import { useCallback, useEffect, useRef } from 'react';
import { startAvailabilityRefresh, type RefreshAvailability } from './availabilityRefresh';

// One refresh at a time. Hidden tabs catch up when visible; focus events are
// coalesced with visibility events and the regular poll.
export function useAvailabilityRefresh(refresh: RefreshAvailability, identity: string): () => void {
    const latest = useRef(refresh);
    const trigger = useRef<() => void>(() => {});
    useEffect(() => { latest.current = refresh; });
    useEffect(() => {
        const poller = startAvailabilityRefresh((signal, initial) => latest.current(signal, initial));
        trigger.current = poller.refresh;
        return () => { trigger.current = () => {}; poller.dispose(); };
    }, [identity]);
    return useCallback(() => { trigger.current(); }, []);
}
