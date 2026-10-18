import ParticipantList from './components/ParticipantList';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Container,
    DialogContentText,
    IconButton,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BrandHeader from '../../components/BrandHeader';
import MainContent from '../../components/MainContent';
import AppDialog from '../../components/AppDialog';
import { LoadingState, ErrorState } from '../../components/StateMessage';
import { publicApi } from '../../api/publicApi';
import { ApiError } from '../../api/client';
import type { BookingSummaryDto } from '../../api/types';
import { formatDate } from '../../utils/date';
import { bookingCopy } from './bookingCopy';
import { clearWizardState } from './wizardState';
import { pagePadding, sectionGap } from '../../layoutSpacing';

export default function BookingStatusPage() {
    const { cancelToken = '' } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const justBooked = Boolean((location.state as { justBooked?: boolean } | null)?.justBooked);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [booking, setBooking] = useState<BookingSummaryDto | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    const load = () => {
        setLoading(true);
        setError(null);
        publicApi
            .getByCancelToken(cancelToken)
            .then(setBooking)
            .catch((e) => setError(e instanceof ApiError ? e.message : 'Не вдалося знайти запис.'))
            .finally(() => setLoading(false));
    };

    useEffect(load, [cancelToken]);

    const handleCancel = () => {
        if (cancelling) return;
        setCancelling(true);
        publicApi
            .cancel(cancelToken)
            .then(setBooking)
            .catch((e) => setError(e instanceof ApiError ? e.message : 'Не вдалося скасувати запис.'))
            .finally(() => {
                setCancelling(false);
                setConfirmOpen(false);
            });
    };

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
            <BrandHeader />
            <Container component={MainContent} className="content-enter" maxWidth="sm" sx={pagePadding}>
                <Typography component="h1" variant="h5" sx={{ mb: 2 }}>{bookingCopy.shiftDetails}</Typography>
                {!justBooked && (
                    <Stack direction="row" sx={{ mb: 1, minHeight: 44, alignItems: 'center' }}>
                        <Tooltip title={bookingCopy.back}>
                            <IconButton
                                onClick={() => navigate('/my-shifts')}
                                aria-label={bookingCopy.back}
                                edge="start"
                                sx={{ minWidth: 44, minHeight: 44, color: 'primary.dark' }}
                            >
                                <ArrowBackIcon />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                )}
                {loading && <LoadingState label="Завантажуємо запис…" />}
                {error && !loading && <ErrorState message={error} onRetry={load} />}

                {booking && !loading && (
                    <Stack spacing={sectionGap}>
                        {justBooked && booking.isBooked && (
                            <Box sx={{ textAlign: 'center', pt: 0, pb: 1.5 }}>
                                <CheckCircleIcon color="success" sx={{ fontSize: 56, mb: 1 }} />
                                <Typography component="h2" variant="h5" sx={{ fontWeight: 700 }}>{bookingCopy.success}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Дякуємо, що долучаєтесь до чергування.
                                </Typography>
                            </Box>
                        )}

                        {!booking.isBooked && (
                            <Alert severity="warning" sx={{ borderRadius: 1 }}>Цей запис скасовано.</Alert>
                        )}

                        <Card variant="outlined">
                            <CardContent>
                                <Stack direction="row" sx={{ mb: 2, justifyContent: 'flex-end' }}>
                                    <Chip
                                        size="small"
                                        label={booking.isBooked ? 'Записано' : 'Не записано'}
                                        color={booking.isBooked ? 'success' : 'default'}
                                    />
                                </Stack>
                                <Stack spacing={1.25}>
                                    <Row label="Дата" value={formatDate(booking.date)} />
                                    <Row label="Час" value={`${booking.startTime}–${booking.endTime}`} />
                                    <Row label="Локація" value={booking.locationName} />
                                    {booking.locationAddress && <Row label="Адреса" value={booking.locationAddress} />}
                                </Stack>
                                <ParticipantList participants={booking.participants} />
                            </CardContent>
                        </Card>

                        <Stack spacing={1}>
                            <Button variant="contained" fullWidth startIcon={<HomeOutlinedIcon />} sx={{ minHeight: 48 }} onClick={() => {
                                clearWizardState();
                                navigate('/');
                            }}>
                                {bookingCopy.home}
                            </Button>
                            <Button variant="text" fullWidth sx={{ minHeight: 48 }} onClick={() => navigate('/', { state: { startBooking: true } })}>
                                {bookingCopy.bookMore}
                            </Button>
                        </Stack>

                        {booking.isBooked && (
                            <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 1, textAlign: 'center' }}>
                                <Button
                                    variant="text"
                                    color="error"
                                    startIcon={<CancelOutlinedIcon />}
                                    disabled={cancelling}
                                    sx={{ minHeight: 44 }}
                                    onClick={() => setConfirmOpen(true)}
                                >
                                    {bookingCopy.cancelBooking}
                                </Button>
                            </Box>
                        )}
                    </Stack>
                )}
            </Container>

            <AppDialog
                open={confirmOpen}
                onClose={() => { if (!cancelling) setConfirmOpen(false); }}
                title={bookingCopy.cancelHeading}
                icon={<CancelOutlinedIcon color="primary" />}
                aria-describedby="booking-cancel-description"
                actions={
                    <>
                        <Button variant="outlined" fullWidth disabled={cancelling} onClick={() => setConfirmOpen(false)}>{bookingCopy.keepBooking}</Button>
                        <Button loading={cancelling} color="error" variant="contained" fullWidth disabled={cancelling} onClick={handleCancel}>
                            {cancelling ? bookingCopy.cancelling : bookingCopy.confirmCancel}
                        </Button>
                    </>
                }
            >
                <DialogContentText id="booking-cancel-description">
                    Ви впевнені, що хочете скасувати цей запис на чергування? Цю дію неможливо відмінити.
                </DialogContentText>
            </AppDialog>

        </Box>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>{value}</Typography>
        </Stack>
    );
}
