import { useEffect, useState } from 'react';
import {
    Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
    IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
    TablePagination, TableRow, TextField, Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import { adminApi, type BookingFilters } from '../../api/adminApi';
import { downloadFile, ApiError } from '../../api/client';
import { LoadingState, ErrorState, EmptyState } from '../../components/StateMessage';
import type { BookingAdminDto, LocationAdminDto, TimeSlotAdminDto } from '../../api/types';

const STATUS_OPTIONS = [
    { value: '', label: 'Усі статуси' },
    { value: 'Held', label: 'Утримується' },
    { value: 'Confirmed', label: 'Підтверджено' },
    { value: 'Cancelled', label: 'Скасовано' },
];

export default function AdminBookingsPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [items, setItems] = useState<BookingAdminDto[]>([]);
    const [total, setTotal] = useState(0);
    const [locations, setLocations] = useState<LocationAdminDto[]>([]);
    const [timeSlots, setTimeSlots] = useState<TimeSlotAdminDto[]>([]);

    const [date, setDate] = useState('');
    const [locationId, setLocationId] = useState<number | ''>('');
    const [timeSlotId, setTimeSlotId] = useState<number | ''>('');
    const [phone, setPhone] = useState('');
    const [status, setStatus] = useState('');
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(25);

    const [cancelTarget, setCancelTarget] = useState<BookingAdminDto | null>(null);
    const [cancelling, setCancelling] = useState(false);

    const buildFilters = (): BookingFilters => ({
        date: date || undefined,
        locationId: locationId || undefined,
        timeSlotId: timeSlotId || undefined,
        phone: phone || undefined,
        status: status || undefined,
        page: page + 1,
        pageSize,
    });

    const load = () => {
        setLoading(true);
        setError(null);
        adminApi.listBookings(buildFilters())
            .then((res) => { setItems(res.items); setTotal(res.totalCount); })
            .catch((e) => setError(e instanceof ApiError ? e.message : 'Не вдалося завантажити записи.'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        Promise.all([adminApi.listLocations(), adminApi.listTimeSlots()])
            .then(([locs, slots]) => { setLocations(locs); setTimeSlots(slots); });
    }, []);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(load, [page, pageSize]);

    const applyFilters = () => { setPage(0); load(); };

    const doCancel = () => {
        if (!cancelTarget) return;
        setCancelling(true);
        adminApi.cancelBooking(cancelTarget.id)
            .then(() => { setCancelTarget(null); load(); })
            .catch((e) => setError(e instanceof ApiError ? e.message : 'Не вдалося скасувати запис.'))
            .finally(() => setCancelling(false));
    };

    const exportCsv = () => {
        downloadFile(adminApi.exportCsvUrl(buildFilters()), 'bookings.csv').catch(() =>
            setError('Не вдалося завантажити CSV.'));
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="h4">Записи</Typography>
                <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv}>Експорт CSV</Button>
            </Box>

            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Stack spacing={2} direction="row" sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
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
                    <TextField label="Статус" select value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 160 }} size="small">
                        {STATUS_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                    </TextField>
                    <Button variant="contained" startIcon={<RefreshIcon />} onClick={applyFilters}>Застосувати</Button>
                </Stack>
            </Paper>

            {error && <Box sx={{ mb: 2 }}><ErrorState message={error} onRetry={load} /></Box>}
            {loading && <LoadingState />}

            {!loading && items.length === 0 && <EmptyState message="Записів не знайдено." />}

            {!loading && items.length > 0 && (
                <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>№</TableCell>
                                <TableCell>Дата</TableCell>
                                <TableCell>Час</TableCell>
                                <TableCell>Локація</TableCell>
                                <TableCell>Імʼя</TableCell>
                                <TableCell>Телефон</TableCell>
                                <TableCell>Статус</TableCell>
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
                                        <Chip size="small" label={statusLabel(b.status)} color={statusColor(b.status)} />
                                    </TableCell>
                                    <TableCell align="center">
                                        {b.status !== 'Cancelled' && (
                                            <IconButton size="small" onClick={() => setCancelTarget(b)}>
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
                        labelRowsPerPage="Рядків на сторінці:"
                    />
                </TableContainer>
            )}

            <Dialog open={!!cancelTarget} onClose={() => setCancelTarget(null)}>
                <DialogTitle>Скасувати запис?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Запис {cancelTarget?.publicNumber} ({[cancelTarget?.firstName, cancelTarget?.lastName].filter(Boolean).join(' ')}) буде скасовано.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCancelTarget(null)}>Ні</Button>
                    <Button color="error" variant="contained" disabled={cancelling} onClick={doCancel}>
                        {cancelling ? 'Скасовуємо…' : 'Скасувати'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
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
