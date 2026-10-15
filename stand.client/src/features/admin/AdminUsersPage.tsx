import { useEffect, useState } from 'react';
import {
    Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton,
    Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import { adminApi } from '../../api/adminApi';
import { ApiError } from '../../api/client';
import { useAdminAuth } from './AdminAuthContext';
import { LoadingState, ErrorState } from '../../components/StateMessage';
import type { AdminUserDto } from '../../api/types';

export default function AdminUsersPage() {
    const { user: currentUser } = useAdminAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [items, setItems] = useState<AdminUserDto[]>([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [saving, setSaving] = useState(false);
    const [updatingId, setUpdatingId] = useState<number | null>(null);
    const [formError, setFormError] = useState<string | null>(null);

    const load = () => {
        setLoading(true);
        setError(null);
        adminApi.listUsers().then(setItems)
            .catch((e) => setError(e instanceof ApiError ? e.message : 'Не вдалося завантажити адміністраторів.'))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const openCreate = () => { setLogin(''); setPassword(''); setFormError(null); setDialogOpen(true); };

    const create = () => {
        setSaving(true);
        setFormError(null);
        adminApi.createUser(login, password)
            .then(() => { setDialogOpen(false); load(); })
            .catch((e) => setFormError(e instanceof ApiError ? e.message : 'Не вдалося створити.'))
            .finally(() => setSaving(false));
    };

    const toggle = (u: AdminUserDto) => {
        if (updatingId !== null) return;
        setUpdatingId(u.id);
        const action = u.isActive ? adminApi.disableUser(u.id) : adminApi.enableUser(u.id);
        action.then(load).catch((e) => setError(e instanceof ApiError ? e.message : 'Не вдалося оновити статус.')).finally(() => setUpdatingId(null));
    };

    if (loading) return <LoadingState />;

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4">Адміністратори</Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Додати</Button>
            </Box>

            {error && <Box sx={{ mb: 2 }}><ErrorState message={error} onRetry={load} /></Box>}

            <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Логін</TableCell>
                            <TableCell>Статус</TableCell>
                            <TableCell>Останній вхід</TableCell>
                            <TableCell align="center">Дії</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {items.map((u) => (
                            <TableRow key={u.id} hover>
                                <TableCell sx={{ fontWeight: 600 }}>
                                    {u.login} {u.id === currentUser?.id && <Chip size="small" label="Ви" sx={{ ml: 1 }} />}
                                </TableCell>
                                <TableCell>
                                    <Chip size="small" label={u.isActive ? 'Активний' : 'Вимкнений'} color={u.isActive ? 'success' : 'default'} />
                                </TableCell>
                                <TableCell>{u.lastLoginAtUtc ? new Date(u.lastLoginAtUtc).toLocaleString('uk-UA') : '—'}</TableCell>
                                <TableCell align="center">
                                    {u.id !== currentUser?.id && (
                                        <IconButton aria-busy={updatingId === u.id} disabled={updatingId !== null} size="small" onClick={() => toggle(u)}>
                                            {u.isActive ? <BlockIcon fontSize="small" /> : <CheckCircleOutlineIcon fontSize="small" />}
                                        </IconButton>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={dialogOpen} onClose={() => { if (!saving) setDialogOpen(false); }} fullWidth maxWidth="xs">
                <DialogTitle>Новий адміністратор</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                    <TextField label="Логін" value={login} onChange={(e) => setLogin(e.target.value)} fullWidth autoFocus />
                    <TextField label="Пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth
                        helperText="Щонайменше 8 символів" />
                    {formError && <ErrorState message={formError} />}
                </DialogContent>
                <DialogActions>
                    <Button disabled={saving} onClick={() => setDialogOpen(false)}>Скасувати</Button>
                    <Button loading={saving} variant="contained" disabled={saving || !login || !password} onClick={create}>
                        {saving ? 'Створюємо…' : 'Створити'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
