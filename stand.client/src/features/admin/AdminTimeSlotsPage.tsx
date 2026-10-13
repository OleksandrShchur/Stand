import { useEffect, useState } from 'react';
import {
    Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton,
    Paper, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { adminApi } from '../../api/adminApi';
import { ApiError } from '../../api/client';
import { LoadingState, ErrorState } from '../../components/StateMessage';
import type { TimeSlotAdminDto } from '../../api/types';

type FormState = { startTime: string; endTime: string; sortOrder: number; isActive: boolean };
const emptyForm: FormState = { startTime: '09:00', endTime: '11:00', sortOrder: 0, isActive: true };

export default function AdminTimeSlotsPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [items, setItems] = useState<TimeSlotAdminDto[]>([]);
    const [editing, setEditing] = useState<TimeSlotAdminDto | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const load = () => {
        setLoading(true);
        setError(null);
        adminApi.listTimeSlots().then(setItems)
            .catch((e) => setError(e instanceof ApiError ? e.message : 'Не вдалося завантажити час.'))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const openCreate = () => { setEditing(null); setForm(emptyForm); setFormError(null); setDialogOpen(true); };
    const openEdit = (slot: TimeSlotAdminDto) => {
        setEditing(slot);
        setForm({ startTime: slot.startTime, endTime: slot.endTime, sortOrder: slot.sortOrder, isActive: slot.isActive });
        setFormError(null);
        setDialogOpen(true);
    };

    const save = () => {
        setSaving(true);
        setFormError(null);
        const promise = editing ? adminApi.updateTimeSlot(editing.id, form) : adminApi.createTimeSlot(form);
        promise
            .then(() => { setDialogOpen(false); load(); })
            .catch((e) => setFormError(e instanceof ApiError ? e.message : 'Не вдалося зберегти.'))
            .finally(() => setSaving(false));
    };

    const toggleActive = (slot: TimeSlotAdminDto) => {
        const action = slot.isActive ? adminApi.deactivateTimeSlot(slot.id) : adminApi.activateTimeSlot(slot.id);
        action.then(load).catch((e) => setError(e instanceof ApiError ? e.message : 'Не вдалося оновити статус.'));
    };

    if (loading) return <LoadingState />;

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4">Часові інтервали</Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Додати</Button>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Глобальний список часу чергування (однаковий для всіх локацій і дат). Для окремих дат можна додати винятки в розділі «Винятки за датою».
            </Typography>

            {error && <Box sx={{ mb: 2 }}><ErrorState message={error} onRetry={load} /></Box>}

            <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Початок</TableCell>
                            <TableCell>Кінець</TableCell>
                            <TableCell align="center">Порядок</TableCell>
                            <TableCell align="center">Активний</TableCell>
                            <TableCell align="center">Дії</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {items.map((slot) => (
                            <TableRow key={slot.id} hover>
                                <TableCell sx={{ fontWeight: 600 }}>{slot.startTime}</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>{slot.endTime}</TableCell>
                                <TableCell align="center">{slot.sortOrder}</TableCell>
                                <TableCell align="center">
                                    <Switch checked={slot.isActive} onChange={() => toggleActive(slot)} size="small" />
                                </TableCell>
                                <TableCell align="center">
                                    <IconButton size="small" onClick={() => openEdit(slot)}><EditIcon fontSize="small" /></IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>{editing ? 'Редагувати час' : 'Новий час'}</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                    <TextField
                        label="Початок"
                        type="time"
                        value={form.startTime}
                        onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                        fullWidth
                        slotProps={{ inputLabel: { shrink: true } }}
                    />
                    <TextField
                        label="Кінець"
                        type="time"
                        value={form.endTime}
                        onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                        fullWidth
                        slotProps={{ inputLabel: { shrink: true } }}
                    />
                    <TextField
                        label="Порядок сортування"
                        type="number"
                        value={form.sortOrder}
                        onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                        fullWidth
                    />
                    <FormControlLabel
                        control={<Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />}
                        label="Активний"
                    />
                    {formError && <ErrorState message={formError} />}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Скасувати</Button>
                    <Button variant="contained" disabled={saving} onClick={save}>
                        {saving ? 'Зберігаємо…' : 'Зберегти'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
