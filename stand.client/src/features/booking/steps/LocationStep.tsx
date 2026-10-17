import { useAvailabilityRefresh } from '../../../hooks/useAvailabilityRefresh';
import { useState } from 'react';
import { Box, Button, Card, Chip, Container, FormControlLabel, Radio, RadioGroup, Stack, Typography } from '@mui/material';
import { publicApi } from '../../../api/publicApi';
import { ApiError } from '../../../api/client';
import { ErrorState, EmptyState, SkeletonList } from '../../../components/StateMessage';
import type { LocationDto } from '../../../api/types';
import { formatDateFull } from '../../../utils/date';
import { bookingCopy } from '../bookingCopy';
import { listGap, pagePadding } from '../../../layoutSpacing';
import StateBadge from '../components/StateBadge';
import { loadLocationsWithAvailability } from '../locationAvailability';
import { getKyivDateTime } from '../slotTimeStatus';

export default function LocationStep({ date, onSelect, onBack, selectedLocationId }: {
    date: string;
    onSelect: (location: LocationDto) => void;
    onBack: () => void;
    selectedLocationId?: number;
}) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [locations, setLocations] = useState<LocationDto[]>([]);
    const [selectedId, setSelectedId] = useState<number | undefined>(selectedLocationId);
    const selectedLocation = locations.find((location) => location.id === selectedId);
    const showAvailabilityChips = date >= getKyivDateTime(new Date()).date;

    const load = useAvailabilityRefresh(async (signal, initial) => {
        if (initial) { setLoading(true); setError(null); }
        try {
            const updated = await loadLocationsWithAvailability(date, publicApi, new Date(), signal);
            if (!signal.aborted) setLocations(updated);
        } catch (e) {
            if (!signal.aborted && initial) setError(e instanceof ApiError ? e.message : 'Не вдалося завантажити локації.');
        } finally {
            if (!signal.aborted) setLoading(false);
        }
    }, date);

    if (loading) return <SkeletonList label="Перевіряємо доступність локацій…" rows={4} />;
    if (error) return <ErrorState message={error} onRetry={load} />;

    return (
        <Box sx={{ pb: 'calc(104px + env(safe-area-inset-bottom, 0px))' }}>
            <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
                    <Typography id="location-heading" variant="h5">{bookingCopy.selectLocation}</Typography>
                    {!showAvailabilityChips && <Chip label={bookingCopy.archive} size="small" variant="outlined" />}
                </Stack>
                <Chip label={formatDateFull(date)} size="small" color="primary" variant="outlined" />
            </Stack>

            {locations.length === 0 ? (
                <EmptyState message="Локації тимчасово недоступні." />
            ) : (
                <RadioGroup aria-labelledby="location-heading" value={selectedId ?? ''} onChange={(event) => setSelectedId(Number(event.target.value))} sx={{ gap: listGap }}>
                    {locations.map((location) => {
                        return (
                            <Card key={location.id} variant="outlined" sx={{
                                borderColor: selectedId === location.id ? 'primary.main' : 'divider',
                                bgcolor: 'background.paper',
                            }}>
                                <FormControlLabel
                                    value={location.id}
                                    control={<Radio />}
                                    labelPlacement="start"
                                    sx={{ m: 0, width: '100%', minHeight: 52, px: { xs: 1.5, sm: 2 }, py: 0.5, '& .MuiFormControlLabel-label': { flex: 1, minWidth: 0 } }}
                                    label={
                                        <Box sx={{ minWidth: 0, py: showAvailabilityChips && location.hasAvailableBookings === false ? 0.5 : 0 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
                                                <Typography variant="body1" sx={{ fontWeight: 800, fontSize: { xs: 14, sm: 16 } }}>{location.name}</Typography>
                                                {location.address && (
                                                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: 12, sm: 14 } }}>{location.address}</Typography>
                                                )}
                                            </Box>
                                            {showAvailabilityChips && location.hasAvailableBookings === false && (
                                                <Box sx={{ mt: 0.75 }}>
                                                    <StateBadge label="Немає доступних записів" tone="warning" />
                                                </Box>
                                            )}
                                        </Box>
                                    }
                                />
                            </Card>
                        );
                    })}
                </RadioGroup>
            )}
            <Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: (theme) => theme.zIndex.appBar, bgcolor: 'background.default', borderTop: '1px solid', borderColor: 'divider', boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.06)', pb: 'env(safe-area-inset-bottom, 0px)' }}>
                <Container maxWidth="sm" sx={{ ...pagePadding, py: 2 }}>
                    <Stack direction="row" spacing={1}>
                        <Button variant="outlined" size="large" onClick={onBack} sx={{ minHeight: 56, flex: '1 1 0', minWidth: 0 }}>
                            {bookingCopy.back}
                        </Button>
                        <Button variant="contained" size="large" disabled={!selectedLocation} onClick={() => { if (selectedLocation) onSelect(selectedLocation); }} sx={{ minHeight: 56, flex: '1 1 0', minWidth: 0 }}>
                            {bookingCopy.next}
                        </Button>
                    </Stack>
                </Container>
            </Box>
        </Box>
    );
}
