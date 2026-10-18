import { useEffect, useState } from 'react';
import {
    Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack,
    ListItemIcon, ListItemText, Menu, MenuItem,
    Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import LockResetIcon from '@mui/icons-material/LockReset';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import { adminApi } from '../../api/adminApi';
import { ApiError } from '../../api/client';
import { useAdminAuth } from './AdminAuthContext';
import { LoadingState, ErrorState } from '../../components/StateMessage';
import type { AdminUserDto } from '../../api/types';
import { formatDateTime } from '../../utils/date';
import ConfirmDeleteDialog from '../../components/ConfirmDeleteDialog';

export default function AdminUsersPage() {
    const { user: currentUser } = useAdminAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [items, setItems] = useState<AdminUserDto[]>([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [menu, setMenu] = useState<{ anchor: HTMLElement; user: AdminUserDto } | null>(null);
    const [passwordTarget, setPasswordTarget] = useState<AdminUserDto | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordTouched, setPasswordTouched] = useState(false);
    const [confirmTouched, setConfirmTouched] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<AdminUserDto | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [notice, setNotice] = useState('');

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

    const changePassword = async () => {
        if (!passwordTarget || changingPassword) return;
        setPasswordTouched(true); setConfirmTouched(true);
        if (newPassword.length < 8 || !confirmPassword || newPassword !== confirmPassword) return;
        setChangingPassword(true); setPasswordError('');
        try {
            await adminApi.changeUserPassword(passwordTarget.id, newPassword, confirmPassword);
            setNotice(`Пароль адміністратора ${passwordTarget.login} змінено.`);
            setPasswordTarget(null); setNewPassword(''); setConfirmPassword('');
        } catch (e) { setPasswordError(e instanceof ApiError ? e.message : 'Не вдалося змінити пароль. Спробуйте ще раз.'); }
        finally { setChangingPassword(false); }
    };

    const remove = async () => {
        if (!deleteTarget || deleting) return;
        setDeleting(true); setDeleteError('');
        try {
            await adminApi.deleteUser(deleteTarget.id);
            setItems(previous => previous.filter(user => user.id !== deleteTarget.id));
            setNotice(`Адміністратора ${deleteTarget.login} видалено.`); setDeleteTarget(null);
        } catch (e) { setDeleteError(e instanceof ApiError ? e.message : 'Не вдалося видалити адміністратора. Спробуйте ще раз.'); }
        finally { setDeleting(false); }
    };

    const actions = (u: AdminUserDto, view: string) => <IconButton id={`admin-actions-${view}-${u.id}`}
        aria-label={`Дії адміністратора ${u.login}`} aria-haspopup="menu" aria-controls={menu?.user.id === u.id ? 'admin-user-menu' : undefined}
        aria-expanded={menu?.user.id === u.id ? true : undefined} disabled={deleting || changingPassword}
        onClick={event => setMenu({ anchor: event.currentTarget, user: u })} sx={{ flexShrink: 0, width: 44, height: 44 }}>
        <MoreVertIcon />
    </IconButton>;

    if (loading) return <LoadingState />;

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                <Typography component="h1" variant="h4">Адміністратори</Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Додати</Button>
            </Box>

            {error && <Box sx={{ mb: 2 }}><ErrorState message={error} onRetry={load} /></Box>}
            {notice && <Alert severity="success" onClose={() => setNotice('')} sx={{ mb: 2 }}>{notice}</Alert>}

            <Stack spacing={2} sx={{ display: { xs: 'flex', md: 'none' } }}>
                {items.map(u => <Card key={u.id} variant="outlined"><CardContent>
                    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography component="h2" variant="h6" sx={{ overflowWrap: 'anywhere' }}>{u.login}{u.id === currentUser?.id ? ' · Ви' : ''}</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Останній вхід: {u.lastLoginAtUtc ? formatDateTime(u.lastLoginAtUtc) : 'Ще не входив'}</Typography>
                        </Box>
                        {actions(u, 'mobile')}
                    </Stack>
                </CardContent></Card>)}
            </Stack>
            <TableContainer component={Paper} variant="outlined" sx={{ display: { xs: 'none', md: 'block' } }}>
                <Table size="small" aria-label="Адміністратори">
                    <TableHead>
                        <TableRow>
                            <TableCell>Логін</TableCell>
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
                                <TableCell>{u.lastLoginAtUtc ? formatDateTime(u.lastLoginAtUtc) : '—'}</TableCell>
                                <TableCell align="center">
                                    {actions(u, 'desktop')}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Menu id="admin-user-menu" anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)}
                slotProps={{ list: { 'aria-labelledby': menu?.anchor.id } }}>
                <MenuItem onClick={() => {
                    if (!menu) return;
                    setPasswordTarget(menu.user); setNewPassword(''); setConfirmPassword('');
                    setPasswordTouched(false); setConfirmTouched(false); setPasswordError(''); setMenu(null);
                }}>
                    <ListItemIcon><LockResetIcon fontSize="small" /></ListItemIcon><ListItemText>Змінити пароль</ListItemText>
                </MenuItem>
                {menu && menu.user.id !== currentUser?.id && <MenuItem sx={{ color: 'error.main' }} onClick={() => {
                    setDeleteTarget(menu.user); setDeleteError(''); setMenu(null);
                }}>
                    <ListItemIcon sx={{ color: 'inherit' }}><DeleteOutlineIcon fontSize="small" /></ListItemIcon><ListItemText>Видалити</ListItemText>
                </MenuItem>}
            </Menu>

            <Dialog open={!!passwordTarget} onClose={() => { if (!changingPassword) { setPasswordTarget(null); setNewPassword(''); setConfirmPassword(''); } }} fullWidth maxWidth="xs" aria-labelledby="admin-password-title">
                <DialogTitle id="admin-password-title">Змінити пароль</DialogTitle>
                <Box component="form" onSubmit={event => { event.preventDefault(); void changePassword(); }}>
                    <DialogContent>
                        <Stack spacing={2}>
                            <Typography sx={{ overflowWrap: 'anywhere' }}>Адміністратор: <strong>{passwordTarget?.login}</strong></Typography>
                            <TextField name="admin-new-password" label="Новий пароль" type="password" autoComplete="new-password" fullWidth autoFocus
                                disabled={changingPassword} value={newPassword} onChange={event => setNewPassword(event.target.value)} onBlur={() => setPasswordTouched(true)}
                                error={passwordTouched && newPassword.length < 8} helperText="Щонайменше 8 символів" />
                            <TextField name="admin-confirm-password" label="Підтвердіть пароль" type="password" autoComplete="new-password" fullWidth
                                disabled={changingPassword} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} onBlur={() => setConfirmTouched(true)}
                                error={confirmTouched && (!confirmPassword || newPassword !== confirmPassword)}
                                helperText={confirmTouched && (!confirmPassword || newPassword !== confirmPassword) ? 'Паролі мають збігатися.' : undefined} />
                            {passwordError && <Alert severity="error">{passwordError}</Alert>}
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={{ p: 2, gap: 1 }}>
                        <Button variant="outlined" disabled={changingPassword} onClick={() => { setPasswordTarget(null); setNewPassword(''); setConfirmPassword(''); }}>Скасувати</Button>
                        <Button variant="contained" type="submit" loading={changingPassword} disabled={changingPassword}>Зберегти</Button>
                    </DialogActions>
                </Box>
            </Dialog>

            <ConfirmDeleteDialog open={!!deleteTarget} title="Видалити адміністратора?"
                description={`Адміністратора ${deleteTarget?.login ?? ''} буде видалено. Він втратить доступ до панелі адміністратора. Цю дію неможливо скасувати.`}
                busy={deleting} error={deleteError} onCancel={() => setDeleteTarget(null)} onConfirm={() => { void remove(); }} />

            <Dialog open={dialogOpen} onClose={() => { if (!saving) setDialogOpen(false); }} fullWidth maxWidth="xs">
                <DialogTitle>Новий адміністратор</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                    <TextField label="Логін" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} fullWidth autoFocus />
                    <TextField label="Пароль" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth
                        helperText="Щонайменше 8 символів" />
                    {formError && <ErrorState message={formError} />}
                </DialogContent>
                <DialogActions>
                    <Button variant="outlined" disabled={saving} onClick={() => setDialogOpen(false)}>Скасувати</Button>
                    <Button loading={saving} variant="contained" disabled={saving || !login || !password} onClick={create}>
                        {saving ? 'Створюємо…' : 'Створити'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
