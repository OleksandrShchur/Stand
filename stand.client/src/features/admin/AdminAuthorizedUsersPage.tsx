import { useEffect, useMemo, useState } from 'react';
import {
    Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Link, Pagination, Stack,
    InputAdornment, ListItemIcon, ListItemText, Menu, MenuItem, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { adminApi } from '../../api/adminApi';
import { ApiError } from '../../api/client';
import { LoadingState, ErrorState } from '../../components/StateMessage';
import type { AuthorizedUserAdminDto } from '../../api/types';
import { digitsOnly, formatUaPhone, formatUaPhoneDigits, toUaPhone, uaPhoneValidationError } from '../../utils/phone';

export default function AdminAuthorizedUsersPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [items, setItems] = useState<AuthorizedUserAdminDto[]>([]);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const filtered = useMemo(() => {
        const term = search.trim().toLocaleLowerCase('uk-UA');
        return items.filter(user => `${user.firstName} ${user.lastName} ${user.phone}`.toLocaleLowerCase('uk-UA').includes(term));
    }, [items, search]);
    const visibleItems = filtered.slice((page - 1) * 20, page * 20);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [phoneDigits, setPhoneDigits] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [editingUser, setEditingUser] = useState<AuthorizedUserAdminDto | null>(null);
    const [deleteUser, setDeleteUser] = useState<AuthorizedUserAdminDto | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [actionMenu, setActionMenu] = useState<{ anchor: HTMLElement; user: AuthorizedUserAdminDto } | null>(null);

    const load = () => {
        setLoading(true);
        setError(null);
        adminApi.listAuthorizedUsers().then(users => { setItems(users); setPage(1); })
            .catch((e) => setError(e instanceof ApiError ? e.message : 'Не вдалося завантажити користувачів.'))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const openForm = (user: AuthorizedUserAdminDto | null = null) => {
        setEditingUser(user);
        setPhoneDigits(user ? user.phone.slice(4) : '');
        setFirstName(user?.firstName ?? '');
        setLastName(user?.lastName ?? '');
        setSubmitted(false);
        setFormError(null);
        setDialogOpen(true);
    };

    const firstNameError = !firstName.trim() || firstName.trim().length > 100 ? "Введіть ім'я (до 100 символів)." : null;
    const lastNameError = !lastName.trim() || lastName.trim().length > 100 ? 'Введіть прізвище (до 100 символів).' : null;

    const save = () => {
        setSubmitted(true);
        const validationError = uaPhoneValidationError(phoneDigits);
        if (validationError || firstNameError || lastNameError) return;

        setSaving(true);
        setFormError(null);
        const data = { phone: toUaPhone(phoneDigits), firstName: firstName.trim(), lastName: lastName.trim() };
        const action = editingUser ? adminApi.updateAuthorizedUser(editingUser.id, data) : adminApi.createAuthorizedUser(data);
        action
            .then(() => { setDialogOpen(false); load(); })
            .catch((e) => setFormError(e instanceof ApiError ? e.message : 'Не вдалося зберегти.'))
            .finally(() => setSaving(false));
    };

    const remove = () => {
        if (!deleteUser) return;
        setSaving(true);
        setDeleteError(null);
        adminApi.deleteAuthorizedUser(deleteUser.id)
            .then(() => { setDeleteUser(null); load(); })
            .catch((e) => setDeleteError(e instanceof ApiError ? e.message : 'Не вдалося видалити.'))
            .finally(() => setSaving(false));
    };

    const validationError = uaPhoneValidationError(phoneDigits);

    if (loading) return <LoadingState />;

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                <Typography variant="h4">Користувачі сайту</Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => openForm()}>Додати</Button>
            </Box>

            {error && <Box sx={{ mb: 2 }}><ErrorState message={error} onRetry={load} /></Box>}
            <TextField fullWidth label="Пошук за ім’ям або телефоном" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Знайдено користувачів: {filtered.length}</Typography>

            <Stack spacing={1} sx={{ display: { xs: 'flex', md: 'none' } }}>
                {visibleItems.map(u => <Card key={u.id} variant="outlined"><CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="h6" sx={{ overflowWrap: 'anywhere' }}>{[u.firstName, u.lastName].filter(Boolean).join(' ')}</Typography>
                            <Link href={`tel:${u.phone}`} sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 36 }}>{formatUaPhone(u.phone)}</Link>
                        </Box>
                        <IconButton aria-label={`Дії користувача ${[u.firstName, u.lastName].filter(Boolean).join(' ')}`} aria-haspopup="menu"
                            aria-controls={actionMenu?.user.id === u.id ? 'user-actions-menu' : undefined}
                            aria-expanded={actionMenu?.user.id === u.id ? true : undefined}
                            onClick={(e) => setActionMenu({ anchor: e.currentTarget, user: u })}
                            sx={{ width: 44, height: 44, flexShrink: 0 }}>
                            <MoreVertIcon />
                        </IconButton>
                    </Stack>
                </CardContent></Card>)}
            </Stack>
            <TableContainer component={Paper} variant="outlined" sx={{ display: { xs: 'none', md: 'block' } }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Ім'я</TableCell>
                            <TableCell>Прізвище</TableCell>
                            <TableCell>Телефон</TableCell>
                            <TableCell align="center">Дії</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {visibleItems.map((u) => (
                            <TableRow key={u.id} hover>
                                <TableCell sx={{ overflowWrap: 'anywhere' }}>{u.firstName || '-'}</TableCell>
                                <TableCell sx={{ overflowWrap: 'anywhere' }}>{u.lastName || '-'}</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>{formatUaPhone(u.phone)}</TableCell>
                                <TableCell align="center">
                                    <Tooltip title="Дії">
                                        <IconButton size="small" aria-label="Дії користувача" aria-haspopup="menu"
                                            aria-controls={actionMenu?.user.id === u.id ? 'user-actions-menu' : undefined}
                                            aria-expanded={actionMenu?.user.id === u.id ? true : undefined}
                                            onClick={(e) => setActionMenu({ anchor: e.currentTarget, user: u })}>
                                            <MoreVertIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            {filtered.length > 20 && <Pagination count={Math.ceil(filtered.length / 20)} page={page} onChange={(_, next) => setPage(next)} siblingCount={0} size="small" sx={{ mt: 2 }} aria-label="Сторінки користувачів" />}

            <Menu id="user-actions-menu" anchorEl={actionMenu?.anchor} open={Boolean(actionMenu)}
                onClose={() => setActionMenu(null)}
                slotProps={{ paper: { sx: { minWidth: 180 } } }}
                sx={{ '& .MuiMenuItem-root': { minHeight: 48 } }}>
                <MenuItem onClick={() => {
                    if (actionMenu) openForm(actionMenu.user);
                    setActionMenu(null);
                }}>
                    <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Редагувати</ListItemText>
                </MenuItem>
                <MenuItem sx={{ color: 'error.main' }} onClick={() => {
                    if (actionMenu) { setDeleteUser(actionMenu.user); setDeleteError(null); }
                    setActionMenu(null);
                }}>
                    <ListItemIcon sx={{ color: 'inherit' }}><DeleteOutlineIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Видалити</ListItemText>
                </MenuItem>
            </Menu>

            <Dialog open={dialogOpen} onClose={() => { if (!saving) setDialogOpen(false); }} fullWidth maxWidth="xs">
                <DialogTitle>{editingUser ? 'Редагувати користувача' : 'Новий користувач сайту'}</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                    <TextField label="Ім'я" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                        slotProps={{ htmlInput: { maxLength: 100, autoComplete: 'given-name' } }}
                        error={submitted && Boolean(firstNameError)} helperText={submitted ? firstNameError : null}
                        disabled={saving} fullWidth autoFocus sx={{ mt: 1 }} />
                    <TextField label="Прізвище" value={lastName} onChange={(e) => setLastName(e.target.value)}
                        slotProps={{ htmlInput: { maxLength: 100, autoComplete: 'family-name' } }}
                        error={submitted && Boolean(lastNameError)} helperText={submitted ? lastNameError : null}
                        disabled={saving} fullWidth />
                    <TextField
                        label="Номер телефону"
                        value={formatUaPhoneDigits(phoneDigits)}
                        onChange={(e) => {
                            setPhoneDigits(digitsOnly(e.target.value));
                            setFormError(null);
                        }}
                        slotProps={{
                            htmlInput: { inputMode: 'numeric', autoComplete: 'tel-national' },
                            input: { startAdornment: <InputAdornment position="start">+380</InputAdornment> },
                        }}
                        error={submitted && Boolean(validationError)}
                        helperText={submitted ? validationError : ' '}
                        disabled={saving}
                        fullWidth
                    />
                    {formError && <ErrorState message={formError} />}
                </DialogContent>
                <DialogActions>
                    <Button disabled={saving} onClick={() => setDialogOpen(false)}>Скасувати</Button>
                    <Button loading={saving} variant="contained" disabled={saving} onClick={save}>
                        {saving ? 'Зберігаємо...' : 'Зберегти'}
                    </Button>
                </DialogActions>
            </Dialog>
            <Dialog open={Boolean(deleteUser)} onClose={() => { if (!saving) setDeleteUser(null); }} fullWidth maxWidth="xs"
                aria-labelledby="delete-user-title">
                <DialogTitle id="delete-user-title">Видалити користувача?</DialogTitle>
                <DialogContent>
                    <Typography sx={{ overflowWrap: 'anywhere' }}>
                        {[deleteUser?.firstName, deleteUser?.lastName].filter(Boolean).join(' ')}
                    </Typography>
                    <Typography>{deleteUser ? formatUaPhone(deleteUser.phone) : ''}</Typography>
                    <Typography sx={{ mt: 2 }}>Користувач втратить доступ до сайту. Цю дію неможливо скасувати.</Typography>
                    {deleteError && <Box sx={{ mt: 2 }}><ErrorState message={deleteError} /></Box>}
                </DialogContent>
                <DialogActions>
                    <Button disabled={saving} onClick={() => setDeleteUser(null)} autoFocus>Скасувати</Button>
                    <Button loading={saving} color="error" variant="contained" startIcon={<DeleteOutlineIcon />} disabled={saving} onClick={remove}>
                        {saving ? 'Видаляємо...' : 'Видалити'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
