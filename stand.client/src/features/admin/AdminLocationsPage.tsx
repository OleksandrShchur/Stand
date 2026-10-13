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
import type { LocationAdminDto } from '../../api/types';

type FormState = { name: string; address: string; capacity: number; sortOrder: number; isActive: boolean };
const emptyForm: FormState = { name: '', address: '', capacity: 3, sortOrder: 0, isActive: true };

export default function AdminLocationsPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [items, setItems] = useState<LocationAdminDto[]>([]);
    const [editing, setEditing] = useState<LocationAdminDto | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const load = () => {
        setLoading(true);
        setError(null);
        adminApi.listLocations().then(setItems)
            .catch((e) => setError(e instanceof ApiError ? e.message : 'Не вдалося завантажити локації.'))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const openCreate = () => { setEditing(null); setForm(emptyForm); setFormError(null); setDialogOpen(true); };
    const openEdit = (loc: LocationAdminDto) => {
        setEditing(loc);
        setForm({ name: loc.name, address: loc.address ?? '', capacity: loc.capacity, sortOrder: loc.sortOrder, isActive: loc.isActive });
        setFormError(null);
        setDialogOpen(true);
    };

    const save = () => {
        setSaving(true);
        setFormError(null);
        const dto = { name: form.name, address: form.address || null, capacity: form.capacity, sortOrder: form.sortOrder, isActive: form.isActive };
        const promise = editing ? adminApi.updateLocation(editing.id, dto) : adminApi.createLocation(dto);
        promise
            .then(() => { setDialogOpen(false); load(); })
            .catch((e) => setFormError(e instanceof ApiError ? e.message : 'Не вдалося зберегти.'))
            .finally(() => setSaving(false));
    };

    const toggleActive = (loc: LocationAdminDto) => {
        const action = loc.isActive ? adminApi.deactivateLocation(loc.id) : adminApi.activateLocation(loc.id);
        action.then(load).catch((e) => setError(e instanceof ApiError ? e.message : 'Не вдалося оновити статус.'));
    };

    if (loading) return <LoadingState />;

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4">Локації</Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Додати</Button>
            </Box>

            {error && <Box sx={{ mb: 2 }}><ErrorState message={error} onRetry={load} /></Box>}

            <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Назва</TableCell>
                            <TableCell>Адреса</TableCell>
                            <TableCell align="center">Місткість</TableCell>
                            <TableCell align="center">Порядок</TableCell>
                            <TableCell align="center">Активна</TableCell>
                            <TableCell align="center">Дії</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {items.map((loc) => (
                            <TableRow key={loc.id} hover>
                                <TableCell sx={{ fontWeight: 600 }}>{loc.name}</TableCell>
                                <TableCell>{loc.address}</TableCell>
                                <TableCell align="center">{loc.capacity}</TableCell>
                                <TableCell align="center">{loc.sortOrder}</TableCell>
                                <TableCell align="center">
                                    <Switch checked={loc.isActive} onChange={() => toggleActive(loc)} size="small" />
                                </TableCell>
                                <TableCell align="center">
                                    <IconButton size="small" onClick={() => openEdit(loc)}><EditIcon fontSize="small" /></IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>{editing ? 'Редагувати локацію' : 'Нова локація'}</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                    <TextField label="Назва" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth autoFocus />
                    <TextField label="Адреса / підзаголовок" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} fullWidth />
                    <TextField
                        label="Місткість на слот"
                        type="number"
                        value={form.capacity}
                        onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                        fullWidth
                        slotProps={{ htmlInput: { min: 1 } }}
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
                        label="Активна"
                    />
                    {formError && <ErrorState message={formError} />}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Скасувати</Button>
                    <Button variant="contained" disabled={saving || !form.name} onClick={save}>
                        {saving ? 'Зберігаємо…' : 'Зберегти'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
