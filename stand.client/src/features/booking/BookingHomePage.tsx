import { useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Container, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Stack, Tooltip, Typography } from '@mui/material';
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
    const [shiftToCancel, setShiftToCancel] = useState<MyShiftDto | null>(null);
    const [cancelling, setCancelling] = useState(false);
    const [cancelError, setCancelError] = useState<string | null>(null);

    const load = () => {
        setLoading(true);
        setError(null);
        publicApi.getMyUpcomingShifts()
            .then(setShifts)
            .catch(() => setError(bookingCopy.shiftsLoadError))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const cancel = () => {
        if (!shiftToCancel || cancelling) return;
        setCancelling(true);
        setCancelError(null);
        publicApi.cancelMyShift(shiftToCancel.cancelToken)
            .then(() => {
                setShifts((items) => items.filter((item) => item.id !== shiftToCancel.id));
                setShiftToCancel(null);
            })
            .catch(() => setCancelError(bookingCopy.shiftCancelError))
            .finally(() => setCancelling(false));
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
                                    <Typography sx={{ fontWeight: 800 }}>{formatDateFull(shift.date)}</Typography>
                                    <Typography sx={{ fontWeight: 700 }}>{shift.startTime}-{shift.endTime}</Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                                        {shift.locationName}{shift.locationAddress ? `, ${shift.locationAddress}` : ''}
                                    </Typography>
                                </Box>
                                <Tooltip title={bookingCopy.cancel}>
                                    <IconButton aria-label={bookingCopy.cancel} color="error" onClick={() => {
                                        setCancelError(null);
                                        setShiftToCancel(shift);
                                    }} sx={{ minWidth: 44, minHeight: 44 }}>
                                        <CancelOutlinedIcon />
                                    </IconButton>
                                </Tooltip>
                            </CardContent>
                        </Card>
                    ))}
                    <Button variant="contained" size="large" fullWidth startIcon={<AddIcon />} onClick={onStart}>
                        {bookingCopy.startBooking}
                    </Button>
                </Stack>
            </Container>
            <Dialog open={Boolean(shiftToCancel)} onClose={() => { if (!cancelling) setShiftToCancel(null); }}>
                <DialogTitle>{bookingCopy.cancelHeading}</DialogTitle>
                <DialogContent>
                    <DialogContentText>{bookingCopy.cancelPrompt}</DialogContentText>
                    {shiftToCancel && (
                        <Typography sx={{ mt: 1 }}>
                            {formatDateFull(shiftToCancel.date)} · {shiftToCancel.startTime}-{shiftToCancel.endTime} · {shiftToCancel.locationName}
                        </Typography>
                    )}
                    {cancelError && <Alert severity="error" sx={{ mt: 2 }}>{cancelError}</Alert>}
                </DialogContent>
                <DialogActions>
                    <Button disabled={cancelling} onClick={() => setShiftToCancel(null)}>{bookingCopy.keepBooking}</Button>
                    <Button color="error" variant="contained" disabled={cancelling} onClick={cancel}>
                        {cancelling ? bookingCopy.cancelling : bookingCopy.confirmCancel}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
