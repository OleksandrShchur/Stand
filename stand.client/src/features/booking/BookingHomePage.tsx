import { useEffect, useState } from 'react';
import { Box, Button, Card, CardContent, Container, IconButton, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import BrandHeader from '../../components/BrandHeader';
import { ErrorState, SkeletonList } from '../../components/StateMessage';
import { publicApi } from '../../api/publicApi';
import type { MyShiftDto } from '../../api/types';
import { formatDateFull } from '../../utils/date';
import { bookingCopy } from './bookingCopy';

export default function BookingHomePage({ onStart }: { onStart: () => void }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [shifts, setShifts] = useState<MyShiftDto[]>([]);

    const load = () => {
        setLoading(true);
        setError(null);
        publicApi.getMyUpcomingShifts()
            .then(setShifts)
            .catch(() => setError('Не вдалося завантажити ваші зміни.'))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const cancel = (shiftId: number) => {
        publicApi.cancelMyShift(shiftId).then(() => setShifts((items) => items.filter((item) => item.id !== shiftId)));
    };

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
            <BrandHeader />
            <Container maxWidth="sm" sx={{ py: 3 }}>
                <Stack spacing={2.5}>
                    <Typography variant="h5">{bookingCopy.myShifts}</Typography>
                    {loading && <SkeletonList rows={2} />}
                    {error && !loading && <ErrorState message={error} onRetry={load} />}
                    {!loading && !error && shifts.length === 0 && (
                        <Card variant="outlined">
                            <CardContent sx={{ py: 4, textAlign: 'center' }}>
                                <Typography color="text.secondary">{bookingCopy.noUpcomingShifts}</Typography>
                            </CardContent>
                        </Card>
                    )}
                    {!loading && !error && shifts.map((shift) => (
                        <Card key={shift.id} variant="outlined">
                            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography sx={{ fontWeight: 800 }}>{formatDateFull(shift.date)} · {shift.startTime}-{shift.endTime}</Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                                        {shift.locationName}{shift.locationAddress ? `, ${shift.locationAddress}` : ''}
                                    </Typography>
                                </Box>
                                <IconButton aria-label={bookingCopy.cancel} color="error" onClick={() => cancel(shift.id)} sx={{ minWidth: 44, minHeight: 44 }}>
                                    <CancelOutlinedIcon />
                                </IconButton>
                            </CardContent>
                        </Card>
                    ))}
                    <Button variant="contained" size="large" fullWidth startIcon={<AddIcon />} onClick={onStart}>
                        {bookingCopy.startBooking}
                    </Button>
                </Stack>
            </Container>
        </Box>
    );
}
