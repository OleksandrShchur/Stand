import { useEffect, useState } from 'react';
import {
    Box, Button, Card, CardContent, IconButton, Link, ListItemIcon, ListItemText, Menu, MenuItem,
    Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, Tooltip, Typography,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { adminApi } from '../../api/adminApi';
import { ApiError } from '../../api/client';
import type { FeedbackAdminDto } from '../../api/types';
import AppDialog from '../../components/AppDialog';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateMessage';
import { formatDateTime } from '../../utils/date';
import { formatUaPhone } from '../../utils/phone';

const commentPreviewSx = {
    whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', display: '-webkit-box',
    WebkitBoxOrient: 'vertical', WebkitLineClamp: 3, overflow: 'hidden',
} as const;

const detailRowSx = { display: 'grid', gridTemplateColumns: '84px minmax(0, 1fr)', columnGap: 1.5, alignItems: 'start' } as const;

export default function AdminFeedbackPage() {
    const [items, setItems] = useState<FeedbackAdminDto[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refresh, setRefresh] = useState(0);
    const [actionMenu, setActionMenu] = useState<{ anchor: HTMLElement; feedback: FeedbackAdminDto } | null>(null);
    const [detail, setDetail] = useState<FeedbackAdminDto | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        adminApi.listFeedback(page + 1, pageSize, controller.signal)
            .then(result => {
                if (controller.signal.aborted) return;
                setItems(result.items);
                setTotal(result.totalCount);
                setPage(result.page - 1);
            })
            .catch(error => {
                if (!controller.signal.aborted) setError(error instanceof ApiError ? error.message : 'Не вдалося завантажити відгуки.');
            })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [page, pageSize, refresh]);

    const actionsButton = (feedback: FeedbackAdminDto, view: 'mobile' | 'desktop') => (
        <Tooltip title="Дії">
            <IconButton
                id={`feedback-actions-${view}-${feedback.id}`}
                aria-label={`Дії для відгуку від ${[feedback.firstName, feedback.lastName].filter(Boolean).join(' ') || 'користувача'}`}
                aria-haspopup="menu"
                aria-controls={actionMenu?.anchor.id === `feedback-actions-${view}-${feedback.id}` ? 'feedback-actions-menu' : undefined}
                aria-expanded={actionMenu?.anchor.id === `feedback-actions-${view}-${feedback.id}` ? true : undefined}
                onClick={event => setActionMenu({ anchor: event.currentTarget, feedback })}
                sx={{ width: 44, height: 44, flexShrink: 0 }}
            >
                <MoreVertIcon />
            </IconButton>
        </Tooltip>
    );

    return (
        <Box aria-busy={loading}>
            <Typography component="h1" variant="h4" sx={theme => ({
                mb: 2,
                [theme.breakpoints.down('sm')]: {
                    position: 'absolute', width: '1px', height: '1px', p: 0, m: '-1px',
                    overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap', border: 0,
                },
            })}>Відгуки</Typography>
            {loading && <LoadingState label="Завантажуємо відгуки…" />}
            {!loading && error && <ErrorState message={error} onRetry={() => { setLoading(true); setError(null); setRefresh(value => value + 1); }} />}
            {!loading && !error && items.length === 0 && <EmptyState message="Відгуків поки немає." />}
            {!loading && !error && items.length > 0 && <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }} aria-live="polite">Всього відгуків: {total} · Спочатку найновіші</Typography>
                <Stack spacing={1.5} sx={{ display: { xs: 'flex', md: 'none' } }}>
                    {items.map(feedback => <Card key={feedback.id} variant="outlined">
                        <CardContent>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography component="h2" variant="h6" sx={{ overflowWrap: 'anywhere' }}>{[feedback.firstName, feedback.lastName].filter(Boolean).join(' ') || 'Без імені'}</Typography>
                                    <Typography component="time" dateTime={feedback.createdAtUtc} variant="body2" color="text.secondary">Надіслано {formatDateTime(feedback.createdAtUtc)}</Typography>
                                </Box>
                                {actionsButton(feedback, 'mobile')}
                            </Stack>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, mb: 0.5 }}>Коментар</Typography>
                            <Typography sx={commentPreviewSx}>{feedback.comment}</Typography>
                        </CardContent>
                    </Card>)}
                </Stack>
                <TableContainer component={Paper} variant="outlined" sx={{ display: { xs: 'none', md: 'block' } }}>
                    <Table size="small" aria-label="Відгуки користувачів" sx={{ tableLayout: 'fixed', '& .MuiTableCell-root': { verticalAlign: 'top', overflowWrap: 'anywhere' } }}>
                        <TableHead><TableRow>
                            <TableCell sx={{ width: '15%' }}>Ім’я</TableCell>
                            <TableCell sx={{ width: '18%' }}>Прізвище</TableCell>
                            <TableCell>Коментар</TableCell>
                            <TableCell sx={{ width: '22%' }}>Дата надсилання</TableCell>
                            <TableCell align="center" sx={{ width: 64, px: 1 }}>Дії</TableCell>
                        </TableRow></TableHead>
                        <TableBody>{items.map(feedback => <TableRow key={feedback.id} hover>
                            <TableCell>{feedback.firstName || '—'}</TableCell>
                            <TableCell>{feedback.lastName || '—'}</TableCell>
                            <TableCell><Typography variant="body2" sx={commentPreviewSx}>{feedback.comment}</Typography></TableCell>
                            <TableCell><Typography component="time" dateTime={feedback.createdAtUtc} variant="body2">{formatDateTime(feedback.createdAtUtc)}</Typography></TableCell>
                            <TableCell align="center" sx={{ px: 1 }}>{actionsButton(feedback, 'desktop')}</TableCell>
                        </TableRow>)}</TableBody>
                    </Table>
                </TableContainer>
                <TablePagination
                    component="div"
                    count={total}
                    page={page}
                    rowsPerPage={pageSize}
                    rowsPerPageOptions={[10, 25, 50]}
                    onPageChange={(_, nextPage) => { setLoading(true); setError(null); setActionMenu(null); setPage(nextPage); }}
                    onRowsPerPageChange={event => { setLoading(true); setError(null); setPageSize(Number(event.target.value)); setPage(0); }}
                    labelRowsPerPage="На сторінці:"
                    labelDisplayedRows={({ from, to, count }) => `${from}–${to} з ${count}`}
                    getItemAriaLabel={type => ({ first: 'Перша сторінка', last: 'Остання сторінка', next: 'Наступна сторінка', previous: 'Попередня сторінка' })[type]}
                    sx={{ mt: 2, '& .MuiTablePagination-toolbar': { px: { xs: 0, sm: 2 } }, '& .MuiTablePagination-selectLabel, & .MuiTablePagination-spacer': { display: { xs: 'none', sm: 'block' } } }}
                />
            </>}
            <Menu
                id="feedback-actions-menu"
                anchorEl={actionMenu?.anchor}
                open={Boolean(actionMenu)}
                onClose={() => setActionMenu(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{ list: { 'aria-labelledby': actionMenu?.anchor.id } }}
            >
                <MenuItem onClick={() => { if (actionMenu) setDetail(actionMenu.feedback); setActionMenu(null); }}>
                    <ListItemIcon><InfoOutlinedIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Деталі</ListItemText>
                </MenuItem>
            </Menu>
            <AppDialog
                open={Boolean(detail)}
                onClose={() => setDetail(null)}
                title="Деталі відгуку"
                icon={<InfoOutlinedIcon color="primary" />}
                actions={<Button variant="outlined" fullWidth autoFocus onClick={() => setDetail(null)}>Закрити</Button>}
            >
                {detail && <Stack component="dl" spacing={1.5} sx={{ m: 0, '& dd': { m: 0, overflowWrap: 'anywhere' } }}>
                    <Box sx={detailRowSx}>
                        <Typography component="dt" variant="body2" sx={{ fontWeight: 600 }}>Ім’я</Typography>
                        <Typography component="dd" variant="body2">{detail.firstName || '—'}</Typography>
                    </Box>
                    <Box sx={detailRowSx}>
                        <Typography component="dt" variant="body2" sx={{ fontWeight: 600 }}>Прізвище</Typography>
                        <Typography component="dd" variant="body2">{detail.lastName || '—'}</Typography>
                    </Box>
                    <Box sx={detailRowSx}>
                        <Typography component="dt" variant="body2" sx={{ fontWeight: 600 }}>Телефон</Typography>
                        <Box component="dd"><Link variant="body2" href={`tel:${detail.phone}`}>{formatUaPhone(detail.phone)}</Link></Box>
                    </Box>
                    <Box sx={detailRowSx}>
                        <Typography component="dt" variant="body2" sx={{ fontWeight: 600 }}>Дата</Typography>
                        <Box component="dd"><Typography component="time" variant="body2" dateTime={detail.createdAtUtc}>{formatDateTime(detail.createdAtUtc)}</Typography></Box>
                    </Box>
                    <Box sx={{ pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}><Typography component="dt" variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Коментар</Typography><Typography component="dd" sx={{ whiteSpace: 'pre-wrap' }}>{detail.comment}</Typography></Box>
                </Stack>}
            </AppDialog>
        </Box>
    );
}
