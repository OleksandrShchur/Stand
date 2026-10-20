import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
    Accordion, AccordionDetails, AccordionSummary, Alert, AlertTitle, Box, Button, Card, CardContent,
    Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
    IconButton, Snackbar, Stack, Switch, ToggleButton, ToggleButtonGroup, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CloseIcon from '@mui/icons-material/Close';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import dayjs from 'dayjs';
import { adminApi } from '../../api/adminApi';
import { ApiError } from '../../api/client';
import type { DayScheduleDto, LocationAdminDto, SaveScheduleDto, ScheduleLocationDto, ScheduleRangeDto, ScheduleSaveResultDto } from '../../api/types';
import { LoadingState } from '../../components/StateMessage';
import { formatDate, formatWeekdayShort, todayIso } from '../../utils/date';
import { matchingDates, validateRanges } from './scheduleModel';
import LocationSchedule from './LocationSchedule';
import UkrainianDatePicker from '../../components/UkrainianDatePicker';
import ScheduleReviewContent from './ScheduleReviewContent';

const WEEKDAYS = [{ value: 1, label: 'Пн' }, { value: 2, label: 'Вт' }, { value: 3, label: 'Ср' },
    { value: 4, label: 'Чт' }, { value: 5, label: 'Пт' }, { value: 6, label: 'Сб' }, { value: 0, label: 'Нд' }];
const message = (error: unknown) => error instanceof ApiError || error instanceof Error ? error.message : 'Не вдалося зберегти. Спробуйте ще раз.';
type Draft = { isActive: boolean; locations: ScheduleLocationDto[] };
const snapshot = (day: Draft) => JSON.stringify({ isActive: day.isActive, locations: day.locations });
const copyDateLabel = (day: string) => `${formatDate(day)} (${formatWeekdayShort(day)})`;
const inactiveCopySourceMessage = 'Цей день неактивний. Його не можна використати як базову дату, оскільки немає розкладу для копіювання. Оберіть активний день.';
const archiveMessage = 'Архівний розклад не можна змінювати. Оберіть сьогоднішню або майбутню дату.';

export default function AdminSchedulePage() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const navigate = useNavigate();
    const [date, setDate] = useState(todayIso);
    const [today, setToday] = useState(todayIso);
    const [locations, setLocations] = useState<LocationAdminDto[]>([]);
    const [source, setSource] = useState<DayScheduleDto | null>(null);
    const [draftState, setDraft] = useState<Draft | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState<{ id: number; kind: 'saved' | 'unchanged' } | null>(null);
    const [busy, setBusy] = useState(false);
    const [retry, setRetry] = useState(0);
    const [calendarMonth, setCalendarMonth] = useState(() => todayIso().slice(0, 7));
    const [calendarDays, setCalendarDays] = useState<Record<string, { revision: number; activeDates: string[] }>>({});
    const [calendarError, setCalendarError] = useState('');
    const [calendarRevision, setCalendarRevision] = useState(0);
    const [leave, setLeave] = useState<(() => void) | null>(null);
    const [copyOpen, setCopyOpen] = useState(false);
    const [copyMode, setCopyMode] = useState<'dates' | 'weekdays'>('dates');
    const [copyDates, setCopyDates] = useState<string[]>([]);
    const [copySourceDate, setCopySourceDate] = useState(todayIso);
    const [copySource, setCopySource] = useState<DayScheduleDto | null>(null);
    const [copySourceError, setCopySourceError] = useState('');
    const [copySourceRetry, setCopySourceRetry] = useState(0);
    const [extraDate, setExtraDate] = useState('');
    const [copyFrom, setCopyFrom] = useState(todayIso);
    const [copyTo, setCopyTo] = useState(todayIso);
    const [weekdays, setWeekdays] = useState([1, 2, 3, 4, 5]);
    const [review, setReview] = useState<{ dto: SaveScheduleDto; result: ScheduleSaveResultDto; sourceDate?: string } | null>(null);
    const isArchived = date < today;
    const draft = isArchived ? source : draftState;
    const dirty = !!draft && !!source && snapshot(draft) !== snapshot(source);
    const activeDates = calendarDays[calendarMonth]?.revision === calendarRevision ? calendarDays[calendarMonth].activeDates : [];
    const copyCalendarActiveDates = [...activeDates.filter(day => day !== date), ...(draft?.isActive && date.startsWith(calendarMonth) ? [date] : [])];

    useEffect(() => {
        const refreshToday = () => setToday(todayIso());
        const timer = window.setInterval(refreshToday, 30000);
        window.addEventListener('focus', refreshToday);
        document.addEventListener('visibilitychange', refreshToday);
        return () => { window.clearInterval(timer); window.removeEventListener('focus', refreshToday); document.removeEventListener('visibilitychange', refreshToday); };
    }, []);

    useEffect(() => {
        let current = true;
        const month = dayjs(`${calendarMonth}-01`);
        setCalendarError('');
        adminApi.listDates(month.format('YYYY-MM-DD'), month.endOf('month').format('YYYY-MM-DD'))
            .then(days => { if (current) setCalendarDays(previous => ({ ...previous, [calendarMonth]: { revision: calendarRevision, activeDates: days.filter(day => day.isActive).map(day => day.date) } })); })
            .catch(() => { if (current) setCalendarError('Не вдалося позначити активні дні. Спробуйте ще раз.'); });
        return () => { current = false; };
    }, [calendarMonth, calendarRevision]);

    useEffect(() => {
        let current = true;
        setLoading(true); setError(''); setSource(null); setDraft(null);
        Promise.all([adminApi.getSchedule(date), adminApi.listLocations()])
            .then(([day, places]) => {
                if (!current) return;
                setSource(day); setDraft({ isActive: day.isActive, locations: day.locations }); setLocations(places);
            }).catch(e => { if (current) setError(message(e)); })
            .finally(() => { if (current) setLoading(false); });
        return () => { current = false; };
    }, [date, retry]);

    useEffect(() => {
        if (!copyOpen || copyMode !== 'dates' || !copySourceDate || copySourceDate === date) return;
        let current = true;
        adminApi.getSchedule(copySourceDate)
            .then(day => { if (current) { setCopySource(day); setCopySourceError(''); } })
            .catch(e => { if (current) setCopySourceError(message(e)); });
        return () => { current = false; };
    }, [copyOpen, copyMode, copySourceDate, date, copySourceRetry]);

    useEffect(() => {
        if (!dirty) return;
        const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        const link = (event: MouseEvent) => {
            const anchor = (event.target as Element).closest('a');
            if (!anchor || event.ctrlKey || event.metaKey || anchor.target === '_blank' || anchor.origin !== window.location.origin) return;
            event.preventDefault(); event.stopPropagation();
            setLeave(() => () => navigate(anchor.pathname + anchor.search));
        };
        window.addEventListener('beforeunload', unload);
        document.addEventListener('click', link, true);
        return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', link, true); };
    }, [dirty, navigate]);

    const chooseDate = (next: string) => {
        if (!next || next === date || busy) return;
        const action = () => { setDate(next); setNotice(null); };
        if (dirty) setLeave(() => action); else action();
    };
    const updateLocation = (id: number, slots: ScheduleRangeDto[] | null) => {
        if (date < todayIso()) return;
        setDraft(previous => previous && ({
            ...previous, locations: slots === null ? previous.locations.filter(l => l.locationId !== id) :
                previous.locations.some(l => l.locationId === id) ? previous.locations.map(l => l.locationId === id ? { ...l, slots } : l) :
                    [...previous.locations, { locationId: id, slots }],
        }));
    };
    const validation = draft?.locations.map(l => {
        const invalid = validateRanges(l.slots, source?.bookings.filter(b => b.locationId === l.locationId));
        return invalid ? `${locations.find(place => place.id === l.locationId)?.name}: ${invalid}` : '';
    }).find(Boolean) || '';
    const inactive = draft?.locations.some(l => !locations.find(place => place.id === l.locationId)?.isActive);
    const targetDates = useMemo(() => copyMode === 'dates' ? [...copyDates].sort() : matchingDates(copyFrom, copyTo, weekdays),
        [copyMode, copyDates, copyFrom, copyTo, weekdays]);
    const hasArchivedTargets = targetDates.some(day => day < today);
    const reviewHasArchivedTargets = review?.dto.dates.some(day => day < today);
    const copySchedule = copySourceDate === date ? draft : copySource?.date === copySourceDate ? copySource : null;
    const copySourceInactive = copySchedule?.isActive === false;
    const getCopySourceSelectionIssue = (next: string) => {
        if (next === date) return draft?.isActive ? null : { message: inactiveCopySourceMessage };
        const days = calendarDays[next.slice(0, 7)];
        if (!days || days.revision !== calendarRevision) return calendarError && next.startsWith(calendarMonth)
            ? { message: 'Не вдалося перевірити, чи активна дата. Закрийте календар і натисніть «Повторити».', severity: 'error' as const }
            : { message: 'Перевіряємо, чи активна обрана дата…', severity: 'info' as const };
        return days.activeDates.includes(next) ? null : { message: inactiveCopySourceMessage };
    };
    const copyValidation = copySchedule?.locations.map(l => {
        const invalid = validateRanges(l.slots);
        return invalid ? `${locations.find(place => place.id === l.locationId)?.name}: ${invalid}` : '';
    }).find(Boolean) || (copySchedule?.isActive && copySchedule.locations.some(l => !locations.find(place => place.id === l.locationId)?.isActive)
        ? 'У базовому розкладі є неактивна локація. Спочатку відредагуйте розклад цього дня.' : '');
    const copyTargetConflict = copyDates.includes(copySourceDate);
    const affected = source?.bookings.filter(booking => !draft?.isActive || !draft.locations.some(l => l.locationId === booking.locationId &&
        l.slots.some(slot => slot.startTime === booking.startTime && slot.endTime === booking.endTime))) || [];

    const prepare = async (targets: string[], schedule = draft, sourceDate?: string) => {
        if (!schedule || busy || (schedule === draft && validation) || (sourceDate && !schedule.isActive) || !targets.length) return;
        if (targets.some(day => day < todayIso())) { setError(archiveMessage); return; }
        setBusy(true); setError('');
        const dto: SaveScheduleDto = { isActive: schedule.isActive, locations: schedule.locations, dates: targets };
        try { setReview({ dto, result: await adminApi.previewSchedule(dto), sourceDate }); }
        catch (e) { setError(message(e)); }
        finally { setBusy(false); }
    };
    const saveDay = () => {
        if (!draft || busy || date < todayIso()) return;
        if (!dirty) {
            setNotice({ id: Date.now(), kind: 'unchanged' });
            return;
        }
        void prepare([date]);
    };
    const save = async () => {
        if (!review || busy) return;
        if (review.dto.dates.some(day => day < todayIso())) { setError(archiveMessage); return; }
        setBusy(true); setError('');
        try {
            await adminApi.saveSchedule({ ...review.dto, acknowledgeExistingBookings: true });
            setCalendarRevision(n => n + 1);
            setNotice({ id: Date.now(), kind: 'saved' });
            if (review.dto.dates.includes(date)) setRetry(n => n + 1);
            setReview(null); setCopyOpen(false);
        } catch (e) { setError(message(e)); }
        finally { setBusy(false); }
    };

    const moveDay = (delta: number) => {
        const next = new Date(`${date}T12:00:00Z`);
        next.setUTCDate(next.getUTCDate() + delta);
        chooseDate(next.toISOString().slice(0, 10));
    };

    return (
        <Box sx={{ width: '100%', minWidth: 0, maxWidth: 1000, mx: 'auto', overflowWrap: 'anywhere' }}>
            <Typography component="h1" variant="h4" sx={{
                mb: 2,
                [theme.breakpoints.down('sm')]: {
                    position: 'absolute', width: '1px', height: '1px', p: 0, m: '-1px',
                    overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap', border: 0,
                },
            }}>Розклад</Typography>
            <Snackbar
                key={notice?.id}
                open={notice !== null}
                autoHideDuration={notice?.kind === 'unchanged' ? 5000 : 10000}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                sx={{ top: { xs: 64, sm: 24 } }}
                onClose={(_, reason) => { if (reason !== 'clickaway') setNotice(null); }}
            >
                <Alert severity={notice?.kind === 'unchanged' ? 'info' : 'success'} variant="filled" onClose={() => setNotice(null)}>
                    {notice?.kind === 'unchanged' ? 'Немає змін для збереження' : 'Розклад збережено'}
                </Alert>
            </Snackbar>
            {error && <Alert severity="error" sx={{ mb: 2 }} action={!draft && <Button color="inherit" onClick={() => setRetry(n => n + 1)}>Повторити</Button>}>{error}</Alert>}
            <Box sx={{ display: 'grid', minWidth: 0, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '300px minmax(0, 1fr)' }, gap: 2, alignItems: 'start', '& > *': { minWidth: 0 } }}>
                <Card variant="outlined" sx={{ minWidth: 0 }}>
                    <CardContent>
                        <UkrainianDatePicker label="Дата розкладу" name="schedule-date" value={date} disabled={busy} confirmSelection onChange={chooseDate}
                            activeDates={activeDates} onCalendarOpen={next => setCalendarMonth((next || date).slice(0, 7))}
                            onCalendarMonthChange={month => setCalendarMonth(month.slice(0, 7))} />
                        {calendarError && <Alert severity="warning" sx={{ mt: 1 }} action={<Button onClick={() => setCalendarRevision(n => n + 1)}>Повторити</Button>}>{calendarError}</Alert>}
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0, mt: 1 }}>
                            <IconButton aria-label="Попередній день" disabled={busy} onClick={() => moveDay(-1)} sx={{ width: 44, height: 44, flexShrink: 0 }}><ChevronLeftIcon /></IconButton>
                            <Button fullWidth disabled={busy} onClick={() => chooseDate(todayIso())} sx={{ minWidth: 0 }}>
                                Сьогодні
                            </Button>
                            <IconButton aria-label="Наступний день" disabled={busy} onClick={() => moveDay(1)} sx={{ width: 44, height: 44, flexShrink: 0 }}><ChevronRightIcon /></IconButton>
                        </Stack>
                    </CardContent>
                </Card>

                <Stack spacing={2} sx={{ minWidth: 0 }}>
                    {loading && <LoadingState label="Завантажуємо розклад…" />}
                    {!loading && draft && source && <>
                        <Card variant="outlined" data-testid="schedule-day-summary"><CardContent>
                            <Stack direction="row" useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                                <Typography component="h2" variant="h6">{formatDate(date)}</Typography>
                                {isArchived && <Chip label="Архів" size="small" variant="outlined" />}
                            </Stack>
                            <FormControlLabel sx={isArchived ? { '& .MuiFormControlLabel-label.Mui-disabled': { color: 'text.secondary' } } : undefined}
                                control={<Switch checked={draft.isActive} disabled={busy || isArchived} onChange={e => { if (date >= todayIso()) setDraft({ ...draft, isActive: e.target.checked }); }} />}
                                label={draft.isActive ? 'День відкритий для запису' : 'День закритий для запису'} />
                            <Box data-testid="schedule-actions" sx={{ mt: 2 }}>
                                <Typography variant="body2" color={dirty ? 'warning.dark' : 'text.secondary'} role="status" sx={{ mb: 1.5 }}>
                                    {dirty ? 'Є незбережені зміни' : 'Локацій: ' + draft.locations.length + ' · Інтервалів: ' + draft.locations.reduce((n, l) => n + l.slots.length, 0)}
                                </Typography>
                                {isArchived && <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Доступно лише для перегляду та копіювання на сьогодні або майбутні дати.</Typography>}
                                {!isArchived && validation && <Alert severity="error" sx={{ mb: 1.5 }}>{validation}</Alert>}
                                {!isArchived && draft.isActive && inactive && <Alert severity="warning" sx={{ mb: 1.5 }}>У розкладі є неактивна локація. Вимкніть її тут або увімкніть у довіднику.</Alert>}
                                <Stack direction="row" spacing={1} sx={{ '& > .MuiButton-root': { flex: '1 1 0', minWidth: 0 }, '& .MuiButton-startIcon': { display: { xs: 'none', sm: 'inherit' } } }}>
                                    <Button variant="contained" startIcon={<SaveOutlinedIcon />} loading={busy} disabled={isArchived || (dirty && (!!validation || (draft.isActive && inactive)))} onClick={saveDay}>Зберегти</Button>
                                    <Button variant="outlined" startIcon={<ContentCopyIcon />} disabled={busy || !!validation || (draft.isActive && inactive)} onClick={() => {
                                        setCopySourceDate(date); setCopySource(null); setCopySourceError('');
                                        setCopyDates([]); setExtraDate(''); setError(''); setCopyOpen(true);
                                    }}>Копіювати</Button>
                                </Stack>
                            </Box>
                        </CardContent></Card>
                        <Box>
                            <Typography component="h2" variant="h6">Локації та час</Typography>
                            <Typography variant="body2" color="text.secondary">{isArchived ? 'Переглядайте час і кількість місць в архівному розкладі.' : 'Увімкніть локацію та натисніть «Налаштувати час».'}</Typography>
                        </Box>
                        {affected.length > 0 && <Alert severity="warning">
                            Поза новим розкладом залишаться записи: {affected.length}. Вони залишаться чинними на початкову дату, локацію й час.
                            Щоб скасувати їх, відкрийте «Записи» та підтвердьте кожне скасування.
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                                <Button component={RouterLink} to={`/admin/bookings?date=${date}`} variant="outlined" color="inherit" size="small">Переглянути записи дня</Button>
                            </Box>
                        </Alert>}
                        {!locations.length && <Alert severity="info">Спочатку додайте локацію у довіднику.</Alert>}
                        {locations.map(location => <LocationSchedule key={location.id} date={date} location={location}
                            slots={draft.locations.find(l => l.locationId === location.id)?.slots}
                            bookings={source.bookings.filter(b => b.locationId === location.id)} busy={busy} readOnly={isArchived}
                            otherLocations={draft.locations.filter(l => l.locationId !== location.id && l.slots.length > 0).map(l => ({ ...l, name: locations.find(p => p.id === l.locationId)?.name || '' }))}
                            onChange={slots => updateLocation(location.id, slots)} />)}
                        <Accordion disableGutters variant="outlined">
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography variant="body2" color="text.secondary">Правила запису</Typography></AccordionSummary>
                            <AccordionDetails>
                                <Typography variant="body2" color="text.secondary">Користувачі бачать дати на {source.horizonDays} днів уперед. Запис закривається за {source.minLeadTimeMinutes} хв до початку. Розклад можна готувати заздалегідь.</Typography>
                                {!source.isCustom && source.locations.length > 0 && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Цей день має спільний розклад. Після збереження ви керуватимете ним окремо.</Typography>}
                            </AccordionDetails>
                        </Accordion>
                        {!isArchived && <Button component={RouterLink} to="/admin/locations" startIcon={<AddIcon />}>Керувати локаціями</Button>}
                        {!isArchived && draft.isActive && !draft.locations.length && <Alert severity="warning">День відкритий, але час ще не додано. Користувачі поки не зможуть записатися.</Alert>}
                    </>}
                </Stack>
            </Box>

            <Dialog open={copyOpen} onClose={() => { if (!busy) setCopyOpen(false); }} fullScreen={isMobile} fullWidth maxWidth="sm" aria-labelledby="copy-title"
                slotProps={{ paper: { sx: { border: isMobile ? 0 : '1px solid', borderColor: 'divider', borderRadius: isMobile ? 0 : 1, ...(isMobile && { height: '100dvh', maxHeight: '100dvh' }) } } }}>
                <DialogTitle component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: 2, bgcolor: 'background.default', color: 'primary.dark', flexShrink: 0 }}>
                    <ContentCopyIcon color="primary" sx={{ display: { xs: 'none', sm: 'block' }, flexShrink: 0 }} />
                    <Typography id="copy-title" component="h2" variant="h6" sx={{ flex: 1, minWidth: 0, fontWeight: 700 }}>Копіювати розклад дня</Typography>
                    <IconButton aria-label="Закрити копіювання розкладу" disabled={busy} onClick={() => setCopyOpen(false)} sx={{ flexShrink: 0 }}><CloseIcon /></IconButton>
                </DialogTitle>
                <DialogContent dividers sx={{ p: 2, minWidth: 0, bgcolor: 'background.default', overflowWrap: 'anywhere', '& .MuiTypography-body2': { fontSize: '0.9375rem', lineHeight: 1.6 } }}>
                    <Stack spacing={2} sx={{ minWidth: 0, '& .MuiTextField-root': { minWidth: 0 }, '& input': { minWidth: 0, fontSize: 16 } }}>
                        {copyMode === 'dates' && copySourceInactive && <Alert severity="warning">{inactiveCopySourceMessage}</Alert>}
                        {copyMode === 'weekdays' && <Typography>{isArchived ? 'Копіюється збережений архівний розклад' : 'Копіюється поточний розклад'} за {formatDate(date)}: стан дня, локації та всі інтервали з кількістю місць{isArchived ? '.' : ', включно з незбереженими змінами.'}</Typography>}
                        <ToggleButtonGroup aria-label="Спосіб копіювання розкладу" exclusive fullWidth disabled={busy} value={copyMode} onChange={(_, value) => value && setCopyMode(value)}>
                            <ToggleButton value="dates" sx={{ flex: 1, minWidth: 0, bgcolor: 'background.paper', whiteSpace: 'normal' }}>Окремі дати</ToggleButton><ToggleButton value="weekdays" sx={{ flex: 1, minWidth: 0, bgcolor: 'background.paper', whiteSpace: 'normal' }}>За днями тижня</ToggleButton>
                        </ToggleButtonGroup>
                        {copyMode === 'dates' ? <>
                            <Stack component="section" aria-labelledby="copy-source-heading" data-testid="copy-source" spacing={1.5}
                                sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
                                <Typography id="copy-source-heading" component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>1. Звідки копіюємо</Typography>
                                <UkrainianDatePicker label="Базова дата розкладу" name="copy-source-date" value={copySourceDate} disabled={busy} confirmSelection
                                    getSelectionIssue={getCopySourceSelectionIssue} activeDates={copyCalendarActiveDates} onCalendarOpen={next => setCalendarMonth((next || copySourceDate || todayIso()).slice(0, 7))}
                                    onCalendarMonthChange={month => setCalendarMonth(month.slice(0, 7))} onChange={next => {
                                    setCopySourceDate(next); setCopySource(null); setCopySourceError(''); setError('');
                                }} />
                                <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
                                    <Box aria-hidden="true" sx={{ width: 10, height: 10, flexShrink: 0, borderRadius: '50%', bgcolor: 'var(--state-available-bg)', border: '1px solid', borderColor: 'success.main' }} />
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.875rem', lineHeight: 1.5 }}>Зеленим позначено відкриті дні.</Typography>
                                </Stack>
                                {calendarError && <Alert severity="warning" action={<Button disabled={busy} onClick={() => setCalendarRevision(n => n + 1)}>Повторити</Button>}>{calendarError}</Alert>}
                                <Box aria-live="polite">
                                    {!copySourceDate && <Typography color="text.secondary" variant="body2">Оберіть дату, з якої потрібно взяти розклад.</Typography>}
                                    {copySourceDate && !copySchedule && !copySourceError && <LoadingState label="Завантажуємо базовий розклад…" />}
                                    {copySourceError && <Alert severity="error" action={<Button disabled={busy} onClick={() => { setCopySourceError(''); setCopySourceRetry(n => n + 1); }}>Повторити</Button>}>{copySourceError}</Alert>}
                                    {copySourceDate && copySchedule && <Stack spacing={1.5}>
                                        <Chip label={copySchedule.isActive ? 'День відкритий для запису' : 'День закритий для запису'} color={copySchedule.isActive ? 'success' : 'default'} size="small" sx={{ alignSelf: 'flex-start', maxWidth: '100%' }} />
                                        <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 2, py: 1, borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}><Typography component="dt" variant="body2" color="text.secondary">Локацій</Typography><Typography component="dd" variant="h6" sx={{ m: 0, fontWeight: 700 }}>{copySchedule.locations.length}</Typography></Box>
                                            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}><Typography component="dt" variant="body2" color="text.secondary">Інтервалів</Typography><Typography component="dd" variant="h6" sx={{ m: 0, fontWeight: 700 }}>{copySchedule.locations.reduce((n, l) => n + l.slots.length, 0)}</Typography></Box>
                                        </Box>
                                        <Typography variant="body2" color="text.secondary">{copySourceDate === date && !isArchived
                                            ? dirty ? 'Беремо розклад із редактора, включно з незбереженими змінами.' : 'Беремо поточний розклад із редактора.'
                                            : 'Беремо збережений розклад цієї дати.'} Копіюються стан дня, локації, інтервали та кількість місць.</Typography>
                                    </Stack>}
                                </Box>
                                {copyValidation && <Alert severity="error">{copyValidation}</Alert>}
                            </Stack>
                            <Stack component="section" aria-labelledby="copy-target-heading" data-testid="copy-targets" spacing={1.5}
                                sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
                                <Typography id="copy-target-heading" component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>2. На які дати застосовуємо</Typography>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: 'stretch' }}>
                                    <UkrainianDatePicker label="Цільова дата" name="copy-date" value={extraDate} disabled={busy} minDate={today} onChange={setExtraDate}
                                        activeDates={activeDates} onCalendarOpen={next => setCalendarMonth((next || todayIso()).slice(0, 7))}
                                        onCalendarMonthChange={month => setCalendarMonth(month.slice(0, 7))} />
                                    <Button variant="outlined" startIcon={<AddIcon />} aria-label="Додати дату до копіювання" disabled={busy || !extraDate || extraDate < today || extraDate === copySourceDate || copyDates.includes(extraDate) || copyDates.length >= 366} onClick={() => { if (extraDate >= todayIso()) { setCopyDates([...copyDates, extraDate]); setExtraDate(''); } }} sx={{ flexShrink: 0, px: 2 }}>Додати</Button>
                                </Stack>
                                <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
                                    <Box aria-hidden="true" sx={{ width: 10, height: 10, flexShrink: 0, borderRadius: '50%', bgcolor: 'var(--state-available-bg)', border: '1px solid', borderColor: 'success.main' }} />
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.875rem', lineHeight: 1.5 }}>Зеленим позначено дні з активним розкладом.</Typography>
                                </Stack>
                                {calendarError && <Alert severity="warning" action={<Button disabled={busy} onClick={() => setCalendarRevision(n => n + 1)}>Повторити</Button>}>{calendarError}</Alert>}
                                {extraDate && extraDate === copySourceDate && <Typography variant="body2" color="error">Оберіть іншу дату: базову дату не потрібно додавати до цільових.</Typography>}
                                <Typography variant="body2" role="status" sx={{ fontWeight: 700 }}>Обрано дат: {targetDates.length}</Typography>
                                {targetDates.length ? <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1 }}>{targetDates.map(day => <Chip key={day} disabled={busy} sx={{ maxWidth: '100%' }} label={copyDateLabel(day)} onDelete={() => setCopyDates(copyDates.filter(d => d !== day))} />)}</Stack>
                                    : <Typography variant="body2" color="text.secondary">Оберіть цільову дату й натисніть «Додати». Можна додати кілька дат.</Typography>}
                                {copyTargetConflict && <Alert severity="error">Базова дата є серед цільових. Приберіть {copyDateLabel(copySourceDate)} зі списку або змініть базову дату.</Alert>}
                            </Stack>
                        </> : <>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <UkrainianDatePicker label="Від" name="copy-from" value={copyFrom} minDate={today} onChange={setCopyFrom} />
                                <UkrainianDatePicker label="До" name="copy-to" value={copyTo} minDate={today} onChange={setCopyTo} />
                            </Stack>
                            <Typography variant="body2" color="text.secondary">Оберіть дні тижня у періоді до одного року.</Typography>
                            <ToggleButtonGroup aria-label="Дні тижня для копіювання" value={weekdays} onChange={(_, value) => setWeekdays(value)} fullWidth>{WEEKDAYS.map(day => <ToggleButton key={day.value} value={day.value} sx={{ px: 0, minWidth: 24 }}>{day.label}</ToggleButton>)}</ToggleButtonGroup>
                        </>}
                        <Alert severity="warning" variant="outlined" sx={{ bgcolor: 'background.paper', boxShadow: 'none', '& .MuiAlert-message': { minWidth: 0 } }}>
                            <AlertTitle sx={{ fontWeight: 700, lineHeight: 1.5 }}>Розклад на цільових датах буде замінено</AlertTitle>
                            <Stack spacing={1}>
                                <Typography variant="body2">Зміни застосуються після перегляду та збереження розкладу.</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>Наявні записи залишаться чинними.</Typography>
                            </Stack>
                        </Alert>
                        {copyMode === 'weekdays' && <Typography sx={{ fontWeight: 700 }}>Обрано дат: {targetDates.length}</Typography>}
                        {hasArchivedTargets && <Alert severity="error">{archiveMessage}</Alert>}
                        {error && <Alert severity="error">{error}</Alert>}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 2, pb: 'max(16px, env(safe-area-inset-bottom))', bgcolor: 'background.paper', flexShrink: 0,
                    display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)', gap: 1.5,
                    '& > .MuiButton-root': { minWidth: 0, minHeight: 48, m: '0 !important', lineHeight: 1.4 } }}><Button variant="outlined" disabled={busy} onClick={() => setCopyOpen(false)}>Назад</Button>
                    <Button variant="contained" loading={busy} disabled={busy || !targetDates.length || hasArchivedTargets || (copyMode === 'dates' && (!copySchedule || copySourceInactive || !!copySourceError || !!copyValidation || copyTargetConflict))}
                        onClick={() => copyMode === 'dates' ? prepare(targetDates, copySchedule, copySourceDate) : prepare(targetDates)}>Переглянути зміни</Button></DialogActions>
            </Dialog>

            <Dialog open={!!review} onClose={() => { if (!busy) setReview(null); }} fullScreen={isMobile} fullWidth maxWidth="sm" aria-labelledby="review-title">
                <DialogTitle id="review-title" sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                    Підтвердити розклад
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Перевірте дати, час і кількість місць.</Typography>
                </DialogTitle>
                <DialogContent sx={{ minWidth: 0, overflowWrap: 'anywhere', bgcolor: 'background.default', p: 2 }}><Stack spacing={2} sx={{ pt: 2 }}>
                    {review?.sourceDate && <Alert severity="warning">
                        Базовий розклад: {copyDateLabel(review.sourceDate)}. Розклад на цільових датах нижче буде повністю замінено після натискання «Зберегти розклад». Наявні записи залишаться чинними.
                    </Alert>}
                    {review && <ScheduleReviewContent schedule={review.dto} result={review.result} locations={locations} />}
                    {reviewHasArchivedTargets && <Alert severity="error">{archiveMessage}</Alert>}
                    {error && <Alert severity="error">{error}</Alert>}
                </Stack></DialogContent>
                <DialogActions sx={{ p: 2, pb: 'max(16px, env(safe-area-inset-bottom))', borderTop: '1px solid', borderColor: 'divider', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1, alignItems: 'stretch', '& > .MuiButton-root': { width: '100%', minWidth: 0, height: 44, py: 0, px: 1, whiteSpace: 'nowrap', ml: '0 !important' } }}><Button variant="outlined" autoFocus disabled={busy} onClick={() => setReview(null)}>Назад</Button><Button loading={busy} disabled={busy || reviewHasArchivedTargets} variant="contained" onClick={save}>Зберегти розклад</Button></DialogActions>
            </Dialog>
            <Dialog open={!!leave} onClose={() => setLeave(null)} fullWidth maxWidth="xs" aria-labelledby="leave-title">
                <DialogTitle id="leave-title">Залишити незбережені зміни?</DialogTitle>
                <DialogContent>Зміни розкладу ще не збережено. Після переходу їх буде втрачено.</DialogContent>
                <DialogActions sx={{ p: 2, flexDirection: { xs: 'column', sm: 'row' }, gap: 1, '& > .MuiButton-root': { width: { xs: '100%', sm: 'auto' }, ml: '0 !important' } }}><Button variant="outlined" onClick={() => setLeave(null)}>Продовжити редагування</Button><Button variant="outlined" color="error" onClick={() => { leave?.(); setLeave(null); }}>Відкинути зміни</Button></DialogActions>
            </Dialog>
        </Box>
    );
}
