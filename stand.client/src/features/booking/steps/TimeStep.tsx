import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, Container, Snackbar, Stack, Typography } from '@mui/material';
import { publicApi } from '../../../api/publicApi';
import { ApiError } from '../../../api/client';
import { ErrorState, EmptyState, SkeletonList } from '../../../components/StateMessage';
import type { SlotAvailabilityDto } from '../../../api/types';
import { formatDateFull } from '../../../utils/date';
import SlotCard from '../components/SlotCard';
import { bookingCopy } from '../bookingCopy';
import { listGap, pagePadding } from '../../../layoutSpacing';
import { getSlotDisabledReason, isContinuousSelection, sortSlots, toggleSlot } from '../slotSelection';
import { getKyivDateTime, getSlotTimeStatus } from '../slotTimeStatus';

export default function TimeStep({ date, locationId, locationName, selectedSlotIds, conflictMessage, onSelect, onBack }: {
    date: string;
    locationId: number;
    locationName: string;
    selectedSlotIds?: number[];
    conflictMessage?: string | null;
    onSelect: (slots: SlotAvailabilityDto[]) => void;
    onBack: () => void;
}) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [slots, setSlots] = useState<SlotAvailabilityDto[]>([]);
    const [selectedIds, setSelectedIds] = useState<number[]>(selectedSlotIds ?? []);
    const [hint, setHint] = useState<{ message: string; key: number; severity: 'info' | 'warning' } | null>(() =>
        conflictMessage ? { message: `${conflictMessage}. ${bookingCopy.conflictHint}`, key: 0, severity: 'warning' } : null);
    const [now, setNow] = useState(() => new Date());
    const readOnly = date < getKyivDateTime(now).date;
    const selectedSlots = sortSlots(slots.filter((slot) => selectedIds.includes(slot.timeSlotId)));
    const canContinue = selectedSlots.length === selectedIds.length && isContinuousSelection(selectedSlots) &&
        selectedSlots.every((slot) => getSlotTimeStatus(date, slot, now) === 'upcoming');

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(timer);
    }, []);

    const load = () => {
        setLoading(true);
        setError(null);
        publicApi.getSlots(date, locationId).then(setSlots)
            .catch((e) => setError(e instanceof ApiError ? e.message : 'Не вдалося завантажити час.'))
            .finally(() => setLoading(false));
    };

    useEffect(load, [date, locationId]);

    if (loading) return <SkeletonList label="Завантажуємо час чергувань…" rows={4} />;
    if (error) return <ErrorState message={error} onRetry={load} />;

    return (
        <Box sx={{ pb: 'calc(104px + env(safe-area-inset-bottom, 0px))' }}>
            <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
                    <Typography component="h1" id="time-heading" variant="h5">{bookingCopy.selectTime}</Typography>
                    {readOnly && <Chip label={bookingCopy.archive} size="small" variant="outlined" />}
                </Stack>
                <Stack spacing={0.5} sx={{ alignItems: 'flex-end' }}>
                    <Chip label={formatDateFull(date)} size="small" color="primary" variant="outlined" />
                    <Chip label={locationName} size="small" variant="outlined" />
                </Stack>
            </Stack>
            {slots.length === 0 ? (
                <EmptyState message={bookingCopy.noSlotsForDate} />
            ) : (
                <Stack role="group" aria-labelledby="time-heading" spacing={listGap}>
                    {slots.map((slot) => {
                        const timeStatus = getSlotTimeStatus(date, slot, now);
                        const disabledReason = getSlotDisabledReason(slot, selectedSlots, readOnly, timeStatus);
                        return (
                            <SlotCard
                                key={slot.timeSlotId}
                                slot={slot}
                                timeStatus={timeStatus}
                                selected={selectedIds.includes(slot.timeSlotId)}
                                disabled={Boolean(disabledReason)}
                                onDisabledClick={() => {
                                    if (disabledReason) setHint({ message: disabledReason, key: Date.now(), severity: 'info' });
                                }}
                                readOnly={readOnly}
                                onSelect={(slot) => {
                                    setHint(null);
                                    setSelectedIds(toggleSlot(slot, selectedSlots).map((item) => item.timeSlotId));
                                }}
                            />
                        );
                    })}
                </Stack>
            )}
            <Snackbar
                key={hint?.key}
                open={Boolean(hint)}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                onClose={(_, reason) => { if (reason !== 'clickaway') setHint(null); }}
                sx={{ top: 'max(16px, env(safe-area-inset-top, 0px)) !important' }}
            >
                <Alert severity={hint?.severity ?? 'info'} variant="filled" onClose={() => setHint(null)} sx={{ width: '100%', maxWidth: 568, boxShadow: 3 }}>
                    {hint?.message}
                </Alert>
            </Snackbar>
            <Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: (theme) => theme.zIndex.appBar, bgcolor: 'background.default', borderTop: '1px solid', borderColor: 'divider', boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.06)', pb: 'env(safe-area-inset-bottom, 0px)' }}>
                <Container maxWidth="sm" sx={{ ...pagePadding, py: 2 }}>
                    <Stack direction="row" spacing={1}>
                        <Button variant="outlined" size="large" onClick={onBack} sx={{ minHeight: 56, flex: '1 1 0', minWidth: 0 }}>
                            {bookingCopy.back}
                        </Button>
                        <Button variant="contained" size="large" disabled={!canContinue} onClick={() => { if (canContinue) onSelect(selectedSlots); }} sx={{ minHeight: 56, flex: '1 1 0', minWidth: 0 }}>
                            {bookingCopy.next}
                        </Button>
                    </Stack>
                </Container>
            </Box>
        </Box>
    );
}
