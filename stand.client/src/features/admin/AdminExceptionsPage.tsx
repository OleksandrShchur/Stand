import { useEffect, useState } from 'react';
import {
    Box, Button, Card, CardContent, FormControlLabel, IconButton, MenuItem, Paper, Stack,
    Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import { adminApi } from '../../api/adminApi';
import { ApiError } from '../../api/client';
import { LoadingState, ErrorState, EmptyState } from '../../components/StateMessage';
import type { DateTimeSlotExceptionAdminDto, TimeSlotAdminDto } from '../../api/types';
import { todayIso } from '../../utils/date';

export default function AdminExceptionsPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [items, setItems] = useState<DateTimeSlotExceptionAdminDto[]>([]);
    const [timeSlots, setTimeSlots] = useState<TimeSlotAdminDto[]>([]);

    const [date, setDate] = useState(todayIso());
    const [timeSlotId, setTimeSlotId] = useState<number | ''>('');
    const [isBlocked, setIsBlocked] = useState(true);
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const load = () => {
        setLoading(true);
        setError(null);
        Promise.all([adminApi.listExceptions(), adminApi.listTimeSlots()])
            .then(([exc, slots]) => { setItems(exc); setTimeSlots(slots); })
            .catch((e) => setError(e instanceof ApiError ? e.message : 'Не вдалося завантажити винятки.'))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const addException = () => {
        if (!timeSlotId) { setFormError('Оберіть час.'); return; }
        setSaving(true);
        setFormError(null);
        adminApi.upsertException(date, timeSlotId, isBlocked, note || undefined)
            .then(() => { setNote(''); load(); })
            .catch((e) => setFormError(e instanceof ApiError ? e.message : 'Не вдалося зберегти.'))
            .finally(() => setSaving(false));
    };

    const removeException = (id: number) => {
        adminApi.deleteException(id).then(load).catch((e) => setError(e instanceof ApiError ? e.message : 'Не вдалося видалити.'));
    };

    if (loading) return <LoadingState />;

    return (
        <Box>
            <Typography variant="h4" sx={{ mb: 2 }}>Винятки за датою</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Дозволяють вимкнути конкретний час чергування для окремої дати (наприклад, через свято), без зміни глобального списку часу.
            </Typography>

            <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>Додати виняток</Typography>
                    <Stack spacing={2} direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: { sm: 'flex-start' } }}>
                        <TextField
                            label="Дата" type="date" value={date} onChange={(e) => setDate(e.target.value)}
                            slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 160 }}
                        />
                        <TextField
                            label="Час" select value={timeSlotId} onChange={(e) => setTimeSlotId(Number(e.target.value))}
                            sx={{ minWidth: 160 }}
                        >
                            {timeSlots.map((s) => (
                                <MenuItem key={s.id} value={s.id}>{s.startTime}–{s.endTime}</MenuItem>
                            ))}
                        </TextField>
                        <TextField label="Примітка" value={note} onChange={(e) => setNote(e.target.value)} sx={{ flex: 1, minWidth: 160 }} />
                        <FormControlLabel
                            control={<Switch checked={isBlocked} onChange={(e) => setIsBlocked(e.target.checked)} />}
                            label="Заблокувати"
                            sx={{ whiteSpace: 'nowrap' }}
                        />
                        <Button variant="contained" disabled={saving} onClick={addException} sx={{ height: 56 }}>
                            Додати
                        </Button>
                    </Stack>
                    {formError && <Box sx={{ mt: 2 }}><ErrorState message={formError} /></Box>}
                </CardContent>
            </Card>

            {error && <Box sx={{ mb: 2 }}><ErrorState message={error} onRetry={load} /></Box>}

            {items.length === 0 ? (
                <EmptyState message="Винятків немає." />
            ) : (
                <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Дата</TableCell>
                                <TableCell>Час</TableCell>
                                <TableCell>Статус</TableCell>
                                <TableCell>Примітка</TableCell>
                                <TableCell align="center">Дії</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {items.map((item) => (
                                <TableRow key={item.id} hover>
                                    <TableCell>{item.date}</TableCell>
                                    <TableCell>{item.startTime}–{item.endTime}</TableCell>
                                    <TableCell>{item.isBlocked ? 'Заблоковано' : 'Дозволено'}</TableCell>
                                    <TableCell>{item.note}</TableCell>
                                    <TableCell align="center">
                                        <IconButton size="small" onClick={() => removeException(item.id)}>
                                            <DeleteOutlineIcon fontSize="small" />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Box>
    );
}
