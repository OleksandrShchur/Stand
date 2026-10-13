import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Card, CardContent, Container, Divider, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import BrandHeader from '../../components/BrandHeader';
import { ErrorState, SkeletonList } from '../../components/StateMessage';
import { publicApi } from '../../api/publicApi';
import type { MyShiftDto } from '../../api/types';
import { formatDateFull } from '../../utils/date';
import { bookingCopy } from './bookingCopy';
import { getClosestShifts } from './closestShifts';
import { pagePadding, sectionGap } from '../../layoutSpacing';

export default function BookingHomePage({ onStart }: { onStart: () => void }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [shifts, setShifts] = useState<MyShiftDto[]>([]);

    const load = () => {
        setLoading(true);
        setError(null);
        publicApi.getMyUpcomingShifts()
            .then(setShifts)
            .catch(() => setError(bookingCopy.shiftsLoadError))
            .finally(() => setLoading(false));
    };
    useEffect(load, []);

    const preview = getClosestShifts(shifts);

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
            <BrandHeader />
            <Container maxWidth="sm" sx={pagePadding}>
                <Stack spacing={sectionGap}>
                    <Card variant="outlined">
                        <CardContent>
                            <Typography variant="h5" sx={{ mb: 2 }}>{bookingCopy.myShifts}</Typography>
                            {loading && <SkeletonList rows={2} />}
                            {error && !loading && <ErrorState message={error} onRetry={load} />}
                            {!loading && !error && preview.length === 0 && (
                                <Typography color="text.secondary" sx={{ py: 2 }}>{bookingCopy.noUpcomingShifts}</Typography>
                            )}
                            {!loading && !error && (
                                <Stack spacing={2} divider={<Divider />}>
                                    {preview.map((shift) => {
                                        return (
                                            <Box key={shift.id}>
                                                <Typography sx={{ fontWeight: 800 }}>{formatDateFull(shift.date)}</Typography>
                                                <Typography sx={{ fontWeight: 700 }}>{shift.startTime}-{shift.endTime}</Typography>
                                                <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                                                    {shift.locationName}{shift.locationAddress ? `, ${shift.locationAddress}` : ''}
                                                </Typography>
                                            </Box>
                                        );
                                    })}
                                </Stack>
                            )}
                            <Divider sx={{ mt: 2, mb: 1 }} />
                            <Button fullWidth endIcon={<ArrowForwardIcon />} onClick={() => navigate('/my-shifts')}>
                                {bookingCopy.seeAllShifts}{!loading && !error ? ` (${shifts.length})` : ''}
                            </Button>
                        </CardContent>
                    </Card>
                    <Button variant="contained" size="large" fullWidth startIcon={<AddIcon />} onClick={onStart}>
                        {bookingCopy.startBooking}
                    </Button>
                </Stack>
            </Container>
        </Box>
    );
}
