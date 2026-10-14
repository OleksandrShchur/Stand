import { useId, type ReactNode } from 'react';
import { Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';

interface AppDialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    icon: ReactNode;
    children: ReactNode;
    actions: ReactNode;
    'aria-describedby'?: string;
}

export default function AppDialog({ open, onClose, title, icon, children, actions, 'aria-describedby': describedBy }: AppDialogProps) {
    const titleId = useId();

    return (
        <Dialog
            open={open}
            onClose={onClose}
            aria-labelledby={titleId}
            aria-describedby={describedBy}
            fullWidth
            maxWidth="xs"
            slotProps={{ paper: { sx: { border: '1px solid', borderColor: 'divider' } } }}
        >
            <DialogTitle id={titleId} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: 2, bgcolor: 'background.default', color: 'primary.dark', borderBottom: '1px solid', borderColor: 'divider', fontWeight: 700 }}>
                {icon}
                {title}
            </DialogTitle>
            <DialogContent sx={{ p: 2, '&.MuiDialogContent-root': { pt: 2 } }}>
                {children}
            </DialogContent>
            <DialogActions sx={{ px: 2, pt: 0, pb: 2 }}>
                {actions}
            </DialogActions>
        </Dialog>
    );
}
