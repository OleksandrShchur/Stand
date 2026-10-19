import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
    Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Card, CardContent,
    Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
    IconButton, Snackbar, Stack, Switch, ToggleButton, ToggleButtonGroup, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
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

export default function AdminSchedulePage() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const navigate = useNavigate();
    const [date, setDate] = useState(todayIso);
    const [locations, setLocations] = useState<LocationAdminDto[]>([]);
    const [source, setSource] = useState<DayScheduleDto | null>(null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState<{ id: number; kind: 'saved' | 'unchanged' } | null>(null);
    const [busy, setBusy] = useState(false);
    const [retry, setRetry] = useState(0);
    const [calendarMonth, setCalendarMonth] = useState(() => todayIso().slice(0, 7));
    const [activeDates, setActiveDates] = useState<string[]>([]);
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
    const dirty = !!draft && !!source && snapshot(draft) !== snapshot(source);

    useEffect(() => {
        let current = true;
        const month = dayjs(`${calendarMonth}-01`);
        setActiveDates([]); setCalendarError('');
        adminApi.listDates(month.format('YYYY-MM-DD'), month.endOf('month').format('YYYY-MM-DD'))
            .then(days => { if (current) setActiveDates(days.filter(day => day.isActive).map(day => day.date)); })
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
    const updateLocation = (id: number, slots: ScheduleRangeDto[] | null) => setDraft(previous => previous && ({
        ...previous, locations: slots === null ? previous.locations.filter(l => l.locationId !== id) :
            previous.locations.some(l => l.locationId === id) ? previous.locations.map(l => l.locationId === id ? { ...l, slots } : l) :
                [...previous.locations, { locationId: id, slots }],
    }));
    const validation = draft?.locations.map(l => {
        const invalid = validateRanges(l.slots, source?.bookings.filter(b => b.locationId === l.locationId));
        return invalid ? `${locations.find(place => place.id === l.locationId)?.name}: ${invalid}` : '';
    }).find(Boolean) || '';
    const inactive = draft?.locations.some(l => !locations.find(place => place.id === l.locationId)?.isActive);
    const targetDates = useMemo(() => copyMode === 'dates' ? [...copyDates].sort() : matchingDates(copyFrom, copyTo, weekdays),
        [copyMode, copyDates, copyFrom, copyTo, weekdays]);
    const copySchedule = copySourceDate === date ? draft : copySource?.date === copySourceDate ? copySource : null;
    const copyValidation = copySchedule?.locations.map(l => {
        const invalid = validateRanges(l.slots);
        return invalid ? `${locations.find(place => place.id === l.locationId)?.name}: ${invalid}` : '';
    }).find(Boolean) || (copySchedule?.isActive && copySchedule.locations.some(l => !locations.find(place => place.id === l.locationId)?.isActive)
        ? 'У базовому розкладі є неактивна локація. Спочатку відредагуйте розклад цього дня.' : '');
    const copyTargetConflict = copyDates.includes(copySourceDate);
    const affected = source?.bookings.filter(booking => !draft?.isActive || !draft.locations.some(l => l.locationId === booking.locationId &&
        l.slots.some(slot => slot.startTime === booking.startTime && slot.endTime === booking.endTime))) || [];

    const prepare = async (targets: string[], schedule = draft, sourceDate?: string) => {
        if (!schedule || busy || (schedule === draft && validation) || !targets.length) return;
        setBusy(true); setError('');
        const dto: SaveScheduleDto = { isActive: schedule.isActive, locations: schedule.locations, dates: targets };
        try { setReview({ dto, result: await adminApi.previewSchedule(dto), sourceDate }); }
        catch (e) { setError(message(e)); }
        finally { setBusy(false); }
    };
    const saveDay = () => {
        if (!draft || busy) return;
        if (!dirty) {
            setNotice({ id: Date.now(), kind: 'unchanged' });
            return;
        }
        void prepare([date]);
    };
    const save = async () => {
        if (!review || busy) return;
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
                        <UkrainianDatePicker label="Дата розкладу" name="schedule-date" value={date} disabled={busy} onChange={chooseDate}
                            activeDates={activeDates} onCalendarOpen={() => setCalendarMonth(date.slice(0, 7))}
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
                            <Typography component="h2" variant="h6" sx={{ mb: 1 }}>{formatDate(date)}</Typography>
                            <FormControlLabel control={<Switch checked={draft.isActive} disabled={busy} onChange={e => setDraft({ ...draft, isActive: e.target.checked })} />}
                                label={draft.isActive ? 'День відкритий для запису' : 'День закритий для запису'} />
                            <Box data-testid="schedule-actions" sx={{ mt: 2 }}>
                                <Typography variant="body2" color={dirty ? 'warning.dark' : 'text.secondary'} role="status" sx={{ mb: 1.5 }}>
                                    {dirty ? 'Є незбережені зміни' : 'Локацій: ' + draft.locations.length + ' · Інтервалів: ' + draft.locations.reduce((n, l) => n + l.slots.length, 0)}
                                </Typography>
                                {validation && <Alert severity="error" sx={{ mb: 1.5 }}>{validation}</Alert>}
                                {draft.isActive && inactive && <Alert severity="warning" sx={{ mb: 1.5 }}>У розкладі є неактивна локація. Вимкніть її тут або увімкніть у довіднику.</Alert>}
                                <Stack direction="row" spacing={1} sx={{ '& > .MuiButton-root': { flex: '1 1 0', minWidth: 0 }, '& .MuiButton-startIcon': { display: { xs: 'none', sm: 'inherit' } } }}>
                                    <Button variant="contained" startIcon={<SaveOutlinedIcon />} loading={busy} disabled={dirty && (!!validation || (draft.isActive && inactive))} onClick={saveDay}>Зберегти</Button>
                                    <Button variant="outlined" startIcon={<ContentCopyIcon />} disabled={busy || !!validation || (draft.isActive && inactive)} onClick={() => {
                                        setCopySourceDate(date); setCopySource(null); setCopySourceError('');
                                        setCopyDates([]); setExtraDate(''); setError(''); setCopyOpen(true);
                                    }}>Копіювати</Button>
                                </Stack>
                            </Box>
                        </CardContent></Card>
                        <Box>
                            <Typography component="h2" variant="h6">Локації та час</Typography>
                            <Typography variant="body2" color="text.secondary">Увімкніть локацію та натисніть «Налаштувати час».</Typography>
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
                            bookings={source.bookings.filter(b => b.locationId === location.id)} busy={busy}
                            otherLocations={draft.locations.filter(l => l.locationId !== location.id && l.slots.length > 0).map(l => ({ ...l, name: locations.find(p => p.id === l.locationId)?.name || '' }))}
                            onChange={slots => updateLocation(location.id, slots)} />)}
                        <Accordion disableGutters variant="outlined">
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography variant="body2" color="text.secondary">Правила запису</Typography></AccordionSummary>
                            <AccordionDetails>
                                <Typography variant="body2" color="text.secondary">Користувачі бачать дати на {source.horizonDays} днів уперед. Запис закривається за {source.minLeadTimeMinutes} хв до початку. Розклад можна готувати заздалегідь.</Typography>
                                {!source.isCustom && source.locations.length > 0 && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Цей день має спільний розклад. Після збереження ви керуватимете ним окремо.</Typography>}
                            </AccordionDetails>
                        </Accordion>
                        <Button component={RouterLink} to="/admin/locations" startIcon={<AddIcon />}>Керувати локаціями</Button>
                        {draft.isActive && !draft.locations.length && <Alert severity="warning">День відкритий, але час ще не додано. Користувачі поки не зможуть записатися.</Alert>}
                    </>}
                </Stack>
            </Box>

            <Dialog open={copyOpen} onClose={() => { if (!busy) setCopyOpen(false); }} fullScreen={isMobile} fullWidth maxWidth="sm" aria-labelledby="copy-title">
                <DialogTitle id="copy-title">Копіювати розклад дня</DialogTitle>
                <DialogContent sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                    <Stack spacing={2} sx={{ pt: 1, minWidth: 0, '& .MuiTextField-root': { minWidth: 0 }, '& input': { minWidth: 0, fontSize: 16 } }}>
                        {copyMode === 'weekdays' && <Typography>Копіюється поточний розклад за {formatDate(date)}: стан дня, локації та всі інтервали з кількістю місць, включно з незбереженими змінами.</Typography>}
                        <ToggleButtonGroup aria-label="Спосіб копіювання розкладу" exclusive fullWidth disabled={busy} value={copyMode} onChange={(_, value) => value && setCopyMode(value)}>
                            <ToggleButton value="dates" sx={{ flex: 1, minWidth: 0 }}>Окремі дати</ToggleButton><ToggleButton value="weekdays" sx={{ flex: 1, minWidth: 0 }}>За днями тижня</ToggleButton>
                        </ToggleButtonGroup>
                        {copyMode === 'dates' ? <>
                            <Stack component="section" aria-labelledby="copy-source-heading" data-testid="copy-source" spacing={1.5}
                                sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.default' }}>
                                <Typography id="copy-source-heading" component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>1. Звідки копіюємо</Typography>
                                <UkrainianDatePicker label="Базова дата розкладу" name="copy-source-date" value={copySourceDate} disabled={busy} confirmSelection
                                    activeDates={activeDates} onCalendarOpen={() => setCalendarMonth((copySourceDate || todayIso()).slice(0, 7))}
                                    onCalendarMonthChange={month => setCalendarMonth(month.slice(0, 7))} onChange={next => {
                                    setCopySourceDate(next); setCopySource(null); setCopySourceError(''); setError('');
                                }} />
                                <Typography variant="caption" color="text.secondary">Зеленим позначено дні, відкриті для запису.</Typography>
                                {calendarError && <Alert severity="warning" action={<Button disabled={busy} onClick={() => setCalendarRevision(n => n + 1)}>Повторити</Button>}>{calendarError}</Alert>}
                                <Box aria-live="polite">
                                    {!copySourceDate && <Typography color="text.secondary" variant="body2">Оберіть дату, з якої потрібно взяти розклад.</Typography>}
                                    {copySourceDate && !copySchedule && !copySourceError && <LoadingState label="Завантажуємо базовий розклад…" />}
                                    {copySourceError && <Alert severity="error" action={<Button disabled={busy} onClick={() => { setCopySourceError(''); setCopySourceRetry(n => n + 1); }}>Повторити</Button>}>{copySourceError}</Alert>}
                                    {copySourceDate && copySchedule && <Stack spacing={0.5}>
                                        <Typography sx={{ fontWeight: 700 }}>{copyDateLabel(copySourceDate)}</Typography>
                                        <Typography variant="body2">{copySchedule.isActive ? 'День відкритий для запису' : 'День закритий для запису'} · Локацій: {copySchedule.locations.length} · Інтервалів: {copySchedule.locations.reduce((n, l) => n + l.slots.length, 0)}</Typography>
                                        <Typography variant="body2" color="text.secondary">{copySourceDate === date
                                            ? dirty ? 'Беремо розклад із редактора, включно з незбереженими змінами.' : 'Беремо поточний розклад із редактора.'
                                            : 'Беремо збережений розклад цієї дати.'} Копіюються стан дня, локації, час і кількість місць.</Typography>
                                    </Stack>}
                                </Box>
                                {copyValidation && <Alert severity="error">{copyValidation}</Alert>}
                            </Stack>
                            <Stack component="section" aria-labelledby="copy-target-heading" data-testid="copy-targets" spacing={1.5}>
                                <Typography id="copy-target-heading" component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>2. На які дати застосовуємо</Typography>
                                <Stack direction="row" spacing={1} sx={{ alignItems: 'start' }}>
                                    <UkrainianDatePicker label="Дата для застосування" name="copy-date" value={extraDate} disabled={busy} onChange={setExtraDate} />
                                    <IconButton aria-label="Додати дату до копіювання" disabled={busy || !extraDate || extraDate === copySourceDate || copyDates.includes(extraDate) || copyDates.length >= 366} onClick={() => { setCopyDates([...copyDates, extraDate]); setExtraDate(''); }} sx={{ mt: 0.5, minWidth: 44, minHeight: 44 }}><AddIcon /></IconButton>
                                </Stack>
                                {extraDate && extraDate === copySourceDate && <Typography variant="body2" color="error">Оберіть іншу дату: базову дату не потрібно додавати до цільових.</Typography>}
                                <Typography variant="body2" role="status" sx={{ fontWeight: 700 }}>Обрано дат: {targetDates.length}</Typography>
                                {targetDates.length ? <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1 }}>{targetDates.map(day => <Chip key={day} disabled={busy} sx={{ maxWidth: '100%' }} label={copyDateLabel(day)} onDelete={() => setCopyDates(copyDates.filter(d => d !== day))} />)}</Stack>
                                    : <Typography variant="body2" color="text.secondary">Додайте дату та натисніть «+». Список нижче показуватиме всі дати, на які буде скопійовано розклад.</Typography>}
                                {copyTargetConflict && <Alert severity="error">Базова дата є серед цільових. Приберіть {copyDateLabel(copySourceDate)} зі списку або змініть базову дату.</Alert>}
                            </Stack>
                        </> : <>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <UkrainianDatePicker label="Від" name="copy-from" value={copyFrom} onChange={setCopyFrom} />
                                <UkrainianDatePicker label="До" name="copy-to" value={copyTo} onChange={setCopyTo} />
                            </Stack>
                            <Typography variant="body2" color="text.secondary">Оберіть дні тижня у періоді до одного року.</Typography>
                            <ToggleButtonGroup aria-label="Дні тижня для копіювання" value={weekdays} onChange={(_, value) => setWeekdays(value)} fullWidth>{WEEKDAYS.map(day => <ToggleButton key={day.value} value={day.value} sx={{ px: 0, minWidth: 24 }}>{day.label}</ToggleButton>)}</ToggleButtonGroup>
                        </>}
                        <Alert severity="warning">Розклад на вибраних датах буде повністю замінено. Наявні записи залишаться чинними. Перед збереженням ви побачите кількість записів, яких торкнуться зміни.</Alert>
                        {copyMode === 'weekdays' && <Typography sx={{ fontWeight: 700 }}>Обрано дат: {targetDates.length}</Typography>}
                        {error && <Alert severity="error">{error}</Alert>}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 2, pb: 'max(16px, env(safe-area-inset-bottom))', flexWrap: 'wrap', gap: 1 }}><Button disabled={busy} onClick={() => setCopyOpen(false)}>Назад</Button>
                    <Button variant="contained" loading={busy} disabled={busy || !targetDates.length || (copyMode === 'dates' && (!copySchedule || !!copySourceError || !!copyValidation || copyTargetConflict))}
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
                    {error && <Alert severity="error">{error}</Alert>}
                </Stack></DialogContent>
                <DialogActions sx={{ p: 2, pb: 'max(16px, env(safe-area-inset-bottom))', borderTop: '1px solid', borderColor: 'divider', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1, alignItems: 'stretch', '& > .MuiButton-root': { width: '100%', minWidth: 0, height: 44, py: 0, px: 1, whiteSpace: 'nowrap', ml: '0 !important' } }}><Button variant="outlined" autoFocus disabled={busy} onClick={() => setReview(null)}>Назад</Button><Button loading={busy} disabled={busy} variant="contained" onClick={save}>Зберегти розклад</Button></DialogActions>
            </Dialog>
            <Dialog open={!!leave} onClose={() => setLeave(null)} fullWidth maxWidth="xs" aria-labelledby="leave-title">
                <DialogTitle id="leave-title">Залишити незбережені зміни?</DialogTitle>
                <DialogContent>Зміни розкладу ще не збережено. Після переходу їх буде втрачено.</DialogContent>
                <DialogActions sx={{ p: 2, flexDirection: { xs: 'column', sm: 'row' }, gap: 1, '& > .MuiButton-root': { width: { xs: '100%', sm: 'auto' }, ml: '0 !important' } }}><Button variant="outlined" onClick={() => setLeave(null)}>Продовжити редагування</Button><Button variant="outlined" color="error" onClick={() => { leave?.(); setLeave(null); }}>Відкинути зміни</Button></DialogActions>
            </Dialog>
        </Box>
    );
}
