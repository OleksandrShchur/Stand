import { useEffect, useState } from 'react';
import { Box, Card, CardActionArea, CardContent, Chip, Stack, Typography } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { publicApi } from '../../../api/publicApi';
import { ApiError } from '../../../api/client';
import { ErrorState, EmptyState, SkeletonList } from '../../../components/StateMessage';
import type { LocationDto } from '../../../api/types';
import { formatDateFull } from '../../../utils/date';
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

    if (loading) return <SkeletonList rows={4} />;
    if (error) return <ErrorState message={error} onRetry={load} />;

    return (
        <Box>
            <Typography variant="h5" sx={{ mb: 0.5 }}>{bookingCopy.selectLocation}</Typography>
            <Chip label={formatDateFull(date)} size="small" color="primary" variant="outlined" sx={{ mb: { xs: 1.5, sm: 2.5 } }} />

            {locations.length === 0 ? (
                <EmptyState message="Локації тимчасово недоступні." />
            ) : (
                <Stack spacing={{ xs: 0.75, sm: 1.25 }}>
                    {locations.map((location) => {
                        return (
                            <Card key={location.id} variant="outlined" sx={{
                                borderColor: 'divider',
                                bgcolor: 'background.paper',
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
                                        </Box>
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
