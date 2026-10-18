import ParticipantList from '../components/ParticipantList';
import { useEffect, useState } from 'react';
import { Box, Button, Card, CardContent, Container, Divider, Stack, Typography } from '@mui/material';
import { publicApi } from '../../../api/publicApi';
import { ApiError } from '../../../api/client';
import { ErrorState, SkeletonList } from '../../../components/StateMessage';
import type { BookingSummaryDto, SlotAvailabilityDto } from '../../../api/types';
import { formatDateFull, todayIso } from '../../../utils/date';
import { bookingCopy } from '../bookingCopy';
import { isContinuousSelection, sortSlots } from '../slotSelection';
import { pagePadding } from '../../../layoutSpacing';
import { bookingRequestKey, clearBookingRequest } from '../bookingRequest';

export default function ShiftDetailsStep({ date, locationId, locationName, locationAddress, timeSlotId, timeSlotIds, onConfirmed, onUnavailable, onBack }: {
    date: string;
    locationId: number;
    locationName: string;
    locationAddress?: string | null;
    timeSlotId: number;
    timeSlotIds?: number[];
    onConfirmed?: (summaries: BookingSummaryDto[]) => void;
    onUnavailable?: (message?: string) => void;
    onBack: () => void;
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
            if (found.length !== ids.length) throw new Error('Один з обраних записів не знайдено. Оберіть час ще раз.');
            setSlots(sortSlots(found));
        }).catch((e) => setError(e instanceof ApiError || e instanceof Error ? e.message : 'Не вдалося завантажити запис.'))
            .finally(() => setLoading(false));
    };
    useEffect(load, [date, locationId, timeSlotId, timeSlotIds]);

    const confirm = () => {
        if (!isContinuousSelection(slots) || !onConfirmed || !canConfirm || submitting) return;
        setSubmitting(true);
        setBookingError(null);
        const ids = slots.map((slot) => slot.timeSlotId);
        publicApi.bookMany(date, locationId, ids, bookingRequestKey(date, locationId, ids)).then((summaries) => {
            clearBookingRequest();
            onConfirmed(summaries);
        })
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

    if (loading) return <SkeletonList label="Завантажуємо деталі чергування…" rows={3} />;
    if (error) return <ErrorState message={error} onRetry={load} />;
    if (!slots.length) return null;

    return (
        <Box sx={{ pb: canConfirm ? 'calc(104px + env(safe-area-inset-bottom, 0px))' : 0 }}>
            <Typography component="h1" variant="h5" sx={{ mb: 2 }}>{canConfirm ? bookingCopy.confirmHeading : bookingCopy.shiftDetails}</Typography>
            <Card variant="outlined" sx={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                    <Stack spacing={2}>
                        <Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Дата</Typography>
                            <Typography sx={{ fontSize: 18, fontWeight: 600, lineHeight: 1.5 }}>
                                {formatDateFull(date)}
                            </Typography>
                        </Box>
                        <Box sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Час чергування</Typography>
                            <Typography sx={{ fontSize: 24, fontWeight: 700, lineHeight: 1.3, color: 'primary.dark', fontVariantNumeric: 'tabular-nums' }}>
                                {slots[0].startTime}–{slots[slots.length - 1].endTime}
                            </Typography>
                        </Box>
                        <Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Локація</Typography>
                            <Typography sx={{ fontSize: 16, fontWeight: 700, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{locationName}</Typography>
                            {locationAddress && <Typography sx={{ fontSize: 14, color: 'text.secondary', lineHeight: 1.6 }}>{locationAddress}</Typography>}
                        </Box>
                        <Divider />
                        {slots.map((slot) => (
                            <Box key={slot.timeSlotId} sx={{ '& > div': { mt: 0 }, '& .MuiTypography-body2': { fontSize: 14, lineHeight: 1.6 }, '& ul': { mt: 0.5 }, '& li': { color: 'text.primary' } }}>
                                {slots.length > 1 && <Typography sx={{ mb: 0.5, fontWeight: 700, color: 'primary.dark' }}>{slot.startTime}–{slot.endTime}</Typography>}
                                <ParticipantList participants={slot.participants} />
                            </Box>
                        ))}
                        <Box sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
                            <Typography sx={{ fontSize: 13, lineHeight: 1.6, color: 'text.secondary' }}>
                                {canConfirm ? bookingCopy.cancellationNote : bookingCopy.readOnly}
                            </Typography>
                        </Box>
                    </Stack>
                </CardContent>
            </Card>

            {bookingError && <Box sx={{ mt: 2 }}><ErrorState message={bookingError} /></Box>}
            {canConfirm && !isContinuousSelection(slots) && (
                <Stack spacing={1.5} sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">Запис на цей час недоступний.</Typography>
                    {onUnavailable && <Button variant="outlined" fullWidth onClick={() => onUnavailable(bookingCopy.conflict)}>Обрати час ще раз</Button>}
                </Stack>
            )}
            {canConfirm && (
                <Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: (theme) => theme.zIndex.appBar, bgcolor: 'background.default', borderTop: '1px solid', borderColor: 'divider', boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.06)', pb: 'env(safe-area-inset-bottom, 0px)' }}>
                    <Container maxWidth="sm" sx={{ ...pagePadding, py: 2 }}>
                        <Stack direction="row" spacing={1}>
                            <Button variant="outlined" size="large" disabled={submitting} onClick={onBack} sx={{ minHeight: 56, flexShrink: 0 }}>
                                {bookingCopy.back}
                            </Button>
                            <Button loading={submitting} variant="contained" size="large" disabled={submitting || !isContinuousSelection(slots)} onClick={confirm} sx={{ minHeight: 56, flex: 1, minWidth: 0, px: 1 }}>
                                {submitting ? bookingCopy.confirming : bookingCopy.confirmAction}
                            </Button>
                        </Stack>
                    </Container>
                </Box>
            )}
        </Box>
    );
}
