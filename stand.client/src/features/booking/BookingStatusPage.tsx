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
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Divider,
    Stack,
    Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EventIcon from '@mui/icons-material/Event';
import EventNoteIcon from '@mui/icons-material/EventNote';
import AddIcon from '@mui/icons-material/Add';
import BrandHeader from '../../components/BrandHeader';
import { LoadingState, ErrorState } from '../../components/StateMessage';
import { publicApi } from '../../api/publicApi';
import { ApiError } from '../../api/client';
import type { BookingSummaryDto } from '../../api/types';
import { formatDateFull } from '../../utils/date';
import { bookingCopy } from './bookingCopy';
import { clearWizardState } from './wizardState';

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

    const downloadIcs = () => {
        if (!booking) return;
        const safeDate = booking.date.replaceAll('-', '');
        const start = `${safeDate}T${booking.startTime.replace(':', '')}00`;
        const end = `${safeDate}T${booking.endTime.replace(':', '')}00`;
        const body = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'BEGIN:VEVENT',
            `SUMMARY:${bookingCopy.shift}: ${booking.locationName}`,
            `DTSTART:${start}`,
            `DTEND:${end}`,
            `LOCATION:${[booking.locationName, booking.locationAddress].filter(Boolean).join(', ')}`,
            `DESCRIPTION:${bookingCopy.cancellationNote}`,
            'END:VEVENT',
            'END:VCALENDAR',
        ].join('\r\n');
        const href = URL.createObjectURL(new Blob([body], { type: 'text/calendar;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = href;
        link.download = `stand-${booking.publicNumber}.ics`;
        link.click();
        URL.revokeObjectURL(href);
    };

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
            <BrandHeader />
            <Container maxWidth="sm" sx={{ pt: 1, pb: 3 }}>
                {loading && <LoadingState label="Завантажуємо запис…" />}
                {error && !loading && <ErrorState message={error} onRetry={load} />}

                {booking && !loading && (
                    <Stack spacing={2.5}>
                        {justBooked && booking.status === 'Confirmed' && (
                            <Box sx={{ textAlign: 'center', pt: 0, pb: 1.5 }}>
                                <CheckCircleIcon color="success" sx={{ fontSize: 56, mb: 1 }} />
                                <Typography variant="h5" sx={{ fontWeight: 700 }}>{bookingCopy.success}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Дякуємо, що долучаєтесь до чергування.
                                </Typography>
                            </Box>
                        )}

                        {booking.status === 'Cancelled' && (
                            <Alert severity="warning" sx={{ borderRadius: 2 }}>Цей запис скасовано.</Alert>
                        )}

                        <Card variant="outlined">
                            <CardContent>
                                <Stack direction="row" sx={{ mb: 1.5, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <Typography variant="overline" color="text.secondary">Номер запису</Typography>
                                    <Chip
                                        size="small"
                                        label={statusLabel(booking.status)}
                                        color={statusColor(booking.status)}
                                    />
                                </Stack>
                                <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, letterSpacing: 0.5 }}>
                                    {booking.publicNumber}
                                </Typography>

                                <Divider sx={{ mb: 2 }} />

                                <Stack spacing={1.25}>
                                    <Row label="Дата" value={formatDateFull(booking.date)} />
                                    <Row label="Час" value={`${booking.startTime}–${booking.endTime}`} />
                                    <Row label="Локація" value={booking.locationName} />
                                    {booking.locationAddress && <Row label="Адреса" value={booking.locationAddress} />}
                                    {booking.firstName && (
                                        <Row label="Ім'я" value={`${booking.firstName} ${booking.lastName ?? ''}`} />
                                    )}
                                    {booking.phone && <Row label="Телефон" value={booking.phone} />}
                                    {booking.comment && <Row label="Коментар" value={booking.comment} />}
                                </Stack>
                            </CardContent>
                        </Card>

                        <Stack spacing={1}>
                            <Button variant="contained" fullWidth startIcon={<EventNoteIcon />} sx={{ minHeight: 48 }} onClick={() => {
                                clearWizardState();
                                navigate('/my-shifts');
                            }}>
                                {bookingCopy.myShiftsButton}
                            </Button>
                            {booking.status === 'Confirmed' && (
                                <Button variant="outlined" fullWidth startIcon={<EventIcon />} sx={{ minHeight: 48 }} onClick={downloadIcs}>
                                    {bookingCopy.addToCalendar}
                                </Button>
                            )}
                            <Button variant="text" fullWidth startIcon={<AddIcon />} sx={{ minHeight: 48 }} onClick={() => navigate('/', { state: { startBooking: true } })}>
                                {bookingCopy.bookMore}
                            </Button>
                        </Stack>

                        {booking.status === 'Confirmed' && (
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

            <Dialog open={confirmOpen} onClose={() => { if (!cancelling) setConfirmOpen(false); }}>
                <DialogTitle>Скасувати запис?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Ви впевнені, що хочете скасувати цей запис на чергування? Цю дію неможливо відмінити.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button disabled={cancelling} onClick={() => setConfirmOpen(false)}>Ні, залишити</Button>
                    <Button color="error" variant="contained" disabled={cancelling} onClick={handleCancel}>
                        {cancelling ? 'Скасовуємо…' : 'Так, скасувати'}
                    </Button>
                </DialogActions>
            </Dialog>

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

function statusLabel(status: string): string {
    switch (status) {
        case 'Confirmed': return 'Підтверджено';
        case 'Cancelled': return 'Скасовано';
        case 'Held': return 'Утримується';
        default: return status;
    }
}

function statusColor(status: string): 'success' | 'default' | 'warning' {
    switch (status) {
        case 'Confirmed': return 'success';
        case 'Cancelled': return 'default';
        default: return 'warning';
    }
}
