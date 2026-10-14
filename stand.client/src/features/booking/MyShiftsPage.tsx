import ParticipantList from './components/ParticipantList';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Container, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Divider, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { ukUA } from '@mui/x-date-pickers/locales';
import dayjs from 'dayjs';
import 'dayjs/locale/uk';
import AddIcon from '@mui/icons-material/Add';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import BrandHeader from '../../components/BrandHeader';
import { ErrorState, SkeletonList } from '../../components/StateMessage';
import { publicApi } from '../../api/publicApi';
import type { MyShiftDto } from '../../api/types';
import { formatDateFull } from '../../utils/date';
import { bookingCopy } from './bookingCopy';
import { clearWizardState } from './wizardState';
import { pagePadding, sectionGap } from '../../layoutSpacing';

export default function MyShiftsPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [shifts, setShifts] = useState<MyShiftDto[]>([]);
    const [shiftToCancel, setShiftToCancel] = useState<MyShiftDto | null>(null);
    const [cancelling, setCancelling] = useState(false);
    const [cancelError, setCancelError] = useState<string | null>(null);
    const [dateFilter, setDateFilter] = useState('');
    const [locationFilter, setLocationFilter] = useState('');

    const load = () => {
        setLoading(true);
        setError(null);
        publicApi.getMyUpcomingShifts()
            .then(setShifts)
            .catch(() => setError(bookingCopy.shiftsLoadError))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const filtered = shifts.filter((shift) =>
        (!dateFilter || shift.date === dateFilter) &&
        (!locationFilter || shift.locationName === locationFilter));
    const locations = [...new Set(shifts.map((shift) => shift.locationName))].sort((a, b) => a.localeCompare(b, 'uk'));

    const cancel = () => {
        if (!shiftToCancel || cancelling) return;
        setCancelling(true);
        setCancelError(null);
        publicApi.cancelMyShift(shiftToCancel.cancelToken)
            .then(() => {
                setShifts((items) => items.filter((item) => item.id !== shiftToCancel.id));
                setShiftToCancel(null);
                setDateFilter('');
                setLocationFilter('');
            })
            .catch(() => setCancelError(bookingCopy.shiftCancelError))
            .finally(() => setCancelling(false));
    };

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
            <BrandHeader />
            <Container maxWidth="sm" sx={pagePadding}>
                <Stack spacing={sectionGap}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minHeight: 44 }}>
                        <Tooltip title={bookingCopy.back}>
                            <IconButton aria-label={bookingCopy.back} edge="start" sx={{ minWidth: 44, minHeight: 44, color: 'primary.dark' }} onClick={() => {
                                clearWizardState();
                                navigate('/');
                            }}>
                                <ArrowBackIcon />
                            </IconButton>
                        </Tooltip>
                        <Typography variant="h5" sx={{ whiteSpace: 'nowrap' }}>{bookingCopy.myShiftsButton}</Typography>
                        {!loading && !error && (
                            <Typography variant="body2" color="text.secondary" aria-label={bookingCopy.upcomingCount(shifts.length)}>
                                ({shifts.length})
                            </Typography>
                        )}
                        <Box sx={{ flex: 1 }} />
                        <Tooltip title={bookingCopy.home}>
                            <IconButton aria-label={bookingCopy.home} color="primary" sx={{ minWidth: 44, minHeight: 44 }} onClick={() => {
                                clearWizardState();
                                navigate('/');
                            }}>
                                <HomeOutlinedIcon />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                    {loading && <SkeletonList rows={2} />}
                    {error && !loading && <ErrorState message={error} onRetry={load} />}
                    {!loading && !error && shifts.length === 0 && (
                        <Card variant="outlined">
                            <CardContent sx={{ py: 4, textAlign: 'center' }}>
                                <Typography color="text.secondary">{bookingCopy.noUpcomingShifts}</Typography>
                            </CardContent>
                        </Card>
                    )}
                    {!loading && !error && shifts.length > 0 && (
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="uk" localeText={ukUA.components.MuiLocalizationProvider.defaultProps.localeText}>
                                <DatePicker
                                    label={bookingCopy.dateFilter}
                                    format="DD.MM.YYYY"
                                    value={dateFilter ? dayjs(dateFilter) : null}
                                    onChange={(value, context) => {
                                        if (context.validationError === null) setDateFilter(value?.format('YYYY-MM-DD') ?? '');
                                    }}
                                    localeText={{
                                        fieldDayPlaceholder: () => 'dd',
                                        fieldMonthPlaceholder: () => 'MM',
                                        fieldYearPlaceholder: () => 'yyyy',
                                        clearButtonLabel: bookingCopy.clearDateFilter,
                                    }}
                                    slotProps={{
                                        textField: { fullWidth: true, size: 'small', sx: { minWidth: 0 } },
                                        field: { clearable: true },
                                        openPickerButton: { sx: { minWidth: 44, minHeight: 44 } },
                                        clearButton: { sx: { minWidth: 44, minHeight: 44 } },
                                        actionBar: { actions: ['clear', 'cancel', 'accept'] },
                                    }}
                                />
                            </LocalizationProvider>
                            <TextField select fullWidth size="small" label={bookingCopy.locationFilter} value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}>
                                <MenuItem value="">{bookingCopy.allLocations}</MenuItem>
                                {locations.map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
                            </TextField>
                        </Stack>
                    )}
                    {!loading && !error && shifts.length > 0 && filtered.length === 0 && (
                        <Box>
                            <Typography color="text.secondary">{bookingCopy.noMatchingShifts}</Typography>
                            <Button onClick={() => { setDateFilter(''); setLocationFilter(''); }}>{bookingCopy.resetFilters}</Button>
                        </Box>
                    )}
                    {!loading && !error && filtered.map((shift) => (
                        <Card key={shift.id} variant="outlined">
                            <CardContent sx={{ '&:last-child': { pb: 1 } }}>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography sx={{ fontWeight: 800 }}>{formatDateFull(shift.date)}</Typography>
                                    <Typography sx={{ fontWeight: 700 }}>{shift.startTime}-{shift.endTime}</Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                                        {shift.locationName}{shift.locationAddress ? `, ${shift.locationAddress}` : ''}
                                    </Typography>
                                    <ParticipantList participants={shift.participants} />
                                </Box>
                                <Divider sx={{ my: 1 }} />
                                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Button endIcon={<ChevronRightIcon />} onClick={() => navigate(`/booking/${shift.cancelToken}`)}>{bookingCopy.shiftDetails}</Button>
                                    <Tooltip title={bookingCopy.cancelBooking}>
                                        <IconButton aria-label={`${bookingCopy.cancelBooking}: ${shift.startTime}-${shift.endTime}, ${shift.locationName}`} color="error" onClick={() => {
                                            setCancelError(null);
                                            setShiftToCancel(shift);
                                        }} sx={{ minWidth: 44, minHeight: 44 }}>
                                            <CancelOutlinedIcon />
                                        </IconButton>
                                    </Tooltip>
                                </Stack>
                            </CardContent>
                        </Card>
                    ))}
                    <Button variant="contained" size="large" fullWidth startIcon={<AddIcon />} onClick={() => navigate('/', { state: { startBooking: true } })}>
                        {bookingCopy.startBooking}
                    </Button>
                </Stack>
            </Container>
            <Dialog open={Boolean(shiftToCancel)} onClose={() => { if (!cancelling) setShiftToCancel(null); }}>
                <DialogTitle>{bookingCopy.cancelHeading}</DialogTitle>
                <DialogContent>
                    <DialogContentText>{bookingCopy.cancelPrompt}</DialogContentText>
                    {shiftToCancel && (
                        <Box>
                            <Typography sx={{ mt: 1 }}>
                                {formatDateFull(shiftToCancel.date)} · {shiftToCancel.startTime}-{shiftToCancel.endTime} · {shiftToCancel.locationName}
                            </Typography>
                            <ParticipantList participants={shiftToCancel.participants} />
                        </Box>
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
