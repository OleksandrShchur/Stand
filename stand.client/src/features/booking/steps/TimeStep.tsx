import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { publicApi } from '../../../api/publicApi';
import { ApiError } from '../../../api/client';
import { ErrorState, EmptyState, SkeletonList } from '../../../components/StateMessage';
import type { SlotAvailabilityDto } from '../../../api/types';
import { formatDateFull, formatDateHuman, formatWeekdayShort } from '../../../utils/date';
import SlotCard from '../components/SlotCard';
import { bookingCopy, showParticipantNames } from '../bookingCopy';

export default function TimeStep({ date, locationId, locationName, selectedSlotId, conflictMessage, onSelect }: {
    date: string;
    locationId: number;
    locationName: string;
    selectedSlotId?: number;
    conflictMessage?: string | null;
    onSelect: (slot: SlotAvailabilityDto) => void;
}) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [slots, setSlots] = useState<SlotAvailabilityDto[]>([]);
    const [selected, setSelected] = useState<SlotAvailabilityDto | null>(null);

    const load = () => {
        setLoading(true);
        setError(null);
        publicApi.getSlots(date, locationId).then((nextSlots) => {
            setSlots(nextSlots);
            setSelected((current) => nextSlots.find((slot) => slot.timeSlotId === current?.timeSlotId || slot.timeSlotId === selectedSlotId) ?? null);
        })
            .catch((e) => setError(e instanceof ApiError ? e.message : 'Не вдалося завантажити час.'))
            .finally(() => setLoading(false));
    };

    useEffect(load, [date, locationId, selectedSlotId]);

    if (loading) return <SkeletonList rows={4} />;
    if (error) return <ErrorState message={error} onRetry={load} />;

    const choose = (slot: SlotAvailabilityDto) => {
        if (!slot.isBookable) return;
        setSelected(slot);
    };

    return (
        <Box sx={{ pb: selected ? 12 : 0 }}>
            <Typography variant="h5" sx={{ mb: 0.5 }}>{bookingCopy.selectTime}</Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 2.5, flexWrap: 'wrap' }}>
                <Chip label={formatDateFull(date)} size="small" color="primary" variant="outlined" />
                <Chip label={locationName} size="small" variant="outlined" />
            </Stack>
            {conflictMessage && (
                <Alert severity="warning" sx={{ mb: 2, borderRadius: 1 }}>
                    <Typography sx={{ fontWeight: 800 }}>{conflictMessage}</Typography>
                    <Typography variant="body2">{bookingCopy.conflictHint}</Typography>
                </Alert>
            )}
            {showParticipantNames && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    {bookingCopy.namesVisible}
                </Typography>
            )}
            {slots.length === 0 ? (
                <EmptyState message={bookingCopy.noSlotsForDate} />
            ) : (
                <Stack spacing={1.25}>
                    {slots.map((slot) => (
                        <SlotCard
                            key={slot.timeSlotId}
                            slot={slot}
                            selected={selected?.timeSlotId === slot.timeSlotId}
                            onSelect={choose}
                        />
                    ))}
                </Stack>
            )}
            {selected && (
                <Paper
                    elevation={6}
                    sx={{
                        position: 'fixed',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 10,
                        borderRadius: '8px 8px 0 0',
                        borderTop: '1px solid',
                        borderColor: 'divider',
                        p: 1.5,
                    }}
                >
                    <Stack direction="row" spacing={1.5} sx={{ maxWidth: 600, mx: 'auto', alignItems: 'center' }}>
                        <Typography sx={{ flex: 1, fontSize: 14, fontWeight: 700 }}>
                            {formatWeekdayShort(date)}, {formatDateHuman(date)} · {selected.startTime}-{selected.endTime} · {locationName}
                        </Typography>
                        <Button variant="contained" onClick={() => onSelect(selected)}>Далі</Button>
                    </Stack>
                </Paper>
            )}
        </Box>
    );
}
