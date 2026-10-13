import { useEffect, useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { publicApi } from '../../../api/publicApi';
import { ApiError } from '../../../api/client';
import { ErrorState, LoadingState } from '../../../components/StateMessage';
import type { BookingSummaryDto, SlotAvailabilityDto } from '../../../api/types';
import { formatDateFull } from '../../../utils/date';

export default function ShiftDetailsStep({ date, locationId, locationName, locationAddress, timeSlotId, onConfirmed, onUnavailable }: {
    date: string;
    locationId: number;
    locationName: string;
    locationAddress?: string | null;
    timeSlotId: number;
    onConfirmed?: (summary: BookingSummaryDto) => void;
    onUnavailable?: () => void;
}) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [slot, setSlot] = useState<SlotAvailabilityDto | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [bookingError, setBookingError] = useState<string | null>(null);
    const load = () => {
        setLoading(true);
        setError(null);
        publicApi.getSlots(date, locationId).then((slots) => {
            const found = slots.find((item) => item.timeSlotId === timeSlotId);
            if (!found) throw new Error('Чергування не знайдено.');
            setSlot(found);
        }).catch((e) => setError(e instanceof ApiError || e instanceof Error ? e.message : 'Не вдалося завантажити чергування.'))
            .finally(() => setLoading(false));
    };
    useEffect(load, [date, locationId, timeSlotId]);

    const confirm = () => {
        if (!slot?.isBookable || !onConfirmed || submitting) return;
        setSubmitting(true);
        setBookingError(null);
        publicApi.book(date, locationId, timeSlotId).then(onConfirmed)
            .catch((e) => {
                setBookingError(e instanceof ApiError ? e.message : 'Не вдалося підтвердити запис. Спробуйте ще раз.');
                if (e instanceof ApiError && ['SLOT_FULL', 'SLOT_TOO_SOON', 'DATE_NOT_BOOKABLE', 'TIME_SLOT_BLOCKED', 'LOCATION_INACTIVE'].includes(e.errorCode ?? '')) {
                    load();
                }
            }).finally(() => setSubmitting(false));
    };

    if (loading) return <LoadingState />;
    if (error) return <ErrorState message={error} onRetry={load} />;
    if (!slot) return null;

    return (
        <Box>
            <Typography variant="h5" sx={{ mb: 2 }}>Чергування</Typography>
            <Stack spacing={0.5} sx={{ mb: 3 }}>
                <Typography variant="body2">{formatDateFull(date)}</Typography>
                <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{locationName}</Typography>
                {locationAddress && <Typography variant="body2" color="text.secondary">{locationAddress}</Typography>}
                <Typography>{slot.startTime}–{slot.endTime}</Typography>
                <Typography variant="body2" color="text.secondary">Зайнято місць: {slot.booked}/{slot.capacity}</Typography>
            </Stack>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Учасники</Typography>
            {slot.participants.length > 0 ? (
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                    {slot.participants.map((participant, index) => (
                        <Typography component="li" variant="body2" key={index} sx={{ overflowWrap: 'anywhere', mb: 0.75 }}>
                            {[participant.firstName, participant.lastName].filter(Boolean).join(' ') || 'Учасник'}
                        </Typography>
                    ))}
                </Box>
            ) : <Typography variant="body2" color="text.secondary">Немає підтверджених учасників.</Typography>}
            {bookingError && <Box sx={{ mt: 2 }}><ErrorState message={bookingError} /></Box>}
            {onConfirmed && (
                <Box sx={{ mt: 3 }}>
                    {slot.isBookable ? (
                        <Button variant="contained" size="large" fullWidth startIcon={<CheckIcon />}
                            disabled={submitting} onClick={confirm}>
                            {submitting ? 'Підтверджуємо…' : 'Підтвердити запис'}
                        </Button>
                    ) : (
                        <Stack spacing={1.5}>
                            <Typography variant="body2" color="text.secondary">Запис на цей час недоступний.</Typography>
                            {onUnavailable && <Button variant="outlined" fullWidth onClick={onUnavailable}>Обрати час ще раз</Button>}
                        </Stack>
                    )}
                </Box>
            )}
        </Box>
    );
}
