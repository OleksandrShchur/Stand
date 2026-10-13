import { useState } from 'react';
import { Box, Button, Card, CardContent, Chip, Stack, TextField, Typography } from '@mui/material';
import { publicApi } from '../../../api/publicApi';
import { ApiError } from '../../../api/client';
import { ErrorState } from '../../../components/StateMessage';
import HoldCountdown from '../components/HoldCountdown';
import type { BookingSummaryDto } from '../../../api/types';
import { formatDateFull } from '../../../utils/date';

export default function ContactStep({
    holdToken,
    expiresAtUtc,
    date,
    locationName,
    locationAddress,
    startTime,
    endTime,
    onExpired,
    onConfirmed,
}: {
    holdToken: string;
    expiresAtUtc: string;
    date: string;
    locationName: string;
    locationAddress?: string | null;
    startTime: string;
    endTime: string;
    onExpired: () => void;
    onConfirmed: (summary: BookingSummaryDto) => void;
}) {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [comment, setComment] = useState('');
    const [touched, setTouched] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expired, setExpired] = useState(false);

    const firstNameError = touched && firstName.trim().length === 0 ? "Вкажіть ім'я" : null;
    const lastNameError = touched && lastName.trim().length === 0 ? 'Вкажіть прізвище' : null;
    const phoneError = touched && !isLikelyUaPhone(phone) ? 'Телефон у форматі +380XXXXXXXXX' : null;
    const commentError = comment.length > 500 ? 'Максимум 500 символів' : null;

    const isValid =
        firstName.trim().length > 0 &&
        lastName.trim().length > 0 &&
        isLikelyUaPhone(phone) &&
        comment.length <= 500;

    const handleSubmit = () => {
        setTouched(true);
        setError(null);
        if (!isValid || submitting || expired) return;

        setSubmitting(true);
        publicApi
            .confirm(holdToken, firstName.trim(), lastName.trim(), phone.trim(), comment.trim())
            .then(onConfirmed)
            .catch((e) => {
                if (e instanceof ApiError && (e.errorCode === 'HOLD_EXPIRED' || e.errorCode === 'HOLD_NOT_FOUND')) {
                    setExpired(true);
                } else {
                    setError(e instanceof ApiError ? e.message : 'Не вдалося підтвердити запис. Спробуйте ще раз.');
                }
            })
            .finally(() => setSubmitting(false));
    };

    return (
        <Box sx={{ pb: 10 }}>
            <Typography variant="h5" sx={{ mb: 1.5 }}>Ваші контакти</Typography>

            <Card variant="outlined" sx={{ mb: 2, bgcolor: 'background.default' }}>
                <CardContent sx={{ py: 1.5 }}>
                    <Stack direction="row" spacing={1} sx={{ mb: 0.5, flexWrap: 'wrap' }}>
                        <Chip size="small" color="primary" variant="outlined" label={formatDateFull(date)} />
                        <Chip size="small" variant="outlined" label={`${startTime}–${endTime}`} />
                    </Stack>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{locationName}</Typography>
                    {locationAddress && <Typography variant="caption" color="text.secondary">{locationAddress}</Typography>}
                </CardContent>
            </Card>

            {!expired ? (
                <Box sx={{ mb: 2.5 }}>
                    <HoldCountdown
                        expiresAtUtc={expiresAtUtc}
                        onExpire={() => {
                            setExpired(true);
                        }}
                    />
                </Box>
            ) : (
                <Box sx={{ mb: 2.5 }}>
                    <ErrorState message="Час утримання місця минув. Оберіть час ще раз." />
                    <Button fullWidth variant="contained" sx={{ mt: 1.5 }} onClick={onExpired}>
                        Обрати час ще раз
                    </Button>
                </Box>
            )}

            {!expired && (
                <Stack spacing={2}>
                    <TextField
                        label="Ім'я"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        error={!!firstNameError}
                        helperText={firstNameError}
                        fullWidth
                        autoComplete="given-name"
                        slotProps={{ htmlInput: { maxLength: 100 } }}
                    />
                    <TextField
                        label="Прізвище"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        error={!!lastNameError}
                        helperText={lastNameError}
                        fullWidth
                        autoComplete="family-name"
                        slotProps={{ htmlInput: { maxLength: 100 } }}
                    />
                    <TextField
                        label="Телефон"
                        placeholder="+380 XX XXX XX XX"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        error={!!phoneError}
                        helperText={phoneError ?? 'Український номер, наприклад +380671234567'}
                        fullWidth
                        type="tel"
                        autoComplete="tel"
                        slotProps={{ htmlInput: { maxLength: 20 } }}
                    />
                    <TextField
                        label="Коментар (необов'язково)"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        error={!!commentError}
                        helperText={commentError ?? `${comment.length}/500`}
                        fullWidth
                        multiline
                        minRows={2}
                        maxRows={4}
                        slotProps={{ htmlInput: { maxLength: 500 } }}
                    />

                    {error && <ErrorState message={error} />}

                    <Button
                        variant="contained"
                        size="large"
                        fullWidth
                        disabled={submitting}
                        onClick={handleSubmit}
                    >
                        {submitting ? 'Підтверджуємо…' : 'Підтвердити запис'}
                    </Button>
                </Stack>
            )}
        </Box>
    );
}

function isLikelyUaPhone(value: string): boolean {
    const digits = value.replace(/[^\d]/g, '');
    return (
        (digits.length === 12 && digits.startsWith('380')) ||
        (digits.length === 10 && digits.startsWith('0')) ||
        (digits.length === 9)
    );
}
