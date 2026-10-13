import { useEffect, useState } from 'react';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { publicApi } from '../../../api/publicApi';
import { ApiError } from '../../../api/client';
import { LoadingState, ErrorState, EmptyState } from '../../../components/StateMessage';
import type { HoldResponseDto, SlotAvailabilityDto } from '../../../api/types';
import { formatDateFull } from '../../../utils/date';

export default function TimeStep({
    date,
    locationId,
    locationName,
    onHeld,
}: {
    date: string;
    locationId: number;
    locationName: string;
    onHeld: (hold: HoldResponseDto) => void;
}) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [slots, setSlots] = useState<SlotAvailabilityDto[]>([]);
    const [holding, setHolding] = useState<number | null>(null);
    const [holdError, setHoldError] = useState<string | null>(null);

    const load = () => {
        setLoading(true);
        setError(null);
        publicApi
            .getSlots(date, locationId)
            .then(setSlots)
            .catch((e) => setError(e instanceof ApiError ? e.message : 'Не вдалося завантажити час.'))
            .finally(() => setLoading(false));
    };

    useEffect(load, [date, locationId]);

    const handleSelect = (slot: SlotAvailabilityDto) => {
        if (slot.isFull || slot.isTooSoon || holding !== null) return;
        setHoldError(null);
        setHolding(slot.timeSlotId);
        publicApi
            .hold(date, locationId, slot.timeSlotId)
            .then((hold) => onHeld(hold))
            .catch((e) => {
                if (e instanceof ApiError && e.errorCode === 'SLOT_FULL') {
                    setHoldError('Нажаль, це місце щойно зайняли. Оберіть інший час.');
                    load();
                } else if (e instanceof ApiError && e.errorCode === 'SLOT_TOO_SOON') {
                    setHoldError(e.message);
                    load();
                } else {
                    setHoldError(e instanceof ApiError ? e.message : 'Не вдалося утримати місце. Спробуйте ще раз.');
                }
            })
            .finally(() => setHolding(null));
    };

    if (loading) return <LoadingState label="Завантажуємо доступний час…" />;
    if (error) return <ErrorState message={error} onRetry={load} />;

    return (
        <Box>
            <Typography variant="h5" sx={{ mb: 0.5 }}>Оберіть час</Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 2.5, flexWrap: 'wrap' }}>
                <Chip label={formatDateFull(date)} size="small" color="primary" variant="outlined" />
                <Chip label={locationName} size="small" variant="outlined" />
            </Stack>

            {holdError && <Box sx={{ mb: 2 }}><ErrorState message={holdError} /></Box>}

            {slots.length === 0 ? (
                <EmptyState message="Для цієї дати та локації немає доступного часу." />
            ) : (
                <Stack spacing={1.25}>
                    {slots.map((slot) => {
                        const unavailable = slot.isFull || slot.isTooSoon;
                        const disabled = unavailable || holding !== null;
                        const isThisHolding = holding === slot.timeSlotId;
                        const statusLabel = isThisHolding
                            ? 'Утримуємо…'
                            : slot.isTooSoon
                                ? 'Недоступно'
                                : slot.isFull
                                    ? 'Зайнято'
                                    : `Вільно ${slot.remaining}/${slot.capacity}`;
                        return (
                            <Button
                                key={slot.timeSlotId}
                                variant={unavailable ? 'outlined' : 'contained'}
                                color={unavailable ? 'inherit' : 'primary'}
                                disabled={disabled && !isThisHolding}
                                onClick={() => handleSelect(slot)}
                                size="large"
                                sx={{
                                    justifyContent: 'space-between',
                                    px: 2.5,
                                    opacity: unavailable ? 0.6 : 1,
                                    bgcolor: unavailable ? 'action.disabledBackground' : undefined,
                                }}
                                startIcon={<AccessTimeIcon />}
                            >
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                    <span>{slot.startTime}–{slot.endTime}</span>
                                    <Chip
                                        size="small"
                                        label={statusLabel}
                                        sx={{
                                            bgcolor: unavailable ? 'grey.300' : 'rgba(255,255,255,0.25)',
                                            color: unavailable ? 'text.secondary' : 'inherit',
                                            fontWeight: 700,
                                        }}
                                    />
                                </Box>
                            </Button>
                        );
                    })}
                </Stack>
            )}
        </Box>
    );
}
