import { useId, type ReactNode } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';

interface Props {
    open: boolean;
    title: string;
    description: string;
    children?: ReactNode;
    confirmLabel?: string;
    busy?: boolean;
    error?: string | null;
    onCancel: () => void;
    onConfirm: () => void;
}

export default function ConfirmDeleteDialog({ open, title, description, children, confirmLabel = 'Видалити', busy = false, error, onCancel, onConfirm }: Props) {
    const id = useId();
    return <Dialog open={open} onClose={() => { if (!busy) onCancel(); }} fullWidth maxWidth="xs"
        aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
        <DialogTitle id={`${id}-title`}>{title}</DialogTitle>
        <DialogContent sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            {children}
            <Typography id={`${id}-description`} sx={{ mt: children ? 2 : 0 }}>{description}</Typography>
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Button variant="outlined" autoFocus disabled={busy} onClick={onCancel}>Скасувати</Button>
            <Button variant="contained" color="error" loading={busy} disabled={busy} onClick={onConfirm}>{confirmLabel}</Button>
        </DialogActions>
    </Dialog>;
}
