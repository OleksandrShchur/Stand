import { useEffect, useState } from 'react';
import { Alert, Box, Chip, Stack, Typography } from '@mui/material';
import { publicApi } from '../../../api/publicApi';
import { ApiError } from '../../../api/client';
import { ErrorState, EmptyState, SkeletonList } from '../../../components/StateMessage';
import type { SlotAvailabilityDto } from '../../../api/types';
import { formatDateFull, todayIso } from '../../../utils/date';
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
    const readOnly = date < todayIso();

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
        <Box>
            <Typography variant="h5" sx={{ mb: 0.5 }}>{bookingCopy.selectTime}</Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 2.5, flexWrap: 'wrap' }}>
                <Chip label={formatDateFull(date)} size="small" color="primary" variant="outlined" />
                <Chip label={locationName} size="small" variant="outlined" />
                {readOnly && <Chip label={bookingCopy.readOnly} size="small" variant="outlined" />}
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
                            selected={selectedSlotId === slot.timeSlotId}
                            readOnly={readOnly}
                            onSelect={onSelect}
                        />
                    ))}
                </Stack>
            )}
        </Box>
    );
}
