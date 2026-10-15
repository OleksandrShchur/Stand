import { useEffect, useState, useSyncExternalStore } from 'react';
import { Box, LinearProgress, Paper, Typography } from '@mui/material';
import { requestActivity } from '../api/requestActivity';

function PendingProgress() {
    const [slow, setSlow] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => setSlow(true), 8000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <Box sx={{ position: 'fixed', inset: '0 0 auto', zIndex: (theme) => theme.zIndex.tooltip + 1, pointerEvents: 'none' }}>
            <LinearProgress className="request-progress" aria-label="Очікуємо відповідь сервера" />
            {slow && (
                <Paper role="status" className="content-enter" elevation={3} sx={{ mx: 'auto', mt: 1.5, p: 2, width: 'calc(100% - 32px)', maxWidth: 420, border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Це займає трохи більше часу…</Typography>
                    <Typography variant="body2" color="text.secondary">Очікуємо відповідь сервера. Будь ласка, залишайтеся на сторінці до завершення операції.</Typography>
                </Paper>
            )}
        </Box>
    );
}

export default function RequestProgress() {
    const pending = useSyncExternalStore(requestActivity.subscribe, requestActivity.getSnapshot);
    return pending ? <PendingProgress /> : null;
}
