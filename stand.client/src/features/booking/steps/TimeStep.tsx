import { useEffect, useState } from 'react';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { publicApi } from '../../../api/publicApi';
import { ApiError } from '../../../api/client';
import { LoadingState, ErrorState, EmptyState } from '../../../components/StateMessage';
import type { SlotAvailabilityDto } from '../../../api/types';
import { formatDateFull } from '../../../utils/date';

export default function TimeStep({ date, locationId, locationName, onSelect }: {
    date: string;
    locationId: number;
    locationName: string;
    onSelect: (slot: SlotAvailabilityDto) => void;
}) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [slots, setSlots] = useState<SlotAvailabilityDto[]>([]);

    const load = () => {
        setLoading(true);
        setError(null);
        publicApi.getSlots(date, locationId).then(setSlots)
            .catch((e) => setError(e instanceof ApiError ? e.message : 'Не вдалося завантажити час.'))
            .finally(() => setLoading(false));
    };

    useEffect(load, [date, locationId]);

    if (loading) return <LoadingState label="Завантажуємо доступний час…" />;
    if (error) return <ErrorState message={error} onRetry={load} />;

    return (
        <Box>
            <Typography variant="h5" sx={{ mb: 0.5 }}>Оберіть час</Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 2.5, flexWrap: 'wrap' }}>
                <Chip label={formatDateFull(date)} size="small" color="primary" variant="outlined" />
                <Chip label={locationName} size="small" variant="outlined" />
            </Stack>
            {slots.length === 0 ? (
                <EmptyState message="Для цієї дати та локації немає доступного часу." />
            ) : (
                <Stack spacing={1.25}>
                    {slots.map((slot) => {
                        const unavailable = !slot.isBookable;
                        const statusLabel = slot.isBookable ? `Вільно ${slot.remaining}/${slot.capacity}`
                            : slot.remaining === 0 && !slot.isBlocked ? 'Зайнято' : 'Недоступно';
                        return (
                            <Box key={slot.timeSlotId}>
                                <Button fullWidth variant={unavailable ? 'outlined' : 'contained'}
                                    color={unavailable ? 'inherit' : 'primary'} onClick={() => onSelect(slot)} size="large"
                                    sx={{ justifyContent: 'space-between', px: 2.5, bgcolor: unavailable ? 'action.disabledBackground' : undefined }}
                                    startIcon={<AccessTimeIcon />}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                        <span>{slot.startTime}–{slot.endTime}</span>
                                        <Chip size="small" label={statusLabel} sx={{
                                            bgcolor: unavailable ? 'grey.300' : 'rgba(255,255,255,0.25)',
                                            color: unavailable ? 'text.secondary' : 'inherit', fontWeight: 700,
                                        }} />
                                    </Box>
                                </Button>
                                <Box sx={{ px: 1, pt: 1, pb: 0.5 }}>
                                    {slot.participants.length === 0 ? (
                                        <Typography variant="body2" color="text.secondary">Немає записаних учасників.</Typography>
                                    ) : (
                                        <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                                            {slot.participants.map((participant, index) => (
                                                <Typography component="li" variant="body2" key={index} sx={{ overflowWrap: 'anywhere' }}>
                                                    {[participant.firstName, participant.lastName].filter(Boolean).join(' ') || 'Учасник'}
                                                </Typography>
                                            ))}
                                        </Box>
                                    )}
                                </Box>
                            </Box>
                        );
                    })}
                </Stack>
            )}
        </Box>
    );
}
