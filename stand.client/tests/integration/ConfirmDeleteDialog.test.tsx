import { useState } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDeleteDialog from '../../src/components/ConfirmDeleteDialog';

afterEach(cleanup);

function Harness({ remove }: { remove: () => Promise<void> }) {
    const [open, setOpen] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    return <ConfirmDeleteDialog open={open} title="Remove location intervals?"
        description="Removes the location's intervals after saving the day. Existing bookings remain valid."
        confirmLabel="Remove" busy={busy} error={error} onCancel={() => setOpen(false)}
        onConfirm={() => {
            setBusy(true);
            void remove().then(() => setOpen(false)).catch(() => setError('Could not remove')).finally(() => setBusy(false));
        }} />;
}

test.each(['cancel', 'escape', 'backdrop'])('%s closes without removing data and Cancel has initial focus', async action => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<Harness remove={remove} />);
    const cancel = screen.getByRole('button', { name: 'Скасувати' });
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    expect(screen.getByRole('dialog').getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText(/Existing bookings remain valid/)).toBeTruthy();
    if (action === 'cancel') await user.click(cancel);
    if (action === 'escape') await user.keyboard('{Escape}');
    if (action === 'backdrop') await user.click(document.querySelector('.MuiDialog-container')!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(remove).not.toHaveBeenCalled();
});

test('confirmation submits once and prevents dismissal while awaiting deletion', async () => {
    let complete!: () => void;
    const remove = vi.fn(() => new Promise<void>(resolve => { complete = resolve; }));
    const user = userEvent.setup();
    render(<Harness remove={remove} />);
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    const confirm = screen.getByRole('button', { name: /Remove/ });
    expect(confirm.hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Скасувати' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(confirm);
    await user.keyboard('{Escape}');
    await user.click(document.querySelector('.MuiDialog-container')!);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(remove).toHaveBeenCalledOnce();
    complete();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});

test('failed deletion remains open with an error and allows an explicit retry', async () => {
    const remove = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<Harness remove={remove} />);
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(remove).toHaveBeenCalledTimes(2);
});
