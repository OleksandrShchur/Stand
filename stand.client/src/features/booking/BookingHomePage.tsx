import ParticipantList from './components/ParticipantList';
import ShiftDetailsTable from './components/ShiftDetailsTable';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Card, CardContent, Container, Divider, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import BrandHeader from '../../components/BrandHeader';
import { ErrorState, SkeletonList } from '../../components/StateMessage';
import { publicApi } from '../../api/publicApi';
import type { MyShiftDto } from '../../api/types';
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
                                <Stack spacing={2}>
                                    {preview.map((shift) => {
                                        return (
                                            <Box key={shift.id} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.default' }}>
                                                <ShiftDetailsTable shift={shift} />
                                                <Divider sx={{ mt: 1.5 }} />
                                                <ParticipantList participants={shift.participants} dashed />
                                            </Box>
                                        );
                                    })}
                                </Stack>
                            )}
                            <Divider sx={{ mt: 2, mb: 1 }} />
                            <Button variant="outlined" fullWidth onClick={() => navigate('/my-shifts')}>
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
