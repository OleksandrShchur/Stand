import { useEffect, useState } from 'react';
import { Box, Card, CardActionArea, CardContent, Chip, Stack, Typography } from '@mui/material';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { publicApi } from '../../../api/publicApi';
import { ApiError } from '../../../api/client';
import { LoadingState, ErrorState, EmptyState } from '../../../components/StateMessage';
import type { LocationDto } from '../../../api/types';
import { formatDateFull } from '../../../utils/date';

export default function LocationStep({
    date,
    onSelect,
}: {
    date: string;
    onSelect: (location: LocationDto) => void;
}) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [locations, setLocations] = useState<LocationDto[]>([]);

    const load = () => {
        setLoading(true);
        setError(null);
        publicApi
            .getLocations()
            .then(setLocations)
            .catch((e) => setError(e instanceof ApiError ? e.message : 'Не вдалося завантажити локації.'))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    if (loading) return <LoadingState label="Завантажуємо локації…" />;
    if (error) return <ErrorState message={error} onRetry={load} />;

    return (
        <Box>
            <Typography variant="h5" sx={{ mb: 0.5 }}>Оберіть локацію</Typography>
            <Chip label={formatDateFull(date)} size="small" color="primary" variant="outlined" sx={{ mb: 2.5 }} />

            {locations.length === 0 ? (
                <EmptyState message="Локації тимчасово недоступні." />
            ) : (
                <Stack spacing={1.25}>
                    {locations.map((loc) => (
                        <Card key={loc.id} variant="outlined" sx={{ borderColor: 'divider' }}>
                            <CardActionArea onClick={() => onSelect(loc)} sx={{ p: 0.5 }}>
                                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    <PlaceOutlinedIcon color="primary" />
                                    <Box sx={{ flex: 1 }}>
                                        <Typography variant="body1" sx={{ fontWeight: 700 }}>{loc.name}</Typography>
                                        {loc.address && (
                                            <Typography variant="body2" color="text.secondary">{loc.address}</Typography>
                                        )}
                                    </Box>
                                    <ChevronRightIcon color="action" />
                                </CardContent>
                            </CardActionArea>
                        </Card>
                    ))}
                </Stack>
            )}
        </Box>
    );
}
