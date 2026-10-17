import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
    Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Card, CardContent,
    Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
    IconButton, Stack, Switch, ToggleButton, ToggleButtonGroup, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import { adminApi } from '../../api/adminApi';
import { ApiError } from '../../api/client';
import type { DayScheduleDto, LocationAdminDto, SaveScheduleDto, ScheduleLocationDto, ScheduleRangeDto, ScheduleSaveResultDto } from '../../api/types';
import { LoadingState } from '../../components/StateMessage';
import { formatDateFull, formatDateHuman, todayIso } from '../../utils/date';
import { matchingDates, validateRanges } from './scheduleModel';
import LocationSchedule from './LocationSchedule';
import UkrainianDatePicker from '../../components/UkrainianDatePicker';

const WEEKDAYS = [{ value: 1, label: 'Пн' }, { value: 2, label: 'Вт' }, { value: 3, label: 'Ср' },
    { value: 4, label: 'Чт' }, { value: 5, label: 'Пт' }, { value: 6, label: 'Сб' }, { value: 0, label: 'Нд' }];
const message = (error: unknown) => error instanceof ApiError || error instanceof Error ? error.message : 'Не вдалося зберегти. Спробуйте ще раз.';
type Draft = { isActive: boolean; locations: ScheduleLocationDto[] };
const snapshot = (day: Draft) => JSON.stringify({ isActive: day.isActive, locations: day.locations });

export default function AdminSchedulePage() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const navigate = useNavigate();
    const [date, setDate] = useState(todayIso);
    const [month, setMonth] = useState(() => todayIso().slice(0, 7));
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [dates, setDates] = useState<Record<string, boolean>>({});
    const [locations, setLocations] = useState<LocationAdminDto[]>([]);
    const [source, setSource] = useState<DayScheduleDto | null>(null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const [retry, setRetry] = useState(0);
    const [leave, setLeave] = useState<(() => void) | null>(null);
    const [copyOpen, setCopyOpen] = useState(false);
    const [copyMode, setCopyMode] = useState<'dates' | 'weekdays'>('dates');
    const [copyDates, setCopyDates] = useState<string[]>([]);
    const [extraDate, setExtraDate] = useState('');
    const [copyFrom, setCopyFrom] = useState(todayIso);
    const [copyTo, setCopyTo] = useState(todayIso);
    const [weekdays, setWeekdays] = useState([1, 2, 3, 4, 5]);
    const [review, setReview] = useState<{ dto: SaveScheduleDto; result: ScheduleSaveResultDto } | null>(null);
    const dirty = !!draft && !!source && snapshot(draft) !== snapshot(source);

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
        let current = true;
        const [year, monthNumber] = month.split('-').map(Number);
        const end = new Date(year, monthNumber, 0).getDate();
        adminApi.listDates(`${month}-01`, `${month}-${end}`).then(items => {
            if (current) setDates(Object.fromEntries(items.map(day => [day.date, day.isActive])));
        }).catch(e => { if (current) setError(message(e)); });
        return () => { current = false; };
    }, [month, retry]);

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
        const action = () => { setDate(next); setMonth(next.slice(0, 7)); setNotice(''); setCalendarOpen(false); };
        if (dirty) setLeave(() => action); else action();
    };
    const updateLocation = (id: number, slots: ScheduleRangeDto[] | null) => setDraft(previous => previous && ({
        ...previous, locations: slots === null ? previous.locations.filter(l => l.locationId !== id) :
            previous.locations.some(l => l.locationId === id) ? previous.locations.map(l => l.locationId === id ? { ...l, slots } : l) :
                [...previous.locations, { locationId: id, slots }],
    }));
    const validation = draft?.locations.map(l => {
        const invalid = validateRanges(l.slots);
        return invalid ? `${locations.find(place => place.id === l.locationId)?.name}: ${invalid}` : '';
    }).find(Boolean) || '';
    const inactive = draft?.locations.some(l => !locations.find(place => place.id === l.locationId)?.isActive);
    const targetDates = useMemo(() => copyMode === 'dates' ? [...copyDates].sort() : matchingDates(copyFrom, copyTo, weekdays),
        [copyMode, copyDates, copyFrom, copyTo, weekdays]);
    const affected = source?.bookings.filter(booking => !draft?.isActive || !draft.locations.some(l => l.locationId === booking.locationId &&
        l.slots.some(slot => slot.startTime === booking.startTime && slot.endTime === booking.endTime))) || [];

    const prepare = async (targets: string[]) => {
        if (!draft || validation || !targets.length) return;
        setBusy(true); setError('');
        const dto: SaveScheduleDto = { ...draft, dates: targets };
        try { setReview({ dto, result: await adminApi.previewSchedule(dto) }); }
        catch (e) { setError(message(e)); }
        finally { setBusy(false); }
    };
    const save = async () => {
        if (!review || busy) return;
        setBusy(true); setError('');
        try {
            const result = await adminApi.saveSchedule({ ...review.dto, acknowledgeExistingBookings: true });
            setNotice(`Розклад збережено. Дат: ${result.updatedDates}.${result.preservedBookings ? ` Наявні записи збережено: ${result.preservedBookings}.` : ''}`);
            if (review.dto.dates.includes(date)) setRetry(n => n + 1);
            else setDates(previous => ({ ...previous, ...Object.fromEntries(review.dto.dates.map(day => [day, review.dto.isActive])) }));
            setReview(null); setCopyOpen(false);
        } catch (e) { setError(message(e)); }
        finally { setBusy(false); }
    };

    const [year, monthNumber] = month.split('-').map(Number);
    const monthDate = new Date(year, monthNumber - 1, 1);
    const offset = (monthDate.getDay() + 6) % 7;
    const daysInMonth = new Date(year, monthNumber, 0).getDate();
    const moveMonth = (delta: number) => {
        const next = new Date(year, monthNumber - 1 + delta, 1);
        setMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
    };
    const moveDay = (delta: number) => {
        const next = new Date(`${date}T12:00:00Z`);
        next.setUTCDate(next.getUTCDate() + delta);
        chooseDate(next.toISOString().slice(0, 10));
    };

    return (
        <Box sx={{ width: '100%', minWidth: 0, maxWidth: 1000, mx: 'auto', pb: { xs: 14, md: 0 }, overflowWrap: 'anywhere' }}>
            <Typography variant="h4" sx={{ mb: 1 }}>Розклад</Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>Дата → локації → час чергувань</Typography>
            {notice && <Alert severity="success" onClose={() => setNotice('')} sx={{ mb: 2 }}>{notice}</Alert>}
            {error && <Alert severity="error" sx={{ mb: 2 }} action={!draft && <Button color="inherit" onClick={() => setRetry(n => n + 1)}>Повторити</Button>}>{error}</Alert>}
            <Box sx={{ display: 'grid', minWidth: 0, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '300px minmax(0, 1fr)' }, gap: 2, alignItems: 'start', '& > *': { minWidth: 0 } }}>
                <Card variant="outlined" sx={{ minWidth: 0 }}>
                    <CardContent>
                        <UkrainianDatePicker label="Дата розкладу" name="schedule-date" value={date} disabled={busy} onChange={chooseDate} />
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0, mt: 1 }}>
                            <IconButton aria-label="Попередній день" disabled={busy} onClick={() => moveDay(-1)} sx={{ width: 44, height: 44, flexShrink: 0 }}><ChevronLeftIcon /></IconButton>
                            <Button fullWidth startIcon={<CalendarMonthOutlinedIcon />} aria-expanded={isMobile ? calendarOpen : undefined} aria-controls={isMobile ? 'schedule-calendar' : undefined}
                                onClick={() => isMobile ? setCalendarOpen(open => !open) : chooseDate(todayIso())} sx={{ minWidth: 0 }}>
                                {isMobile ? (calendarOpen ? 'Згорнути календар' : 'Обрати в календарі') : 'Сьогодні'}
                            </Button>
                            <IconButton aria-label="Наступний день" disabled={busy} onClick={() => moveDay(1)} sx={{ width: 44, height: 44, flexShrink: 0 }}><ChevronRightIcon /></IconButton>
                        </Stack>
                        <Box id="schedule-calendar" sx={{ display: { xs: calendarOpen ? 'block' : 'none', md: 'block' }, minWidth: 0, mt: 2 }}>
                        <Stack direction="row" sx={{ mb: 1, alignItems: 'center', justifyContent: 'space-between' }}>
                            <IconButton aria-label="Попередній місяць" onClick={() => moveMonth(-1)}><ChevronLeftIcon /></IconButton>
                            <Typography sx={{ fontWeight: 700, textTransform: 'capitalize' }}>{monthDate.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' })}</Typography>
                            <IconButton aria-label="Наступний місяць" onClick={() => moveMonth(1)}><ChevronRightIcon /></IconButton>
                        </Stack>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 0.25 }}>
                            {WEEKDAYS.map(day => <Typography key={day.value} align="center" variant="caption" color="text.secondary">{day.label}</Typography>)}
                            {Array.from({ length: offset }, (_, i) => <Box key={`empty-${i}`} />)}
                            {Array.from({ length: daysInMonth }, (_, i) => {
                                const day = `${month}-${String(i + 1).padStart(2, '0')}`;
                                return <Button key={day} aria-label={`${formatDateFull(day)}${dates[day] ? ', відкрито' : ', закрито'}`} aria-pressed={day === date}
                                    disabled={busy} onClick={() => chooseDate(day)} variant={day === date ? 'contained' : 'text'}
                                    sx={{ minWidth: 0, minHeight: 44, p: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                                    {i + 1}<Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: dates[day] ? (day === date ? 'common.white' : 'primary.main') : 'transparent' }} />
                                </Button>;
                            })}
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>● Позначено відкриті дати</Typography>
                        <Button fullWidth onClick={() => chooseDate(todayIso())} sx={{ mt: 1 }}>До сьогодні</Button>
                        </Box>
                    </CardContent>
                </Card>

                <Stack spacing={2} sx={{ minWidth: 0 }}>
                    {loading && <LoadingState label="Завантажуємо розклад…" />}
                    {!loading && draft && source && <>
                        <Card variant="outlined"><CardContent>
                            <Typography variant="h6" sx={{ mb: 1 }}>{formatDateFull(date)}</Typography>
                            <FormControlLabel control={<Switch checked={draft.isActive} disabled={busy} onChange={e => setDraft({ ...draft, isActive: e.target.checked })} />}
                                label={draft.isActive ? 'День відкритий для запису' : 'День закритий для запису'} />
                        </CardContent></Card>
                        <Box>
                            <Typography variant="h6">Локації та час</Typography>
                            <Typography variant="body2" color="text.secondary">Увімкніть локацію та натисніть «Налаштувати час».</Typography>
                        </Box>
                        {affected.length > 0 && <Alert severity="warning">
                            Поза новим розкладом залишаться записи: {affected.length}. Вони залишаться чинними на початкову дату, локацію й час.
                            Щоб скасувати їх, відкрийте «Записи» та підтвердьте кожне скасування.
                            <Button component={RouterLink} to={`/admin/bookings?date=${date}`} color="inherit" size="small">Переглянути записи дня</Button>
                        </Alert>}
                        {!locations.length && <Alert severity="info">Спочатку додайте локацію у довіднику.</Alert>}
                        {locations.map(location => <LocationSchedule key={location.id} location={location}
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
                        {validation && <Alert severity="error">{validation}</Alert>}
                        {draft.isActive && inactive && <Alert severity="warning">У розкладі є неактивна локація. Вимкніть її тут або увімкніть у довіднику.</Alert>}
                        {draft.isActive && !draft.locations.length && <Alert severity="warning">День відкритий, але час ще не додано. Користувачі поки не зможуть записатися.</Alert>}
                        <Box data-testid="schedule-actions" sx={{ position: { xs: 'fixed', md: 'sticky' }, bottom: { xs: 'calc(56px + env(safe-area-inset-bottom))', md: 12 }, left: { xs: 0, md: 'auto' }, right: { xs: 0, md: 'auto' }, minWidth: 0, zIndex: theme.zIndex.appBar - 1, bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider', p: { xs: 1.5, md: 2 }, boxShadow: 2 }}>
                            <Typography variant="caption" color={dirty ? 'warning.dark' : 'text.secondary'} sx={{ display: 'block', mb: 0.75 }}>{dirty ? 'Є незбережені зміни' : 'Локацій: ' + draft.locations.length + ' · Інтервалів: ' + draft.locations.reduce((n, l) => n + l.slots.length, 0)}</Typography>
                            <Stack direction="row" spacing={1}>
                                <Button variant="contained" fullWidth startIcon={<SaveOutlinedIcon />} sx={{ '& .MuiButton-startIcon': { display: { xs: 'none', sm: 'inherit' } } }} loading={busy} disabled={!!validation || (draft.isActive && inactive)} onClick={() => prepare([date])}>Зберегти</Button>
                                <Button variant="outlined" fullWidth startIcon={<ContentCopyIcon />} sx={{ '& .MuiButton-startIcon': { display: { xs: 'none', sm: 'inherit' } } }} disabled={busy || !!validation || (draft.isActive && inactive)} onClick={() => { setCopyOpen(true); setCopyDates([]); }}>Копіювати</Button>
                            </Stack>
                        </Box>
                    </>}
                </Stack>
            </Box>

            <Dialog open={copyOpen} onClose={() => { if (!busy) setCopyOpen(false); }} fullScreen={isMobile} fullWidth maxWidth="sm" aria-labelledby="copy-title">
                <DialogTitle id="copy-title">Копіювати розклад дня</DialogTitle>
                <DialogContent sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                    <Stack spacing={2} sx={{ pt: 1, minWidth: 0, '& .MuiTextField-root': { minWidth: 0 }, '& input': { minWidth: 0, fontSize: 16 } }}>
                        <Typography>Копіюється поточний розклад за {formatDateHuman(date)}: стан дня, локації та всі інтервали, включно з незбереженими змінами.</Typography>
                        <ToggleButtonGroup exclusive fullWidth value={copyMode} onChange={(_, value) => value && setCopyMode(value)}>
                            <ToggleButton value="dates" sx={{ flex: 1, minWidth: 0 }}>Окремі дати</ToggleButton><ToggleButton value="weekdays" sx={{ flex: 1, minWidth: 0 }}>За днями тижня</ToggleButton>
                        </ToggleButtonGroup>
                        {copyMode === 'dates' ? <>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'start' }}>
                                <UkrainianDatePicker label="Додати дату" name="copy-date" value={extraDate} onChange={setExtraDate} />
                                <IconButton aria-label="Додати дату до копіювання" disabled={!extraDate || copyDates.includes(extraDate) || copyDates.length >= 366} onClick={() => { setCopyDates([...copyDates, extraDate]); setExtraDate(''); }} sx={{ mt: 0.5, minHeight: 44 }}><AddIcon /></IconButton>
                            </Stack>
                            <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1 }}>{copyDates.map(day => <Chip key={day} sx={{ maxWidth: '100%' }} label={formatDateFull(day)} onDelete={() => setCopyDates(copyDates.filter(d => d !== day))} />)}</Stack>
                        </> : <>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <UkrainianDatePicker label="Від" name="copy-from" value={copyFrom} onChange={setCopyFrom} />
                                <UkrainianDatePicker label="До" name="copy-to" value={copyTo} onChange={setCopyTo} />
                            </Stack>
                            <Typography variant="body2" color="text.secondary">Оберіть дні тижня у періоді до одного року.</Typography>
                            <ToggleButtonGroup value={weekdays} onChange={(_, value) => setWeekdays(value)} fullWidth>{WEEKDAYS.map(day => <ToggleButton key={day.value} value={day.value} sx={{ px: 0, minWidth: 0 }}>{day.label}</ToggleButton>)}</ToggleButtonGroup>
                        </>}
                        <Alert severity="warning">Розклад на вибраних датах буде повністю замінено. Наявні записи залишаться чинними. Перед збереженням ви побачите кількість записів, яких торкнуться зміни.</Alert>
                        <Typography sx={{ fontWeight: 700 }}>Обрано дат: {targetDates.length}</Typography>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 2, pb: 'max(16px, env(safe-area-inset-bottom))', flexWrap: 'wrap', gap: 1 }}><Button disabled={busy} onClick={() => setCopyOpen(false)}>Назад</Button>
                    <Button variant="contained" loading={busy} disabled={!targetDates.length} onClick={() => prepare(targetDates)}>Переглянути зміни</Button></DialogActions>
            </Dialog>

            <Dialog open={!!review} onClose={() => { if (!busy) setReview(null); }} fullScreen={isMobile} fullWidth maxWidth="sm" aria-labelledby="review-title">
                <DialogTitle id="review-title">Підтвердити розклад</DialogTitle>
                <DialogContent sx={{ minWidth: 0, overflowWrap: 'anywhere' }}><Stack spacing={2} sx={{ pt: 1 }}>
                    {review && <>
                        <Typography>Дат: <strong>{review.result.updatedDates}</strong> · {review.dto.isActive ? 'Відкрито для запису' : 'Закрито для запису'}</Typography>
                        <Box sx={{ maxHeight: 120, overflowY: 'auto' }}><Typography variant="body2">{review.dto.dates.map(formatDateFull).join('; ')}</Typography></Box>
                        {review.dto.locations.map(l => <Box key={l.locationId}><Typography sx={{ fontWeight: 700 }}>{locations.find(place => place.id === l.locationId)?.name}</Typography>
                            <Typography variant="body2">{l.slots.map(slot => `${slot.startTime}–${slot.endTime}`).join(', ')}</Typography></Box>)}
                        <Alert severity={review.result.preservedBookings ? 'warning' : 'info'}>
                            {review.result.preservedBookings ? `Поза розкладом залишаться записи: ${review.result.preservedBookings}. ` : ''}
                            Усі наявні записи залишаться чинними на початковий час. Збереження розкладу не скасовує їх. Нові записи дозволятимуться лише за цим розкладом.
                        </Alert>
                        {review.result.updatedDates > 1 && <Alert severity="warning">Цей розклад замінить налаштування кожної обраної дати.</Alert>}
                    </>}
                    {error && <Alert severity="error">{error}</Alert>}
                </Stack></DialogContent>
                <DialogActions sx={{ p: 2, pb: 'max(16px, env(safe-area-inset-bottom))', flexDirection: { xs: 'column-reverse', sm: 'row' }, gap: 1, '& > .MuiButton-root': { width: { xs: '100%', sm: 'auto' }, ml: '0 !important' } }}><Button disabled={busy} onClick={() => setReview(null)}>Назад до редагування</Button><Button loading={busy} variant="contained" onClick={save}>Зберегти розклад</Button></DialogActions>
            </Dialog>
            <Dialog open={!!leave} onClose={() => setLeave(null)} fullWidth maxWidth="xs" aria-labelledby="leave-title">
                <DialogTitle id="leave-title">Залишити незбережені зміни?</DialogTitle>
                <DialogContent>Зміни розкладу ще не збережено. Після переходу їх буде втрачено.</DialogContent>
                <DialogActions sx={{ p: 2, flexDirection: { xs: 'column', sm: 'row' }, gap: 1, '& > .MuiButton-root': { width: { xs: '100%', sm: 'auto' }, ml: '0 !important' } }}><Button onClick={() => setLeave(null)}>Продовжити редагування</Button><Button color="error" onClick={() => { leave?.(); setLeave(null); }}>Відкинути зміни</Button></DialogActions>
            </Dialog>
        </Box>
    );
}
