import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Card, CardContent, Container, TextField, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useAdminAuth } from './AdminAuthContext';
import { ApiError } from '../../api/client';
import { ErrorState } from '../../components/StateMessage';
import BrandHeader from '../../components/BrandHeader';
import { pagePadding } from '../../layoutSpacing';

export default function AdminLoginPage() {
    const { login } = useAdminAuth();
    const navigate = useNavigate();
    const [loginValue, setLoginValue] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!loginValue || !password || submitting) return;
        setSubmitting(true);
        setError(null);
        login(loginValue, password)
            .then(() => navigate('/admin', { replace: true }))
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
                            <LockOutlinedIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
                            <Typography variant="h5" sx={{ fontWeight: 700 }}>Вхід для адміністратора</Typography>
                        </Box>

                        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <TextField
                                label="Логін"
                                value={loginValue}
                                onChange={(e) => setLoginValue(e.target.value)}
                                autoComplete="username"
                                fullWidth
                                autoFocus
                            />
                            <TextField
                                label="Пароль"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                                fullWidth
                            />

                            {error && <ErrorState message={error} />}

                            <Button type="submit" variant="contained" size="large" disabled={submitting} fullWidth>
                                {submitting ? 'Входимо…' : 'Увійти'}
                            </Button>
                        </Box>
                    </CardContent>
                </Card>
            </Container>
        </Box>
    );
}
