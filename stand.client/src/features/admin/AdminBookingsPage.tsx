import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Link,
    IconButton, Menu, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
    TablePagination, TableRow, TextField, Typography,
} from '@mui/material';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { adminApi } from '../../api/adminApi';
import { ApiError } from '../../api/client';
import { LoadingState, ErrorState, EmptyState } from '../../components/StateMessage';
import UkrainianDatePicker from '../../components/UkrainianDatePicker';
import UkrainianTimePicker from '../../components/UkrainianTimePicker';
import type { BookingAdminDto, LocationAdminDto } from '../../api/types';
import { formatDateFull } from '../../utils/date';
import { groupBookingCards } from '../../utils/bookingCardGroups';
import BookingCardGroup from '../../components/BookingCardGroup';

export default function AdminBookingsPage() {
    const [searchParams] = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [items, setItems] = useState<BookingAdminDto[]>([]);
    const cardGroups = groupBookingCards(items);
    const [total, setTotal] = useState(0);
    const [locations, setLocations] = useState<LocationAdminDto[]>([]);

    const [date, setDate] = useState(() => searchParams.get('date') || '');
    const [locationId, setLocationId] = useState<number | ''>('');
    const [timeFrom, setTimeFrom] = useState('');
    const [timeTo, setTimeTo] = useState('');
    const [search, setSearch] = useState('');
    const searchFilter = normalizeBookingSearch(search);
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);

    const [cancelTarget, setCancelTarget] = useState<BookingAdminDto | null>(null);
    const [cancelling, setCancelling] = useState(false);
    const [cancelError, setCancelError] = useState('');
    const [notice, setNotice] = useState('');
    const [detail, setDetail] = useState<BookingAdminDto | null>(null);
    const [actionMenu, setActionMenu] = useState<{ anchorEl: HTMLElement; booking: BookingAdminDto } | null>(null);
    const [refresh, setRefresh] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(null);
        adminApi.listBookings({
            date: date || undefined,
            locationId: locationId || undefined,
            timeFrom: timeFrom || undefined,
            timeTo: timeTo || undefined,
            search: searchFilter,
            isBooked: true,
            page: page + 1,
            pageSize,
        }, controller.signal)
            .then((res) => {
                if (controller.signal.aborted) return;
                setItems(res.items); setTotal(res.totalCount);
                if (!res.items.length && res.totalCount > 0 && page > 0) setPage(Math.max(0, Math.ceil(res.totalCount / pageSize) - 1));
            })
            .catch((e) => { if (!controller.signal.aborted) setError(e instanceof ApiError ? e.message : 'Не вдалося завантажити записи.'); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [date, locationId, timeFrom, timeTo, searchFilter, page, pageSize, refresh]);

    useEffect(() => {
        adminApi.listLocations()
            .then(setLocations)
            .catch(() => setError('Не вдалося завантажити фільтри. Оновіть сторінку, щоб спробувати ще раз.'));
    }, []);

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

    return (
        <Box>
            <Typography component="h1" variant="h4" sx={(theme) => ({
                mb: 2,
                [theme.breakpoints.down('sm')]: {
                    position: 'absolute', width: '1px', height: '1px', p: 0, m: '-1px',
                    overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap', border: 0,
                },
            })}>Записи</Typography>

            <Accordion slotProps={{ heading: { component: 'h2' } }} variant="outlined" disableGutters sx={{ mb: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ fontWeight: 600 }}>Фільтри{[date, locationId, timeFrom, timeTo, searchFilter].some(Boolean) ? ' · застосовано' : ''}</Typography></AccordionSummary>
                <AccordionDetails>
                <Stack spacing={2} direction={{ xs: 'column', sm: 'row' }} useFlexGap sx={{ flexWrap: 'wrap', alignItems: { xs: 'stretch', sm: 'center' } }}>
                    <Box sx={{ minWidth: 160, width: { xs: '100%', sm: 180 } }}>
                        <UkrainianDatePicker label="Дата" name="booking-date" value={date} onChange={(value) => { setDate(value); setPage(0); }} size="small" clearable confirmSelection />
                    </Box>
                    <TextField label="Локація" select value={locationId} onChange={(e) => { setLocationId(e.target.value ? Number(e.target.value) : ''); setPage(0); }}
                        sx={{ minWidth: 180 }} size="small">
                        <MenuItem value="">Усі локації</MenuItem>
                        {locations.map((l) => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
                    </TextField>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1, minWidth: 0, width: { xs: '100%', sm: 368 }, alignItems: 'start' }}>
                        <UkrainianTimePicker label="Час від" name="booking-time-from" value={timeFrom} before={timeTo}
                            onChange={(value) => { setTimeFrom(value); setPage(0); }} />
                        <UkrainianTimePicker label="Час до" name="booking-time-to" value={timeTo} after={timeFrom}
                            onChange={(value) => { setTimeTo(value); setPage(0); }} />
                    </Box>
                    <TextField label="Телефон, ім’я або прізвище" name="booking-search" type="search" value={search} onChange={(e) => {
                        const next = e.target.value;
                        if (normalizeBookingSearch(next) !== searchFilter) setPage(0);
                        setSearch(next);
                    }} helperText={search && !searchFilter ? 'Введіть щонайменше 2 літери або цифри для пошуку.' : undefined}
                        sx={{ minWidth: { xs: 0, sm: 240 } }} size="small" />
                </Stack>
                </AccordionDetails>
            </Accordion>

            {error && <Box sx={{ mb: 2 }}><ErrorState message={error} onRetry={() => setRefresh(n => n + 1)} /></Box>}
            {notice && <Alert severity="success" onClose={() => setNotice('')} sx={{ mb: 2 }}>{notice}</Alert>}
            {loading && <LoadingState />}

            {!loading && items.length === 0 && <EmptyState message="Записів не знайдено." />}

            {!loading && items.length > 0 && (
                <>
                <Stack spacing={2} sx={{ display: { xs: 'flex', md: 'none' } }}>
                    <Typography variant="body2" color="text.secondary">Знайдено записів: {total}</Typography>
                    {cardGroups.map(group => <BookingCardGroup key={group[0].id}>
                        {group.map(b => <Card variant="outlined" key={b.id}><CardContent>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                <Typography component="h2" variant="h6" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>{[b.firstName, b.lastName].filter(Boolean).join(' ') || 'Без імені'}</Typography>
                                <IconButton
                                    id={`booking-actions-${b.id}`}
                                    aria-label={`Дії для запису ${b.publicNumber}`}
                                    aria-haspopup="menu"
                                    aria-controls={actionMenu?.booking.id === b.id ? 'booking-actions-menu' : undefined}
                                    aria-expanded={actionMenu?.booking.id === b.id ? true : undefined}
                                    onClick={(event) => setActionMenu({ anchorEl: event.currentTarget, booking: b })}
                                    sx={{ flexShrink: 0, width: 44, height: 44, mt: -1, mr: -1 }}
                                >
                                    <MoreVertIcon />
                                </IconButton>
                            </Stack>
                            <Typography sx={{ fontWeight: 600, mt: 1 }}>{formatDateFull(b.date)}</Typography>
                            <Typography>{b.startTime}–{b.endTime} · {b.locationName}</Typography>
                        </CardContent></Card>)}
                    </BookingCardGroup>)}
                </Stack>
                <Menu
                    id="booking-actions-menu"
                    anchorEl={actionMenu?.anchorEl}
                    open={!!actionMenu}
                    onClose={() => setActionMenu(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                    slotProps={{ list: { 'aria-labelledby': actionMenu ? `booking-actions-${actionMenu.booking.id}` : undefined } }}
                >
                    <MenuItem onClick={() => {
                        if (actionMenu) setDetail(actionMenu.booking);
                        setActionMenu(null);
                    }}>Деталі</MenuItem>
                    {actionMenu?.booking.isBooked && <MenuItem sx={{ color: 'error.main' }} onClick={() => {
                        requestCancel(actionMenu.booking);
                        setActionMenu(null);
                    }}>Скасувати запис</MenuItem>}
                </Menu>
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

function normalizeBookingSearch(value: string): string | undefined {
    const normalized = /\p{L}/u.test(value)
        ? value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('uk-UA')
        : value.replace(/\D/g, '');
    return normalized.length >= 2 ? normalized : undefined;
}

function BookingDetails({ booking }: { booking: BookingAdminDto }) {
    return <Box><Typography component="p" variant="h6">{[booking.firstName, booking.lastName].filter(Boolean).join(' ') || 'Без імені'}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>№ {booking.publicNumber}</Typography>
        <Typography>{formatDateFull(booking.date)}</Typography><Typography sx={{ fontWeight: 700 }}>{booking.startTime}–{booking.endTime}</Typography>
        <Typography>{booking.locationName}</Typography>{booking.phone && <Link href={`tel:${booking.phone}`} sx={{ display: 'inline-block', py: 1 }}>{booking.phone}</Link>}
    </Box>;
}
