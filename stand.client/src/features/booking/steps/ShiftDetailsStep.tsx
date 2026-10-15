import ParticipantList from '../components/ParticipantList';
import { useEffect, useState } from 'react';
import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { publicApi } from '../../../api/publicApi';
import { ApiError } from '../../../api/client';
import { ErrorState, SkeletonList } from '../../../components/StateMessage';
import type { BookingSummaryDto, SlotAvailabilityDto } from '../../../api/types';
import { formatDateFull, todayIso } from '../../../utils/date';
import { bookingCopy } from '../bookingCopy';
import { isContinuousSelection, sortSlots } from '../slotSelection';

export default function ShiftDetailsStep({ date, locationId, locationName, locationAddress, timeSlotId, timeSlotIds, onConfirmed, onUnavailable }: {
    date: string;
    locationId: number;
    locationName: string;
    locationAddress?: string | null;
    timeSlotId: number;
    timeSlotIds?: number[];
    onConfirmed?: (summaries: BookingSummaryDto[]) => void;
    onUnavailable?: (message?: string) => void;
}) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [slots, setSlots] = useState<SlotAvailabilityDto[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [bookingError, setBookingError] = useState<string | null>(null);
    const canConfirm = Boolean(onConfirmed) && date >= todayIso();

    const load = () => {
        setLoading(true);
        setError(null);
        publicApi.getSlots(date, locationId).then((slots) => {
            const ids = timeSlotIds?.length ? timeSlotIds : [timeSlotId];
            const found = slots.filter((item) => ids.includes(item.timeSlotId));
            if (found.length !== ids.length) throw new Error('Одну з обраних змін не знайдено. Оберіть час ще раз.');
            setSlots(sortSlots(found));
        }).catch((e) => setError(e instanceof ApiError || e instanceof Error ? e.message : 'Не вдалося завантажити зміну.'))
            .finally(() => setLoading(false));
    };
    useEffect(load, [date, locationId, timeSlotId, timeSlotIds]);

    const confirm = () => {
        if (!isContinuousSelection(slots) || !onConfirmed || !canConfirm || submitting) return;
        setSubmitting(true);
        setBookingError(null);
        publicApi.bookMany(date, locationId, slots.map((slot) => slot.timeSlotId)).then(onConfirmed)
            .catch((e) => {
                const conflict = e instanceof ApiError && ['SLOT_FULL', 'SLOT_TOO_SOON', 'DATE_NOT_BOOKABLE', 'TIME_SLOT_BLOCKED', 'LOCATION_INACTIVE', 'DUPLICATE_PHONE_SLOT'].includes(e.errorCode ?? '');
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
    if (!slots.length) return null;

    return (
        <Box>
            <Typography variant="h5" sx={{ mb: 2 }}>{canConfirm ? bookingCopy.confirmHeading : bookingCopy.shiftDetails}</Typography>
            <Card variant="outlined">
                <CardContent>
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                        {formatDateFull(date)}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1, whiteSpace: 'nowrap' }}>
                        {slots[0].startTime}-{slots[slots.length - 1].endTime}
                    </Typography>
                    <Typography sx={{ fontWeight: 800, overflowWrap: 'anywhere' }}>{locationName}</Typography>
                    {locationAddress && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{locationAddress}</Typography>}

                    {slots.map((slot) => (
                        <Box key={slot.timeSlotId}>
                            {slots.length > 1 && <Typography sx={{ mt: 1.5, fontWeight: 700 }}>{slot.startTime}-{slot.endTime}</Typography>}
                            <ParticipantList participants={slot.participants} />
                        </Box>
                    ))}

                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                        {canConfirm ? bookingCopy.cancellationNote : bookingCopy.readOnly}
                    </Typography>
                </CardContent>
            </Card>

            {bookingError && <Box sx={{ mt: 2 }}><ErrorState message={bookingError} /></Box>}
            {canConfirm && (
                <Box sx={{ mt: 2 }}>
                    {isContinuousSelection(slots) ? (
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
