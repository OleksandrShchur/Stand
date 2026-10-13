import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
    Box,
    Button,
    Card,
    CardContent,
    Container,
    InputAdornment,
    TextField,
    Typography,
} from '@mui/material';
import PhoneIphoneOutlinedIcon from '@mui/icons-material/PhoneIphoneOutlined';
import BrandHeader from '../../components/BrandHeader';
import { pagePadding } from '../../layoutSpacing';
import { LoadingState } from '../../components/StateMessage';
import { ApiError } from '../../api/client';
import { digitsOnly, formatUaPhoneDigits, toUaPhone, uaPhoneValidationError } from '../../utils/phone';
import { usePublicAuth } from './PublicAuthContext';

export default function UserLoginPage() {
    const { user, loading, login } = usePublicAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [digits, setDigits] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';

    if (loading) {
        return <LoadingState label="Перевіряємо сесію..." />;
    }

    if (user) {
        return <Navigate to={from} replace />;
    }

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        const validationError = uaPhoneValidationError(digits);
        if (validationError || submitting) {
            setError(validationError);
            return;
        }

        setSubmitting(true);
        setError(null);
        login(toUaPhone(digits))
            .then(() => navigate(from, { replace: true }))
            .catch((err) => setError(err instanceof ApiError ? err.message : 'Не вдалося увійти.'))
            .finally(() => setSubmitting(false));
    };

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
            <BrandHeader />
            <Container maxWidth="xs" sx={pagePadding}>
                <Card variant="outlined">
                    <CardContent>
                        <Box sx={{ textAlign: 'center', mb: 2 }}>
                            <PhoneIphoneOutlinedIcon color="primary" sx={{ fontSize: 42, mb: 1 }} />
                            <Typography variant="h5" sx={{ fontWeight: 700 }}>Вхід за номером телефону</Typography>
                        </Box>

                        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <TextField
                                label="Номер телефону"
                                value={formatUaPhoneDigits(digits)}
                                onChange={(e) => {
                                    setDigits(digitsOnly(e.target.value));
                                    setError(null);
                                }}
                                slotProps={{
                                    htmlInput: {
                                        inputMode: 'numeric',
                                        autoComplete: 'tel-national',
                                        'aria-label': 'Номер телефону після +380',
                                    },
                                    input: {
                                        startAdornment: <InputAdornment position="start">+380</InputAdornment>,
                                    },
                                }}
                                error={Boolean(error)}
                                helperText={error ?? ' '}
                                fullWidth
                                autoFocus
                            />

                            <Button type="submit" variant="contained" size="large" disabled={submitting} fullWidth>
                                {submitting ? 'Перевіряємо...' : 'Увійти'}
                            </Button>
                        </Box>
                    </CardContent>
                </Card>
            </Container>
        </Box>
    );
}
