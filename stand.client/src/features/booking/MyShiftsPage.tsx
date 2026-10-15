import ParticipantList from './components/ParticipantList';
import ShiftDetailsTable from './components/ShiftDetailsTable';
import ClosableDatePickerToolbar from './components/ClosableDatePickerToolbar';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Container, DialogContentText, Divider, MenuItem, Snackbar, Stack, TextField, Typography } from '@mui/material';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import AppDialog from '../../components/AppDialog';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { ukUA } from '@mui/x-date-pickers/locales';
import dayjs from 'dayjs';
import 'dayjs/locale/uk';
import BrandHeader from '../../components/BrandHeader';
import { ErrorState, SkeletonList } from '../../components/StateMessage';
import { publicApi } from '../../api/publicApi';
import type { MyShiftDto } from '../../api/types';
import { bookingCopy } from './bookingCopy';
import { clearWizardState } from './wizardState';
import { pagePadding, sectionGap } from '../../layoutSpacing';

export default function MyShiftsPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [bookedCount] = useState(() =>
        (location.state as { justBookedCount?: number } | null)?.justBookedCount ?? 0);
    const [successToastOpen, setSuccessToastOpen] = useState(bookedCount > 0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [shifts, setShifts] = useState<MyShiftDto[]>([]);
    const [shiftToCancel, setShiftToCancel] = useState<MyShiftDto | null>(null);
    const [cancelling, setCancelling] = useState(false);
    const [cancelError, setCancelError] = useState<string | null>(null);
    const [dateFilter, setDateFilter] = useState('');
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const [datePickerView, setDatePickerView] = useState<'year' | 'month' | 'day'>('day');
    const [dateSelectionPending, setDateSelectionPending] = useState(false);
    const dateCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [locationFilter, setLocationFilter] = useState('');
    const dateToolbarProps = { hidden: false, selectionPending: dateSelectionPending };

    useEffect(() => () => {
        if (dateCloseTimer.current !== null) clearTimeout(dateCloseTimer.current);
    }, []);

    const closeDatePicker = () => {
        if (dateCloseTimer.current !== null) clearTimeout(dateCloseTimer.current);
        dateCloseTimer.current = null;
        setDateSelectionPending(false);
        setDatePickerOpen(false);
    };

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
    const shiftDates = new Set(shifts.map((shift) => shift.date));

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
            <BrandHeader title={`${bookingCopy.myShiftsButton}${!loading && !error ? ` (${shifts.length})` : ''}`} />
            <Snackbar
                open={successToastOpen}
                autoHideDuration={16000}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                onClose={(_, reason) => { if (reason !== 'clickaway') setSuccessToastOpen(false); }}
                sx={{ top: 'max(16px, env(safe-area-inset-top, 0px)) !important' }}
            >
                <Alert severity="success" variant="filled" onClose={() => setSuccessToastOpen(false)} sx={{ width: '100%', maxWidth: 568, boxShadow: 3 }}>
                    Запис підтверджено. Кількість доданих записів: {bookedCount}.
                </Alert>
            </Snackbar>
            <Container className="content-enter" maxWidth="sm" sx={{ ...pagePadding, pt: 3, pb: 'calc(104px + env(safe-area-inset-bottom, 0px))' }}>
                <Stack spacing={sectionGap}>
                    {loading && <SkeletonList label="Завантажуємо ваші записи…" rows={2} />}
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
                                    closeOnSelect={false}
                                    readOnly={dateSelectionPending}
                                    open={datePickerOpen}
                                    onOpen={() => setDatePickerOpen(true)}
                                    onClose={() => { if (!dateSelectionPending) closeDatePicker(); }}
                                    view={datePickerView}
                                    onViewChange={(view) => {
                                        if (dateSelectionPending) return;
                                        if (dateCloseTimer.current !== null) clearTimeout(dateCloseTimer.current);
                                        dateCloseTimer.current = null;
                                        setDateSelectionPending(false);
                                        setDatePickerView(view);
                                    }}
                                    slots={{ toolbar: ClosableDatePickerToolbar }}
                                    value={dateFilter ? dayjs(dateFilter) : null}
                                    onChange={(value, context) => {
                                        if (dateSelectionPending) return;
                                        if (dateCloseTimer.current !== null) clearTimeout(dateCloseTimer.current);
                                        dateCloseTimer.current = null;
                                        setDateSelectionPending(false);
                                        if (context.validationError !== null) return;
                                        setDateFilter(value?.format('YYYY-MM-DD') ?? '');
                                        if (value && datePickerOpen && datePickerView === 'day' && context.source === 'view') {
                                            setDateSelectionPending(true);
                                            dateCloseTimer.current = setTimeout(closeDatePicker, 2000);
                                        }
                                    }}
                                    localeText={{
                                        fieldDayPlaceholder: () => 'dd',
                                        fieldMonthPlaceholder: () => 'MM',
                                        fieldYearPlaceholder: () => 'yyyy',
                                        clearButtonLabel: bookingCopy.clearDateFilter,
                                    }}
                                    slotProps={{
                                        toolbar: dateToolbarProps,
                                        textField: {
                                            fullWidth: true,
                                            size: 'small',
                                            sx: { minWidth: 0, cursor: 'pointer' },
                                            onClick: (event) => {
                                                if (dateSelectionPending) return;
                                                if (event.target instanceof Element && event.target.closest('button')) return;
                                                setDatePickerOpen(true);
                                            },
                                        },
                                        field: { clearable: true },
                                        openPickerButton: { sx: { minWidth: 44, minHeight: 44 } },
                                        clearButton: { sx: { minWidth: 44, minHeight: 44 } },
                                        actionBar: { actions: [] },
                                        day: ({ day }) => {
                                            const hasShift = shiftDates.has(day.format('YYYY-MM-DD'));
                                            return hasShift ? {
                                                'aria-label': `${day.format('D MMMM YYYY')}, є ваші записи`,
                                                sx: {
                                                    '&:not(.Mui-selected):not(.Mui-disabled)': {
                                                        bgcolor: 'var(--state-available-bg)',
                                                        color: 'var(--state-available-text)',
                                                        '&:hover': { bgcolor: 'divider' },
                                                    },
                                                },
                                            } : {};
                                        },
                                    }}
                                />
                            </LocalizationProvider>
                            <TextField select fullWidth size="small" label={bookingCopy.locationFilter} value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} sx={{ minWidth: 0 }}>
                                <MenuItem value="">{bookingCopy.allLocations}</MenuItem>
                                {locations.map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
                            </TextField>
                        </Stack>
                    )}
                    {!loading && !error && shifts.length > 0 && filtered.length === 0 && (
                        <Box>
                            <Typography color="text.secondary">{bookingCopy.noMatchingShifts}</Typography>
                            <Button variant="outlined" sx={{ mt: 1.5 }} onClick={() => { setDateFilter(''); setLocationFilter(''); }}>{bookingCopy.resetFilters}</Button>
                        </Box>
                    )}
                    {!loading && !error && filtered.map((shift) => (
                        <Card key={shift.id} variant="outlined" sx={{ bgcolor: 'background.default', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
                            <CardContent sx={{ '&:last-child': { pb: 1 } }}>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <ShiftDetailsTable shift={shift} />
                                    <Divider sx={{ mt: 1.5 }} />
                                    <ParticipantList participants={shift.participants} dashed />
                                </Box>
                                <Divider sx={{ my: 1 }} />
                                <Stack direction="row" sx={{ gap: 0.5, '& > .MuiButton-root': { flex: '1 1 0', minWidth: 0 } }}>
                                    <Button aria-label={`${bookingCopy.cancelBooking}: ${shift.startTime}-${shift.endTime}, ${shift.locationName}`} variant="outlined" color="error" onClick={() => {
                                        setCancelError(null);
                                        setShiftToCancel(shift);
                                    }} sx={{ minHeight: 44 }}>
                                        {bookingCopy.cancelBooking}
                                    </Button>
                                </Stack>
                            </CardContent>
                        </Card>
                    ))}
                </Stack>
            </Container>
            <Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: (theme) => theme.zIndex.appBar, bgcolor: 'background.default', borderTop: '1px solid', borderColor: 'divider', boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.06)', pb: 'env(safe-area-inset-bottom, 0px)' }}>
                <Container maxWidth="sm" sx={{ ...pagePadding, py: 2 }}>
                    <Stack direction="row" spacing={1}>
                        <Button variant="outlined" size="large" onClick={() => {
                            clearWizardState();
                            navigate('/');
                        }} sx={{ minHeight: 56, flexShrink: 0 }}>
                            {bookingCopy.back}
                        </Button>
                        <Button variant="contained" size="large" onClick={() => navigate('/', { state: { startBooking: true } })} sx={{ minHeight: 56, flex: 1, minWidth: 0, px: 1 }}>
                            {bookingCopy.startBooking}
                        </Button>
                    </Stack>
                </Container>
            </Box>
            <AppDialog
                open={Boolean(shiftToCancel)}
                onClose={() => { if (!cancelling) setShiftToCancel(null); }}
                title={bookingCopy.cancelHeading}
                icon={<CancelOutlinedIcon color="primary" />}
                aria-describedby="my-shifts-cancel-description"
                actions={
                    <>
                        <Button variant="outlined" fullWidth disabled={cancelling} onClick={() => setShiftToCancel(null)}>{bookingCopy.keepBooking}</Button>
                        <Button loading={cancelling} color="error" variant="contained" fullWidth disabled={cancelling} onClick={cancel}>
                            {cancelling ? bookingCopy.cancelling : bookingCopy.confirmCancel}
                        </Button>
                    </>
                }
            >
                <DialogContentText id="my-shifts-cancel-description">{bookingCopy.cancelPrompt}</DialogContentText>
                {shiftToCancel && (
                    <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                        <ShiftDetailsTable shift={shiftToCancel} />
                        <Divider sx={{ mt: 1.5 }} />
                        <ParticipantList participants={shiftToCancel.participants} dashed />
                    </Box>
                )}
                {cancelError && <Alert severity="error" sx={{ mt: 2 }}>{cancelError}</Alert>}
            </AppDialog>
        </Box>
    );
}
