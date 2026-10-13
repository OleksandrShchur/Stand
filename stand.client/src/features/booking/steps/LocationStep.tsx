import { useEffect, useMemo, useState } from 'react';
import { Box, Card, CardActionArea, CardContent, Chip, Stack, Typography } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { publicApi } from '../../../api/publicApi';
import { ApiError } from '../../../api/client';
import { ErrorState, EmptyState, SkeletonList } from '../../../components/StateMessage';
import type { LocationDto } from '../../../api/types';
import { formatDateFull, todayIso } from '../../../utils/date';
import { mockLocationAvailability } from '../mockBookingData';
import StateBadge from '../components/StateBadge';
import { bookingCopy } from '../bookingCopy';

export default function LocationStep({ date, onSelect }: { date: string; onSelect: (location: LocationDto) => void }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [locations, setLocations] = useState<LocationDto[]>([]);

    const load = () => {
        setLoading(true);
        setError(null);
        publicApi
            .getLocations(date)
            .then(setLocations)
            .catch((e) => setError(e instanceof ApiError ? e.message : 'Не вдалося завантажити локації.'))
            .finally(() => setLoading(false));
    };

    useEffect(load, [date]);

    const enriched = useMemo(() => locations
        .map((location) => ({
            location,
            availability: mockLocationAvailability.find((item) => item.locationId === location.id) ?? {
                locationId: location.id,
                remaining: Math.max(location.capacity, 1),
                capacity: location.capacity,
            },
        }))
        .sort((a, b) => Number(b.availability.isLastUsed) - Number(a.availability.isLastUsed) || b.availability.remaining - a.availability.remaining),
    [locations]);

    if (loading) return <SkeletonList rows={4} />;
    if (error) return <ErrorState message={error} onRetry={load} />;

    return (
        <Box>
            <Typography variant="h5" sx={{ mb: 0.5 }}>{bookingCopy.selectLocation}</Typography>
            <Chip label={formatDateFull(date)} size="small" color="primary" variant="outlined" sx={{ mb: { xs: 1.5, sm: 2.5 } }} />

            {enriched.length === 0 ? (
                <EmptyState message="Локації тимчасово недоступні." />
            ) : (
                <Stack spacing={{ xs: 0.75, sm: 1.25 }}>
                    {enriched.map(({ location, availability }) => {
                        const isFull = availability.remaining <= 0;
                        return (
                            <Card key={location.id} variant="outlined" sx={{
                                borderColor: isFull ? 'var(--state-full-border)' : 'divider',
                                bgcolor: isFull ? 'var(--state-full-bg)' : 'background.paper',
                            }}>
                                <CardActionArea
                                    onClick={() => onSelect(location)}
                                    sx={{ p: { xs: 0, sm: 0.5 }, minHeight: 72 }}
                                >
                                    <CardContent sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: { xs: 1, sm: 1.5 },
                                        px: { xs: 1.5, sm: 2 },
                                        py: { xs: 1.25, sm: 2 },
                                        '&:last-child': { pb: { xs: 1.25, sm: 2 } },
                                    }}>
                                        <Box sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
                                            <Typography variant="body1" sx={{ fontWeight: 800, fontSize: { xs: 14, sm: 16 } }}>{location.name}</Typography>
                                            {location.address && (
                                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: 12, sm: 14 } }}>{location.address}</Typography>
                                            )}
                                            {availability.isLastUsed && (
                                                <Typography variant="caption" sx={{ color: 'primary.dark', fontWeight: 700 }}>Ви були тут</Typography>
                                            )}
                                        </Box>
                                        <StateBadge
                                            label={date < todayIso() ? bookingCopy.readOnly : isFull ? bookingCopy.seatsGone : `${availability.remaining} вільних місць`}
                                            tone={date < todayIso() ? 'unavailable' : isFull ? 'full' : 'available'}
                                        />
                                        <ChevronRightIcon color="action" sx={{ fontSize: { xs: 20, sm: 24 }, flexShrink: 0 }} />
                                    </CardContent>
                                </CardActionArea>
                            </Card>
                        );
                    })}
                </Stack>
            )}
        </Box>
    );
}
