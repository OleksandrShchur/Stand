import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Link,
    IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
    TablePagination, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { adminApi, type BookingFilters } from '../../api/adminApi';
import { downloadFile, ApiError } from '../../api/client';
import { LoadingState, ErrorState, EmptyState } from '../../components/StateMessage';
import type { BookingAdminDto, LocationAdminDto, TimeSlotAdminDto } from '../../api/types';
import { formatDateFull, todayIso } from '../../utils/date';

const BOOKING_OPTIONS = [
    { value: '', label: 'Усі записи' },
    { value: 'true', label: 'Записано' },
    { value: 'false', label: 'Не записано' },
];

export default function AdminBookingsPage() {
    const [searchParams] = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [items, setItems] = useState<BookingAdminDto[]>([]);
    const [total, setTotal] = useState(0);
    const [locations, setLocations] = useState<LocationAdminDto[]>([]);
    const [timeSlots, setTimeSlots] = useState<TimeSlotAdminDto[]>([]);

    const [date, setDate] = useState(() => searchParams.get('date') || '');
    const [locationId, setLocationId] = useState<number | ''>('');
    const [timeSlotId, setTimeSlotId] = useState<number | ''>('');
    const [phone, setPhone] = useState('');
    const [bookingState, setBookingState] = useState('true');
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);

    const [cancelTarget, setCancelTarget] = useState<BookingAdminDto | null>(null);
    const [cancelling, setCancelling] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [cancelError, setCancelError] = useState('');
    const [notice, setNotice] = useState('');
    const [detail, setDetail] = useState<BookingAdminDto | null>(null);
    const [applied, setApplied] = useState<BookingFilters>(() => ({ date: searchParams.get('date') || undefined, isBooked: true }));
    const [refresh, setRefresh] = useState(0);

    const buildFilters = (): BookingFilters => ({
        date: date || undefined,
        locationId: locationId || undefined,
        timeSlotId: timeSlotId || undefined,
        phone: phone || undefined,
        isBooked: bookingState === '' ? undefined : bookingState === 'true',
        page: page + 1,
        pageSize,
    });

    const load = () => {
        setLoading(true);
        setError(null);
        let current = true;
        adminApi.listBookings({ ...applied, page: page + 1, pageSize })
            .then((res) => {
                if (!current) return;
                setItems(res.items); setTotal(res.totalCount);
                if (!res.items.length && res.totalCount > 0 && page > 0) setPage(Math.max(0, Math.ceil(res.totalCount / pageSize) - 1));
            })
            .catch((e) => { if (current) setError(e instanceof ApiError ? e.message : 'Не вдалося завантажити записи.'); })
            .finally(() => { if (current) setLoading(false); });
        return () => { current = false; };
    };

    useEffect(() => {
        Promise.all([adminApi.listLocations(), adminApi.listTimeSlots(true)])
            .then(([locs, slots]) => { setLocations(locs); setTimeSlots(slots); })
            .catch(() => setError('Не вдалося завантажити фільтри. Оновіть сторінку, щоб спробувати ще раз.'));
    }, []);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(load, [page, pageSize, applied, refresh]);

    const applyFilters = () => { setPage(0); setApplied(buildFilters()); };
    const requestCancel = (booking: BookingAdminDto) => { setCancelError(''); setCancelTarget(booking); };

    const doCancel = () => {
        if (!cancelTarget) return;
        setCancelling(true);
        setCancelError('');
        adminApi.cancelBooking(cancelTarget.id)
            .then(() => { setNotice(`Запис ${cancelTarget.publicNumber} скасовано.`); setCancelTarget(null); setDetail(null); setRefresh(n => n + 1); })
            .catch((e) => setCancelError(e instanceof ApiError ? e.message : 'Не вдалося скасувати запис.'))
            .finally(() => setCancelling(false));
    };

    const exportCsv = () => {
        if (exporting) return;
        setExporting(true);
        downloadFile(adminApi.exportCsvUrl(applied), 'bookings.csv')
            .catch(() => setError('Не вдалося завантажити CSV.'))
            .finally(() => setExporting(false));
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Typography component="h1" variant="h4">Записи</Typography>
                <Button loading={exporting} loadingPosition="start" variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv}>Експорт CSV</Button>
            </Box>

            <ToggleButtonGroup exclusive fullWidth color="primary" aria-label="Період записів"
                value={applied.date === todayIso() ? 'today' : applied.date ? null : 'all'}
                onChange={(_, value: 'today' | 'all' | null) => {
                    if (value === null) return;
                    if (value === 'today') {
                        setDate(todayIso());
                        setApplied({ ...buildFilters(), date: todayIso() });
                    } else {
                        setDate(''); setLocationId(''); setTimeSlotId(''); setPhone(''); setBookingState(''); setApplied({});
                    }
                    setPage(0);
                }}
                sx={{ mb: 2, maxWidth: { sm: 360 }, '& .MuiToggleButton-root': { minHeight: 44 } }}>
                <ToggleButton value="today">Сьогодні</ToggleButton>
                <ToggleButton value="all">Усі записи</ToggleButton>
            </ToggleButtonGroup>

            <Accordion slots={{ heading: 'h2' }} variant="outlined" disableGutters sx={{ mb: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ fontWeight: 600 }}>Фільтри{[applied.date, applied.locationId, applied.timeSlotId, applied.phone].some(Boolean) || applied.isBooked !== undefined ? ' · застосовано' : ''}</Typography></AccordionSummary>
                <AccordionDetails>
                <Stack spacing={2} direction={{ xs: 'column', sm: 'row' }} useFlexGap sx={{ flexWrap: 'wrap', alignItems: { xs: 'stretch', sm: 'center' } }}>
                    <TextField label="Дата" type="date" value={date} onChange={(e) => setDate(e.target.value)}
                        slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 160 }} size="small" />
                    <TextField label="Локація" select value={locationId} onChange={(e) => setLocationId(e.target.value ? Number(e.target.value) : '')}
                        sx={{ minWidth: 180 }} size="small">
                        <MenuItem value="">Усі локації</MenuItem>
                        {locations.map((l) => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
                    </TextField>
                    <TextField label="Час" select value={timeSlotId} onChange={(e) => setTimeSlotId(e.target.value ? Number(e.target.value) : '')}
                        sx={{ minWidth: 150 }} size="small">
                        <MenuItem value="">Увесь час</MenuItem>
                        {timeSlots.map((s) => <MenuItem key={s.id} value={s.id}>{s.startTime}–{s.endTime}</MenuItem>)}
                    </TextField>
                    <TextField label="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} sx={{ minWidth: 160 }} size="small" />
                    <TextField label="Запис" select value={bookingState} onChange={(e) => setBookingState(e.target.value)} sx={{ minWidth: 160 }} size="small">
                        {BOOKING_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                    </TextField>
                    <Button loading={loading} loadingPosition="start" variant="contained" startIcon={<RefreshIcon />} onClick={applyFilters}>Застосувати</Button>
                </Stack>
                </AccordionDetails>
            </Accordion>

            {error && <Box sx={{ mb: 2 }}><ErrorState message={error} onRetry={load} /></Box>}
            {notice && <Alert severity="success" onClose={() => setNotice('')} sx={{ mb: 2 }}>{notice}</Alert>}
            {loading && <LoadingState />}

            {!loading && items.length === 0 && <EmptyState message="Записів не знайдено." />}

            {!loading && items.length > 0 && (
                <>
                <Stack spacing={2} sx={{ display: { xs: 'flex', md: 'none' } }}>
                    <Typography variant="body2" color="text.secondary">Знайдено записів: {total}</Typography>
                    {items.map(b => <Card variant="outlined" key={b.id}><CardContent>
                        <Typography component="h2" variant="h6">{[b.firstName, b.lastName].filter(Boolean).join(' ') || 'Без імені'}</Typography>
                        <Typography sx={{ fontWeight: 600, mt: 1 }}>{formatDateFull(b.date)}</Typography>
                        <Typography>{b.startTime}–{b.endTime} · {b.locationName}</Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                            <Button fullWidth variant="outlined" onClick={() => setDetail(b)}>Деталі</Button>
                            {b.isBooked && <Button fullWidth color="error" onClick={() => requestCancel(b)}>Скасувати запис</Button>}
                        </Stack>
                    </CardContent></Card>)}
                </Stack>
                <TableContainer component={Paper} variant="outlined">
                    <Table size="small" aria-label="Записи на чергування" sx={{ display: { xs: 'none', md: 'table' } }}>
                        <TableHead>
                            <TableRow>
                                <TableCell>№</TableCell>
                                <TableCell>Дата</TableCell>
                                <TableCell>Час</TableCell>
                                <TableCell>Локація</TableCell>
                                <TableCell>Імʼя</TableCell>
                                <TableCell>Телефон</TableCell>
                                <TableCell>Запис</TableCell>
                                <TableCell align="center">Дії</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {items.map((b) => (
                                <TableRow key={b.id} hover>
                                    <TableCell>{b.publicNumber}</TableCell>
                                    <TableCell>{b.date}</TableCell>
                                    <TableCell>{b.startTime}–{b.endTime}</TableCell>
                                    <TableCell>{b.locationName}</TableCell>
                                    <TableCell>{[b.firstName, b.lastName].filter(Boolean).join(' ')}</TableCell>
                                    <TableCell>{b.phone}</TableCell>
                                    <TableCell>
                                        <Chip size="small" label={b.isBooked ? 'Записано' : 'Не записано'} color={b.isBooked ? 'success' : 'default'} />
                                    </TableCell>
                                    <TableCell align="center">
                                        <Button onClick={() => setDetail(b)}>Деталі</Button>
                                        {b.isBooked && (
                                            <IconButton aria-label={`Скасувати запис ${b.publicNumber}`} onClick={() => requestCancel(b)}>
                                                <CancelOutlinedIcon fontSize="small" />
                                            </IconButton>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <TablePagination
                        component="div"
                        count={total}
                        page={page}
                        onPageChange={(_, p) => setPage(p)}
                        rowsPerPage={pageSize}
                        onRowsPerPageChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
                        rowsPerPageOptions={[10, 25, 50, 100]}
                        labelRowsPerPage="На сторінці:"
                        labelDisplayedRows={({ from, to, count }) => `${from}–${to} з ${count}`}
                        getItemAriaLabel={(type) => ({ first: 'Перша сторінка', last: 'Остання сторінка', next: 'Наступна сторінка', previous: 'Попередня сторінка' })[type]}
                        sx={{ '& .MuiTablePagination-toolbar': { px: { xs: 0, sm: 2 } }, '& .MuiTablePagination-selectLabel': { display: { xs: 'none', sm: 'block' } }, '& .MuiTablePagination-spacer': { display: { xs: 'none', sm: 'block' } } }}
                    />
                </TableContainer>
                </>
            )}

            <Dialog open={!!detail} onClose={() => setDetail(null)} fullWidth maxWidth="sm" aria-labelledby="booking-detail-title">
                <DialogTitle id="booking-detail-title">Деталі запису</DialogTitle>
                <DialogContent>{detail && <Stack spacing={1.5}>
                    <BookingDetails booking={detail} />
                    <Typography>{detail.isBooked ? 'Записано' : 'Не записано'}</Typography>
                    {detail.comment && <Typography sx={{ whiteSpace: 'pre-wrap' }}>Коментар: {detail.comment}</Typography>}
                    <Typography variant="body2" color="text.secondary">Створено: {new Date(detail.createdAtUtc).toLocaleString('uk-UA')}</Typography>
                </Stack>}</DialogContent>
                <DialogActions sx={{ p: 2 }}><Button onClick={() => setDetail(null)}>Закрити</Button>
                    {detail?.isBooked && <Button color="error" onClick={() => requestCancel(detail)}>Скасувати запис</Button>}
                </DialogActions>
            </Dialog>
            <Dialog open={!!cancelTarget} onClose={() => { if (!cancelling) setCancelTarget(null); }} fullWidth maxWidth="sm" aria-labelledby="booking-cancel-title" aria-describedby="booking-cancel-warning">
                <DialogTitle id="booking-cancel-title">Скасувати цей запис?</DialogTitle>
                <DialogContent>
                    {cancelTarget && <BookingDetails booking={cancelTarget} />}
                    <Alert severity="warning" id="booking-cancel-warning" sx={{ mt: 2 }}>Учасника буде вилучено з цього чергування. Місце звільниться, якщо час доступний у розкладі. Скасування не можна скасувати автоматично. Учасник не отримає автоматичного сповіщення — повідомте його особисто.</Alert>
                    {cancelError && <Alert severity="error" sx={{ mt: 2 }}>{cancelError}</Alert>}
                </DialogContent>
                <DialogActions sx={{ p: 2, flexWrap: 'wrap', gap: 1 }}>
                    <Button disabled={cancelling} onClick={() => setCancelTarget(null)}>Залишити запис</Button>
                    <Button loading={cancelling} color="error" variant="contained" disabled={cancelling} onClick={doCancel}>
                        {cancelling ? 'Скасовуємо…' : 'Так, скасувати запис'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

function BookingDetails({ booking }: { booking: BookingAdminDto }) {
    return <Box><Typography component="p" variant="h6">{[booking.firstName, booking.lastName].filter(Boolean).join(' ') || 'Без імені'}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>№ {booking.publicNumber}</Typography>
        <Typography>{formatDateFull(booking.date)}</Typography><Typography sx={{ fontWeight: 700 }}>{booking.startTime}–{booking.endTime}</Typography>
        <Typography>{booking.locationName}</Typography>{booking.phone && <Link href={`tel:${booking.phone}`} sx={{ display: 'inline-block', py: 1 }}>{booking.phone}</Link>}
    </Box>;
}
