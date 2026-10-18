import { Fragment, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Link,
    IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
    TablePagination, TableRow, TextField, Typography,
} from '@mui/material';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { adminApi } from '../../api/adminApi';
import { ApiError } from '../../api/client';
import { LoadingState, ErrorState, EmptyState } from '../../components/StateMessage';
import UkrainianDatePicker from '../../components/UkrainianDatePicker';
import UkrainianTimePicker from '../../components/UkrainianTimePicker';
import type { BookingAdminDto, LocationAdminDto } from '../../api/types';
import { formatDate, formatDateTime } from '../../utils/date';
import { groupBookingCards } from '../../utils/bookingCardGroups';
import BookingCardGroup from '../../components/BookingCardGroup';
import AppDialog from '../../components/AppDialog';
import { formatUaPhone } from '../../utils/phone';
import { surfaceRadius, surfaceShadow } from '../../surfaceStyles';

export default function AdminBookingsPage() {
    const [searchParams] = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [items, setItems] = useState<BookingAdminDto[]>([]);
    const cardGroups = groupBookingCards(items);
    const [total, setTotal] = useState(0);
    const [locations, setLocations] = useState<LocationAdminDto[]>([]);

    const [date, setDate] = useState(() => searchParams.get('date') || '');
    const [locationId, setLocationId] = useState<number | ''>(() => {
        const id = Number(searchParams.get('locationId'));
        return Number.isInteger(id) && id > 0 ? id : '';
    });
    const [dateRange, setDateRange] = useState(() => ({ from: searchParams.get('dateFrom') || '', to: searchParams.get('dateTo') || '' }));
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
            dateFrom: dateRange.from || undefined,
            dateTo: dateRange.to || undefined,
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
    }, [date, dateRange.from, dateRange.to, locationId, timeFrom, timeTo, searchFilter, page, pageSize, refresh]);

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
                <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ fontWeight: 600 }}>Фільтри{[date, dateRange.from, dateRange.to, locationId, timeFrom, timeTo, searchFilter].some(Boolean) ? ' · застосовано' : ''}</Typography></AccordionSummary>
                <AccordionDetails>
                <Stack spacing={2} direction={{ xs: 'column', sm: 'row' }} useFlexGap sx={{ flexWrap: 'wrap', alignItems: { xs: 'stretch', sm: 'center' } }}>
                    <Box sx={{ minWidth: 160, width: { xs: '100%', sm: 180 } }}>
                        <UkrainianDatePicker label="Дата" name="booking-date" value={date} onChange={(value) => { setDate(value); setDateRange({ from: '', to: '' }); setPage(0); }} size="small" clearable confirmSelection />
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

            {(date || dateRange.from || dateRange.to || locationId) && <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1, mb: 2 }} aria-label="Застосовані фільтри">
                {date && <Chip variant="outlined" label={`Дата: ${formatDate(date)}`} onDelete={() => { setDate(''); setPage(0); }} />}
                {(dateRange.from || dateRange.to) && <Chip variant="outlined"
                    label={`Період: ${dateRange.from ? formatDate(dateRange.from) : '…'} – ${dateRange.to ? formatDate(dateRange.to) : '…'}`}
                    onDelete={() => { setDateRange({ from: '', to: '' }); setPage(0); }} />}
                {locationId && <Chip variant="outlined" label={locations.find(location => location.id === locationId)?.name ?? `Локація ${locationId}`}
                    onDelete={() => { setLocationId(''); setPage(0); }} />}
            </Stack>}

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
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                                <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                                    <Typography component="h2" variant="h6">{[b.firstName, b.lastName].filter(Boolean).join(' ') || 'Без імені'}</Typography>
                                    <Typography sx={{ fontWeight: 600, mt: 1 }}>{formatDate(b.date)}</Typography>
                                    <Typography>{b.startTime}–{b.endTime} · {b.locationName}</Typography>
                                </Box>
                                <IconButton
                                    id={`booking-actions-${b.id}`}
                                    aria-label={`Дії для запису ${b.publicNumber}`}
                                    aria-haspopup="menu"
                                    aria-controls={actionMenu?.booking.id === b.id ? 'booking-actions-menu' : undefined}
                                    aria-expanded={actionMenu?.booking.id === b.id ? true : undefined}
                                    onClick={(event) => setActionMenu({ anchorEl: event.currentTarget, booking: b })}
                                    sx={{ flexShrink: 0, width: 44, height: 44, mr: -1 }}
                                >
                                    <MoreVertIcon />
                                </IconButton>
                            </Stack>
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
                    slotProps={{ list: { 'aria-labelledby': actionMenu?.anchorEl.id } }}
                >
                    <MenuItem onClick={() => {
                        if (actionMenu) setDetail(actionMenu.booking);
                        setActionMenu(null);
                    }}>
                        <ListItemIcon><InfoOutlinedIcon fontSize="small" /></ListItemIcon>
                        <ListItemText>Деталі</ListItemText>
                    </MenuItem>
                    {actionMenu?.booking.isBooked && <MenuItem sx={{ color: 'error.main' }} onClick={() => {
                        requestCancel(actionMenu.booking);
                        setActionMenu(null);
                    }}>
                        <ListItemIcon sx={{ color: 'inherit' }}><CancelOutlinedIcon fontSize="small" /></ListItemIcon>
                        <ListItemText>Скасувати запис</ListItemText>
                    </MenuItem>}
                </Menu>
                <TableContainer component={Paper} variant="outlined" sx={{ mt: { xs: 1, md: 0 }, px: { md: 1 }, pt: { md: 1 } }}>
                    <Table size="small" aria-label="Записи на чергування" sx={{ display: { xs: 'none', md: 'table' }, borderCollapse: 'separate', borderSpacing: '0 3px' }}>
                        <TableHead>
                            <TableRow>
                                <TableCell>№</TableCell>
                                <TableCell>Дата</TableCell>
                                <TableCell>Час</TableCell>
                                <TableCell>Локація</TableCell>
                                <TableCell>Імʼя</TableCell>
                                <TableCell>Телефон</TableCell>
                                <TableCell align="center">Дії</TableCell>
                            </TableRow>
                        </TableHead>
                        {cardGroups.map((group, groupIndex) => <Fragment key={group[0].id}>
                            {groupIndex > 0 && <TableBody aria-hidden="true">
                                <TableRow><TableCell colSpan={7} sx={{ p: 0, height: 10, border: 0 }} /></TableRow>
                            </TableBody>}
                            <TableBody sx={{
                                borderRadius: 1,
                                boxShadow: surfaceShadow,
                                '& .MuiTableCell-root': { bgcolor: 'background.paper', borderBottom: 0 },
                                '& .MuiTableRow-root:hover > .MuiTableCell-root': { bgcolor: 'action.hover' },
                                '& > tr:first-of-type > td:first-of-type': { borderTopLeftRadius: `${surfaceRadius}px` },
                                '& > tr:first-of-type > td:last-of-type': { borderTopRightRadius: `${surfaceRadius}px` },
                                '& > tr:last-of-type > td:first-of-type': { borderBottomLeftRadius: `${surfaceRadius}px` },
                                '& > tr:last-of-type > td:last-of-type': { borderBottomRightRadius: `${surfaceRadius}px` },
                            }}>
                            {group.map((b) => (
                                <TableRow key={b.id} hover>
                                    <TableCell>{b.publicNumber}</TableCell>
                                    <TableCell>{formatDate(b.date)}</TableCell>
                                    <TableCell>{b.startTime}–{b.endTime}</TableCell>
                                    <TableCell>{b.locationName}</TableCell>
                                    <TableCell>{[b.firstName, b.lastName].filter(Boolean).join(' ')}</TableCell>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{b.phone ? formatUaPhone(b.phone) : '—'}</TableCell>
                                    <TableCell align="center">
                                        <IconButton
                                            id={`booking-table-actions-${b.id}`}
                                            aria-label={`Дії для запису ${b.publicNumber}`}
                                            aria-haspopup="menu"
                                            aria-controls={actionMenu?.booking.id === b.id ? 'booking-actions-menu' : undefined}
                                            aria-expanded={actionMenu?.booking.id === b.id ? true : undefined}
                                            onClick={(event) => setActionMenu({ anchorEl: event.currentTarget, booking: b })}
                                            sx={{ width: 44, height: 44 }}
                                        >
                                            <MoreVertIcon />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                            </TableBody>
                        </Fragment>)}
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
                        sx={{ pt: { md: 1 }, '& .MuiTablePagination-toolbar': { px: { xs: 0, sm: 2 } }, '& .MuiTablePagination-selectLabel': { display: { xs: 'none', sm: 'block' } }, '& .MuiTablePagination-spacer': { display: { xs: 'none', sm: 'block' } } }}
                    />
                </TableContainer>
                </>
            )}

            <AppDialog
                open={!!detail}
                onClose={() => setDetail(null)}
                title="Деталі запису"
                icon={<InfoOutlinedIcon color="primary" />}
                actions={<Stack direction="row" spacing={1} sx={{ width: '100%', '& > .MuiButton-root': { flex: '1 1 0', minWidth: 0 } }}>
                    <Button variant="outlined" fullWidth onClick={() => setDetail(null)}>Закрити</Button>
                    {detail?.isBooked && <Button variant="outlined" fullWidth color="error" onClick={() => requestCancel(detail)}>Скасувати запис</Button>}
                </Stack>}
            >
                {detail && <Stack spacing={1.5} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <BookingDetails booking={detail} />
                    {detail.comment && <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Коментар</Typography>
                        <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{detail.comment}</Typography>
                    </Box>}
                    <Box sx={{ pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Створено</Typography>
                        <Typography component="time" dateTime={detail.createdAtUtc} variant="body2" color="text.secondary">
                            {formatDateTime(detail.createdAtUtc)}
                        </Typography>
                    </Box>
                </Stack>}
            </AppDialog>
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
    return <Box>
        <Typography component="p" variant="h6" sx={{ mb: 2, fontSize: '1.25rem', fontWeight: 700, overflowWrap: 'anywhere' }}>
            {[booking.firstName, booking.lastName].filter(Boolean).join(' ') || 'Без імені'}
        </Typography>
        <Box component="dl" sx={{
            m: 0, display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr)', columnGap: 1.5, rowGap: 1.5,
            '& dt': { color: 'text.secondary', fontSize: '0.875rem', pt: 0.25 },
            '& dd': { m: 0, minWidth: 0, overflowWrap: 'anywhere' },
        }}>
            <Typography component="dt">Дата</Typography>
            <Typography component="dd" sx={{ fontWeight: 500, lineHeight: 1.5 }}>{formatDate(booking.date)}</Typography>
            <Typography component="dt">Час</Typography>
            <Typography component="dd" sx={{ fontSize: '1.125rem', fontWeight: 700, color: 'primary.dark', fontVariantNumeric: 'tabular-nums' }}>
                {booking.startTime}–{booking.endTime}
            </Typography>
            <Typography component="dt">Локація</Typography>
            <Typography component="dd" sx={{ fontWeight: 500 }}>{booking.locationName}</Typography>
            {booking.phone && <>
                <Typography component="dt">Телефон</Typography>
                <Box component="dd">
                    <Link href={`tel:${booking.phone}`} sx={{ fontWeight: 600, textUnderlineOffset: '3px' }}>{formatUaPhone(booking.phone)}</Link>
                </Box>
            </>}
        </Box>
    </Box>;
}
