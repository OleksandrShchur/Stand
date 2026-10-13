import { Alert, Box, Button, CircularProgress, Skeleton, Stack, Typography } from '@mui/material';
import { bookingCopy } from '../features/booking/bookingCopy';

export function LoadingState({ label = 'Завантаження...' }: { label?: string }) {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, py: 6 }}>
            <CircularProgress color="primary" />
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

export function SkeletonList({ rows = 3 }: { rows?: number }) {
    return (
        <Stack spacing={1.25} aria-label="Завантаження">
            {Array.from({ length: rows }, (_, index) => (
                <Skeleton key={index} variant="rounded" height={index === 0 ? 72 : 84} />
            ))}
        </Stack>
    );
}
