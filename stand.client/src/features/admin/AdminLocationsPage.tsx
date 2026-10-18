import { useEffect, useState } from 'react';
import {
    Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Fab, FormControlLabel, IconButton, Stack,
    ListItemIcon, ListItemText, Menu, MenuItem, Paper, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
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
    const [actionMenu, setActionMenu] = useState<{ anchor: HTMLElement; location: LocationAdminDto } | null>(null);
    const [deleteLocation, setDeleteLocation] = useState<LocationAdminDto | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);

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

    const remove = () => {
        if (!deleteLocation || saving) return;
        setSaving(true);
        setDeleteError(null);
        adminApi.deleteLocation(deleteLocation.id)
            .then(() => { setDeleteLocation(null); load(); })
            .catch(e => setDeleteError(e instanceof ApiError ? e.message : 'Не вдалося видалити локацію. Спробуйте ще раз.'))
            .finally(() => setSaving(false));
    };

    const actionsButton = (loc: LocationAdminDto) => <IconButton aria-label={`Дії локації ${loc.name}`} aria-haspopup="menu"
        aria-controls={actionMenu?.location.id === loc.id ? 'location-actions-menu' : undefined}
        aria-expanded={actionMenu?.location.id === loc.id ? true : undefined}
        disabled={saving || updatingId !== null}
        onClick={event => setActionMenu({ anchor: event.currentTarget, location: loc })}
        sx={{ width: 44, height: 44, flexShrink: 0 }}><MoreVertIcon /></IconButton>;

    if (loading) return <LoadingState />;

    return (
        <Box sx={{ pb: 9 }}>
            <Typography component="h1" variant="h4" sx={(theme) => ({
                mb: 2,
                [theme.breakpoints.down('sm')]: {
                    position: 'absolute', width: '1px', height: '1px', p: 0, m: '-1px',
                    overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap', border: 0,
                },
            })}>Локації</Typography>

            {error && <Box sx={{ mb: 2 }}><ErrorState message={error} onRetry={load} /></Box>}

            <Stack spacing={1} sx={{ display: { xs: 'flex', md: 'none' } }}>
                {items.map(loc => <Card key={loc.id} variant="outlined"><CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                        <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                <Typography component="h2" variant="h6" sx={{ minWidth: 0 }}>{loc.name}</Typography>
                                <Chip size="small" label={loc.isActive ? 'Активна' : 'Неактивна'} color={loc.isActive ? 'success' : 'default'} sx={{ flexShrink: 0 }} />
                            </Stack>
                            {loc.address && <Typography variant="body2" color="text.secondary">{loc.address}</Typography>}
                        </Box>
                        {actionsButton(loc)}
                    </Stack>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>Місць на інтервал: {loc.capacity}</Typography>
                </CardContent></Card>)}
            </Stack>

            <TableContainer component={Paper} variant="outlined" sx={{ display: { xs: 'none', md: 'block' } }}>
                <Table size="small" aria-label="Локації">
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
                                    <Switch slotProps={{ input: { 'aria-label': `Активна локація: ${loc.name}` } }} aria-busy={updatingId === loc.id} disabled={updatingId !== null} checked={loc.isActive} onChange={() => toggleActive(loc)} size="small" />
                                </TableCell>
                                <TableCell align="center">
                                    {actionsButton(loc)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Fab color="primary" aria-label="Додати локацію" title="Додати локацію" onClick={openCreate}
                sx={{
                    position: 'fixed',
                    right: { xs: 'max(16px, env(safe-area-inset-right, 0px))', sm: 24 },
                    bottom: 'calc(var(--admin-navigation-clearance, 12px) + 8px)',
                    zIndex: (theme) => theme.zIndex.appBar - 1,
                    borderRadius: 1,
                }}>
                <AddIcon />
            </Fab>

            <Menu id="location-actions-menu" anchorEl={actionMenu?.anchor} open={Boolean(actionMenu)} onClose={() => setActionMenu(null)}
                slotProps={{ paper: { sx: { minWidth: 180 } } }} sx={{ '& .MuiMenuItem-root': { minHeight: 48 } }}>
                <MenuItem onClick={() => {
                    if (actionMenu) openEdit(actionMenu.location);
                    setActionMenu(null);
                }}>
                    <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon><ListItemText>Редагувати</ListItemText>
                </MenuItem>
                <MenuItem sx={{ color: 'error.main' }} onClick={() => {
                    if (actionMenu) { setDeleteLocation(actionMenu.location); setDeleteError(null); }
                    setActionMenu(null);
                }}>
                    <ListItemIcon sx={{ color: 'inherit' }}><DeleteOutlineIcon fontSize="small" /></ListItemIcon><ListItemText>Видалити</ListItemText>
                </MenuItem>
            </Menu>

            <Dialog open={Boolean(deleteLocation)} onClose={() => { if (!saving) setDeleteLocation(null); }} fullWidth maxWidth="xs"
                aria-labelledby="delete-location-title" aria-describedby="delete-location-description">
                <DialogTitle id="delete-location-title">Видалити локацію?</DialogTitle>
                <DialogContent>
                    <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{deleteLocation?.name}</Typography>
                    {deleteLocation?.address && <Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{deleteLocation.address}</Typography>}
                    <Typography id="delete-location-description" sx={{ mt: 2 }}>Локацію та її час у розкладі на всіх датах буде видалено. Цю дію неможливо скасувати.</Typography>
                    <Alert severity="warning" sx={{ mt: 2 }}>Локацію з наявними чи скасованими записами видалити не можна. Щоб закрити нові записи, вимкніть її через «Редагувати».</Alert>
                    {deleteError && <Box sx={{ mt: 2 }}><ErrorState message={deleteError} /></Box>}
                </DialogContent>
                <DialogActions>
                    <Button autoFocus disabled={saving} onClick={() => setDeleteLocation(null)}>Скасувати</Button>
                    <Button loading={saving} disabled={saving} color="error" variant="contained" onClick={remove}>Видалити</Button>
                </DialogActions>
            </Dialog>

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
