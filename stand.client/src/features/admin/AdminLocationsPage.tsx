import { useEffect, useState } from 'react';
import {
    Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, Stack,
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
    const [updatingId, setUpdatingId] = useState<number | null>(null);
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
        if (updatingId !== null) return;
        setUpdatingId(loc.id);
        const action = loc.isActive ? adminApi.deactivateLocation(loc.id) : adminApi.activateLocation(loc.id);
        action.then(load).catch((e) => setError(e instanceof ApiError ? e.message : 'Не вдалося оновити статус.')).finally(() => setUpdatingId(null));
    };

    if (loading) return <LoadingState />;

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                <Typography variant="h4">Локації</Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Додати</Button>
            </Box>

            {error && <Box sx={{ mb: 2 }}><ErrorState message={error} onRetry={load} /></Box>}

            <Alert severity="info" sx={{ mb: 2 }}>Тут зберігаються назви, адреси та місткість. Дати й час кожної локації налаштовуються у «Розкладі». Вимкнення локації закриває нові записи на всіх датах; наявні записи залишаються чинними.</Alert>
            <Stack spacing={2} sx={{ display: { xs: 'flex', md: 'none' } }}>
                {items.map(loc => <Card key={loc.id} variant="outlined"><CardContent>
                    <Typography variant="h6">{loc.name}</Typography>
                    <Typography color="text.secondary">{loc.address}</Typography>
                    <Typography sx={{ mt: 1, mb: 1 }}>{loc.capacity} місць на інтервал</Typography>
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                        <Chip size="small" label={loc.isActive ? 'Активна' : 'Неактивна'} color={loc.isActive ? 'success' : 'default'} />
                        <Button variant="outlined" startIcon={<EditIcon />} onClick={() => openEdit(loc)}>Редагувати</Button>
                    </Stack>
                </CardContent></Card>)}
            </Stack>

            <TableContainer component={Paper} variant="outlined" sx={{ display: { xs: 'none', md: 'block' } }}>
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
                                    <Switch aria-busy={updatingId === loc.id} disabled={updatingId !== null} checked={loc.isActive} onChange={() => toggleActive(loc)} size="small" />
                                </TableCell>
                                <TableCell align="center">
                                    <IconButton aria-label={`Редагувати ${loc.name}`} onClick={() => openEdit(loc)}><EditIcon fontSize="small" /></IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={dialogOpen} onClose={() => { if (!saving) setDialogOpen(false); }} fullWidth maxWidth="sm">
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
                    {editing && <Alert severity="warning">Зміна назви чи місткості стосується всіх дат. Вимкнення закриє нові записи на цю локацію. Наявні записи залишаться чинними.</Alert>}
                    {formError && <ErrorState message={formError} />}
                </DialogContent>
                <DialogActions>
                    <Button disabled={saving} onClick={() => setDialogOpen(false)}>Скасувати</Button>
                    <Button loading={saving} variant="contained" disabled={saving || !form.name} onClick={save}>
                        {saving ? 'Зберігаємо…' : 'Зберегти'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
