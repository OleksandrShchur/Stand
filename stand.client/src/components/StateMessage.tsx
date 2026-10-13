import { Alert, Box, CircularProgress, Typography } from '@mui/material';

export function LoadingState({ label = 'Завантаження…' }: { label?: string }) {
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
            sx={{ borderRadius: 2 }}
            action={
                onRetry ? (
                    <Typography
                        variant="button"
                        onClick={onRetry}
                        sx={{ cursor: 'pointer', fontWeight: 700, textDecoration: 'underline', pr: 1 }}
                    >
                        Повторити
                    </Typography>
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
