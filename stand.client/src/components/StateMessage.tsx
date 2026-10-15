import { Alert, Box, Button, CircularProgress, Skeleton, Stack, Typography } from '@mui/material';
import { bookingCopy } from '../features/booking/bookingCopy';

export function LoadingState({ label = 'Завантаження…', fullScreen = false }: { label?: string; fullScreen?: boolean }) {
    return (
        <Box role="status" className="content-enter" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, py: 6, px: 2, minHeight: fullScreen ? '100dvh' : 200, textAlign: 'center' }}>
            <CircularProgress color="primary" aria-hidden="true" />
            <Typography variant="body2" color="text.secondary">{label}</Typography>
        </Box>
    );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
    return (
        <Alert
            severity="error"
            sx={{ borderRadius: 1 }}
            action={
                onRetry ? (
                    <Button size="small" color="inherit" onClick={onRetry} sx={{ fontWeight: 700 }}>
                        {bookingCopy.retry}
                    </Button>
                ) : undefined
            }
        >
            {message}
        </Alert>
    );
}

export function EmptyState({ message }: { message: string }) {
    return (
        <Box sx={{ py: 5, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">{message}</Typography>
        </Box>
    );
}

export function SkeletonList({ rows = 3, label = 'Завантажуємо дані…' }: { rows?: number; label?: string }) {
    return (
        <Stack spacing={1.25} role="status">
            <Typography variant="body2" color="text.secondary">{label}</Typography>
            {Array.from({ length: rows }, (_, index) => (
                <Skeleton key={index} aria-hidden="true" variant="rounded" height={index === 0 ? 72 : 84} />
            ))}
        </Stack>
    );
}
