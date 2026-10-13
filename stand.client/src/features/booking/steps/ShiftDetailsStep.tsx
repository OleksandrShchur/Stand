import { useEffect, useState } from 'react';
import { Avatar, Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { publicApi } from '../../../api/publicApi';
import { ApiError } from '../../../api/client';
import { ErrorState, SkeletonList } from '../../../components/StateMessage';
import type { BookingSummaryDto, SlotAvailabilityDto } from '../../../api/types';
import { formatDateFull, todayIso } from '../../../utils/date';
import { bookingCopy } from '../bookingCopy';

export default function ShiftDetailsStep({ date, locationId, locationName, locationAddress, timeSlotId, onConfirmed, onUnavailable }: {
    date: string;
    locationId: number;
    locationName: string;
    locationAddress?: string | null;
    timeSlotId: number;
    onConfirmed?: (summary: BookingSummaryDto) => void;
    onUnavailable?: (message?: string) => void;
}) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [slot, setSlot] = useState<SlotAvailabilityDto | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [bookingError, setBookingError] = useState<string | null>(null);
    const canConfirm = Boolean(onConfirmed) && date >= todayIso();

    const load = () => {
        setLoading(true);
        setError(null);
        publicApi.getSlots(date, locationId).then((slots) => {
            const found = slots.find((item) => item.timeSlotId === timeSlotId);
            if (!found) throw new Error('Зміну не знайдено.');
            setSlot(found);
        }).catch((e) => setError(e instanceof ApiError || e instanceof Error ? e.message : 'Не вдалося завантажити зміну.'))
            .finally(() => setLoading(false));
    };
    useEffect(load, [date, locationId, timeSlotId]);

    const confirm = () => {
        if (!slot?.isBookable || !onConfirmed || !canConfirm || submitting) return;
        setSubmitting(true);
        setBookingError(null);
        publicApi.book(date, locationId, timeSlotId).then(onConfirmed)
            .catch((e) => {
                const conflict = e instanceof ApiError && ['SLOT_FULL', 'SLOT_TOO_SOON', 'DATE_NOT_BOOKABLE', 'TIME_SLOT_BLOCKED', 'LOCATION_INACTIVE'].includes(e.errorCode ?? '');
                if (conflict) {
                    load();
                    onUnavailable?.(bookingCopy.conflict);
                    return;
                }
                setBookingError(e instanceof ApiError ? e.message : 'Не вдалося підтвердити запис. Спробуйте ще раз.');
            }).finally(() => setSubmitting(false));
    };

    if (loading) return <SkeletonList rows={3} />;
    if (error) return <ErrorState message={error} onRetry={load} />;
    if (!slot) return null;

    const participants = [
        ...slot.participants.map((participant) => ({
            name: [participant.firstName, participant.lastName].filter(Boolean).join(' ') || 'Учасник',
            isCurrentUser: false,
        })),
        ...(canConfirm ? [{ name: bookingCopy.you, isCurrentUser: true }] : []),
    ];

    return (
        <Box>
            <Typography variant="h5" sx={{ mb: 2 }}>{canConfirm ? bookingCopy.confirmHeading : bookingCopy.shiftDetails}</Typography>
            <Card variant="outlined">
                <CardContent>
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                        {formatDateFull(date)}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1, whiteSpace: 'nowrap' }}>
                        {slot.startTime}-{slot.endTime}
                    </Typography>
                    <Typography sx={{ fontWeight: 800, overflowWrap: 'anywhere' }}>{locationName}</Typography>
                    {locationAddress && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{locationAddress}</Typography>}

                    <Typography variant="subtitle2" sx={{ mb: 1, mt: 2 }}>{bookingCopy.participants}</Typography>
                    <Stack spacing={1}>
                        {participants.map((participant, index) => (
                            <Stack key={`${participant.name}-${index}`} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: participant.isCurrentUser ? 'primary.main' : 'var(--state-available-bg)', color: participant.isCurrentUser ? 'common.white' : 'primary.dark' }}>
                                    {participant.isCurrentUser ? <CheckIcon sx={{ fontSize: 16 }} /> : participant.name[0]?.toUpperCase()}
                                </Avatar>
                                <Typography variant="body2" sx={{ fontWeight: participant.isCurrentUser ? 800 : 500 }}>
                                    {participant.name}
                                </Typography>
                            </Stack>
                        ))}
                    </Stack>

                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                        {canConfirm ? bookingCopy.cancellationNote : bookingCopy.readOnly}
                    </Typography>
                </CardContent>
            </Card>

            {bookingError && <Box sx={{ mt: 2 }}><ErrorState message={bookingError} /></Box>}
            {canConfirm && (
                <Box sx={{ mt: 3 }}>
                    {slot.isBookable ? (
                        <Button variant="contained" size="large" fullWidth startIcon={<CheckIcon />} disabled={submitting} onClick={confirm}>
                            {submitting ? bookingCopy.confirming : bookingCopy.confirmAction}
                        </Button>
                    ) : (
                        <Stack spacing={1.5}>
                            <Typography variant="body2" color="text.secondary">Запис на цей час недоступний.</Typography>
                            {onUnavailable && <Button variant="outlined" fullWidth onClick={() => onUnavailable(bookingCopy.conflict)}>Обрати час ще раз</Button>}
                        </Stack>
                    )}
                </Box>
            )}
        </Box>
    );
}
