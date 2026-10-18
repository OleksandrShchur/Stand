import ShiftDetailsTable from './components/ShiftDetailsTable';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Card, CardContent, Container, Divider, Stack, Typography } from '@mui/material';
import BrandHeader from '../../components/BrandHeader';
import MainContent from '../../components/MainContent';
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
            <Container component={MainContent} className="content-enter" maxWidth="sm" sx={{ ...pagePadding, pb: 'calc(104px + env(safe-area-inset-bottom, 0px))' }}>
                <Stack spacing={sectionGap}>
                    <Card variant="outlined">
                        <CardContent>
                            <Typography component="h1" variant="h5" sx={{ mb: 2 }}>{bookingCopy.myShifts}</Typography>
                            {loading && <SkeletonList label="Шукаємо найближчі чергування…" rows={2} />}
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
                </Stack>
            </Container>
            <Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: (theme) => theme.zIndex.appBar, bgcolor: 'background.default', borderTop: '1px solid', borderColor: 'divider', boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.06)', pb: 'env(safe-area-inset-bottom, 0px)' }}>
                <Container maxWidth="sm" sx={{ ...pagePadding, py: 2 }}>
                    <Button variant="contained" size="large" fullWidth onClick={onStart} sx={{ minHeight: 56 }}>
                        {bookingCopy.startBooking}
                    </Button>
                </Container>
            </Box>
        </Box>
    );
}
