import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, Container, RadioGroup, Stack, Typography } from '@mui/material';
import { publicApi } from '../../../api/publicApi';
import { ApiError } from '../../../api/client';
import { ErrorState, EmptyState, SkeletonList } from '../../../components/StateMessage';
import type { SlotAvailabilityDto } from '../../../api/types';
import { formatDateFull, todayIso } from '../../../utils/date';
import SlotCard from '../components/SlotCard';
import { bookingCopy } from '../bookingCopy';
import { listGap, pagePadding } from '../../../layoutSpacing';

export default function TimeStep({ date, locationId, locationName, selectedSlotId, conflictMessage, onSelect, onBack }: {
    date: string;
    locationId: number;
    locationName: string;
    selectedSlotId?: number;
    conflictMessage?: string | null;
    onSelect: (slot: SlotAvailabilityDto) => void;
    onBack: () => void;
}) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [slots, setSlots] = useState<SlotAvailabilityDto[]>([]);
    const [selectedId, setSelectedId] = useState(selectedSlotId);
    const readOnly = date < todayIso();
    const selectedSlot = slots.find((slot) => slot.timeSlotId === selectedId);
    const canContinue = Boolean(selectedSlot && (readOnly || selectedSlot.isBookable ||
        (selectedSlot.remaining <= 0 && !selectedSlot.isBlocked && !selectedSlot.isTooSoon)));

    const load = () => {
        setLoading(true);
        setError(null);
        publicApi.getSlots(date, locationId).then(setSlots)
            .catch((e) => setError(e instanceof ApiError ? e.message : 'Не вдалося завантажити час.'))
            .finally(() => setLoading(false));
    };

    useEffect(load, [date, locationId]);

    if (loading) return <SkeletonList rows={4} />;
    if (error) return <ErrorState message={error} onRetry={load} />;

    return (
        <Box sx={{ pb: 'calc(104px + env(safe-area-inset-bottom, 0px))' }}>
            <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Typography id="time-heading" variant="h5">{bookingCopy.selectTime}</Typography>
                <Stack spacing={0.5} sx={{ alignItems: 'flex-end' }}>
                    <Chip label={formatDateFull(date)} size="small" color="primary" variant="outlined" />
                    <Chip label={locationName} size="small" variant="outlined" />
                    {readOnly && <Chip label={bookingCopy.readOnly} size="small" variant="outlined" />}
                </Stack>
            </Stack>
            {conflictMessage && (
                <Alert severity="warning" sx={{ mb: 2, borderRadius: 1 }}>
                    <Typography sx={{ fontWeight: 800 }}>{conflictMessage}</Typography>
                    <Typography variant="body2">{bookingCopy.conflictHint}</Typography>
                </Alert>
            )}
            {slots.length === 0 ? (
                <EmptyState message={bookingCopy.noSlotsForDate} />
            ) : (
                <RadioGroup aria-labelledby="time-heading" value={selectedId ?? ''} sx={{ gap: listGap }}>
                    {slots.map((slot) => (
                        <SlotCard
                            key={slot.timeSlotId}
                            slot={slot}
                            selected={selectedId === slot.timeSlotId}
                            readOnly={readOnly}
                            onSelect={(slot) => setSelectedId(slot.timeSlotId)}
                        />
                    ))}
                </RadioGroup>
            )}
            <Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: (theme) => theme.zIndex.appBar, bgcolor: 'background.default', borderTop: '1px solid', borderColor: 'divider', boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.06)', pb: 'env(safe-area-inset-bottom, 0px)' }}>
                <Container maxWidth="sm" sx={{ ...pagePadding, py: 2 }}>
                    <Stack direction="row" spacing={1}>
                        <Button variant="outlined" size="large" onClick={onBack} sx={{ minHeight: 56, flex: '1 1 0', minWidth: 0 }}>
                            {bookingCopy.back}
                        </Button>
                        <Button variant="contained" size="large" disabled={!canContinue} onClick={() => { if (canContinue && selectedSlot) onSelect(selectedSlot); }} sx={{ minHeight: 56, flex: '1 1 0', minWidth: 0 }}>
                            {bookingCopy.next}
                        </Button>
                    </Stack>
                </Container>
            </Box>
        </Box>
    );
}
