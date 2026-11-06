import { afterEach, expect, test, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useAvailabilityRefresh } from '../../src/hooks/useAvailabilityRefresh';

afterEach(cleanup);

test('the hook uses the latest callback and disposes requests when identity changes or it unmounts', async () => {
    const first = vi.fn<(signal: AbortSignal, initial: boolean) => Promise<void>>().mockResolvedValue(undefined);
    // Keep this request pending so identity changes must abort it.
    const second = vi.fn<(signal: AbortSignal, initial: boolean) => Promise<void>>().mockImplementation(() => new Promise<void>(() => {}));
    const { result, rerender, unmount } = renderHook(({ refresh, identity }) => useAvailabilityRefresh(refresh, identity), {
        initialProps: { refresh: first, identity: 'date-one' },
    });
    await waitFor(() => expect(first).toHaveBeenCalledOnce());
    rerender({ refresh: second, identity: 'date-one' });
    await act(async () => result.current());
    await waitFor(() => expect(second).toHaveBeenCalledOnce());
    const initialSignal = second.mock.calls[0][0] as AbortSignal;
    rerender({ refresh: second, identity: 'date-two' });
    expect(initialSignal.aborted).toBe(true);
    await waitFor(() => expect(second).toHaveBeenCalledTimes(2));
    const finalSignal = second.mock.calls[1][0] as AbortSignal;
    unmount();
    expect(finalSignal.aborted).toBe(true);
    await act(async () => result.current());
    expect(second).toHaveBeenCalledTimes(2);
});
