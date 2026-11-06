import { useEffect, useState } from 'react';
import {
    Autocomplete, Box, Card, CardContent, CircularProgress, MenuItem, Stack, Tab, Tabs,
    TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import { adminApi } from '../../api/adminApi';
import { ApiError } from '../../api/client';
import { EmptyState, ErrorState } from '../../components/StateMessage';
import type { StatisticsPeriodType, StatisticsPeriodsDto, StatisticsPersonDto } from '../../api/types';
import { formatUaPhone } from '../../utils/phone';
import {
    availablePeriods, changePeriodType, MONTH_NAMES, periodKey, resolvePeriod,
    type StatisticsPeriod,
} from './statisticsModel';
import StatisticsReport from './StatisticsReport';
import StatisticsSkeleton from './StatisticsSkeleton';

export default function AdminDashboardPage() {
    const [view, setView] = useState<'locations' | 'person'>('locations');
    const [person, setPerson] = useState<StatisticsPersonDto | null>(null);

    return (
        <Stack spacing={2.5}>
            <Box>
                <Typography component="h1" sx={{
                    position: 'absolute', width: '1px', height: '1px', p: 0, m: '-1px',
                    overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap', border: 0,
                }}>Статистика</Typography>
                <Tabs value={view} onChange={(_, value) => setView(value)} variant="fullWidth" aria-label="Тип статистики"
                    slotProps={{ indicator: { sx: { display: 'none' } } }}
                    sx={{
                        minHeight: 44, border: '1px solid', borderColor: 'primary.main', borderRadius: 1,
                        bgcolor: 'background.paper', overflow: 'hidden',
                        '& .MuiTab-root': { minHeight: 44, px: 1, py: 0.75, fontSize: '0.875rem' },
                        '& .MuiTab-root + .MuiTab-root': { borderLeft: '1px solid', borderColor: 'primary.main' },
                        '& .MuiTab-root.Mui-selected': { bgcolor: 'action.selected' },
                        '& .MuiTab-icon': { fontSize: 20, mr: 0.75 },
                    }}>
                    <Tab value="locations" label="За локаціями" icon={<PlaceOutlinedIcon />} iconPosition="start"
                        id="statistics-locations-tab" aria-controls="statistics-panel" />
                    <Tab value="person" label="За людиною" icon={<PersonOutlineIcon />} iconPosition="start"
                        id="statistics-person-tab" aria-controls="statistics-panel" />
                </Tabs>
            </Box>
            <Stack spacing={2.5} role="tabpanel" id="statistics-panel" aria-labelledby={`statistics-${view}-tab`}>
                {view === 'person' && <Card variant="outlined"><CardContent>
                    <PersonSearch person={person} onChange={setPerson} />
                </CardContent></Card>}
                {view === 'person' && !person
                    ? <EmptyState message="Знайдіть та оберіть людину, щоб переглянути її статистику." />
                    : <StatisticsPanel key={view === 'person' ? `person-${person!.id}` : 'locations'} person={view === 'person' ? person : null} />}
            </Stack>
        </Stack>
    );
}

function personLabel(person: StatisticsPersonDto): string {
    return `${person.firstName} ${person.lastName} · ${formatUaPhone(person.phone)}`;
}

function PersonSearch({ person, onChange }: { person: StatisticsPersonDto | null; onChange: (person: StatisticsPersonDto | null) => void }) {
    const [input, setInput] = useState(person ? personLabel(person) : '');
    const [options, setOptions] = useState<StatisticsPersonDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    const search = input.trim();

    useEffect(() => {
        if (person || search.length < 3) return;
        const controller = new AbortController();
        const timeout = setTimeout(() => {
            setLoading(true);
            adminApi.searchStatisticsPeople(search, controller.signal)
                .then(matches => { if (!controller.signal.aborted) setOptions(matches); })
                .catch(e => { if (!controller.signal.aborted) setError(e instanceof ApiError ? e.message : 'Не вдалося знайти користувачів.'); })
                .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        }, 250);
        return () => { clearTimeout(timeout); controller.abort(); };
    }, [search, person, attempt]);

    return (
        <Stack spacing={1}>
            <Autocomplete
                value={person} inputValue={input} options={person ? [person] : options}
                filterOptions={matches => matches} getOptionLabel={personLabel}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                onChange={(_, value) => { onChange(value); setInput(value ? personLabel(value) : ''); setError(null); }}
                onInputChange={(_, value, reason) => {
                    if (reason === 'input' || reason === 'clear') {
                        setInput(value); setOptions([]); setError(null); setLoading(false); onChange(null);
                    }
                }}
                loading={loading} clearText="Очистити пошук" openText="Показати користувачів" closeText="Закрити список"
                loadingText="Шукаємо користувачів…"
                noOptionsText={search.length < 3 ? 'Введіть щонайменше 3 символи' : error ? 'Помилка пошуку' : 'Користувачів не знайдено'}
                forcePopupIcon={false}
                sx={{ '& .MuiAutocomplete-clearIndicator': { visibility: 'visible' } }}
                renderOption={(props, option) => {
                    const { key, ...rest } = props;
                    return <Box component="li" key={key} {...rest}>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ overflowWrap: 'anywhere' }}>{option.firstName} {option.lastName}</Typography>
                            <Typography variant="body2" color="text.secondary">{formatUaPhone(option.phone)}</Typography>
                        </Box>
                    </Box>;
                }}
                renderInput={params => <TextField {...params} label="Людина" placeholder="Ім’я, прізвище або телефон"
                    slotProps={{ ...params.slotProps, htmlInput: { ...params.slotProps.htmlInput, maxLength: 250 }, input: {
                        ...params.slotProps.input,
                        endAdornment: <>{loading && <CircularProgress size={18} aria-label="Пошук" />}{params.slotProps.input.endAdornment}</>,
                    } }} />}
            />
            {error && <ErrorState message={error} onRetry={() => { setError(null); setAttempt(value => value + 1); }} />}
        </Stack>
    );
}

function StatisticsPanel({ person }: { person: StatisticsPersonDto | null }) {
    const [catalog, setCatalog] = useState<StatisticsPeriodsDto | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    const personId = person?.id;
    useEffect(() => {
        const controller = new AbortController();
        adminApi.getStatisticsPeriods(personId, controller.signal)
            .then(data => { if (!controller.signal.aborted) setCatalog(data); })
            .catch(e => { if (!controller.signal.aborted) setError(e instanceof ApiError ? e.message : 'Не вдалося завантажити періоди.'); });
        return () => controller.abort();
    }, [personId, attempt]);

    if (error) return <ErrorState message={error} onRetry={() => { setError(null); setAttempt(value => value + 1); }} />;
    if (!catalog) return <StatisticsSkeleton includeFilters />;
    if (!catalog.months.length) return <EmptyState message={person
        ? 'У цієї людини ще немає нескасованих записів. Статистика з’явиться після першого запису.'
        : 'Ще немає нескасованих записів. Періоди та статистика з’являться після першого запису.'} />;
    return <PeriodStatistics catalog={catalog} person={person} />;
}

function PeriodStatistics({ catalog, person }: { catalog: StatisticsPeriodsDto; person: StatisticsPersonDto | null }) {
    const [type, setType] = useState<StatisticsPeriodType>('month');
    const [requested, setRequested] = useState<StatisticsPeriod | null>(null);
    const options = availablePeriods(catalog.months, type);
    const selected = resolvePeriod(options, requested, catalog.today)!;
    const years = [...new Set(options.map(option => option.year))];
    const values = options.filter(option => option.year === selected.year).sort((a, b) => a.value - b.value);

    return <Stack spacing={2.5}>
        <Card variant="outlined"><CardContent>
            <Stack spacing={2}>
                <ToggleButtonGroup value={type} exclusive fullWidth aria-label="Період статистики"
                    onChange={(_, value: StatisticsPeriodType | null) => {
                        if (value) { setType(value); setRequested(changePeriodType(selected, value)); }
                    }}>
                    <ToggleButton value="month">Місяць</ToggleButton>
                    <ToggleButton value="quarter">Квартал</ToggleButton>
                    <ToggleButton value="year">Рік</ToggleButton>
                </ToggleButtonGroup>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField select label="Рік" value={selected.year} fullWidth
                        onChange={event => setRequested({ ...selected, year: Number(event.target.value) })}>
                        {years.map(year => <MenuItem key={year} value={year}>{year}</MenuItem>)}
                    </TextField>
                    {type !== 'year' && <TextField select label={type === 'month' ? 'Місяць' : 'Квартал'} value={selected.value} fullWidth
                        onChange={event => setRequested({ ...selected, value: Number(event.target.value) })}>
                        {values.map(option => <MenuItem key={option.value} value={option.value}>
                            {type === 'month' ? MONTH_NAMES[option.value - 1] : `${option.value} квартал`}
                        </MenuItem>)}
                    </TextField>}
                </Stack>
            </Stack>
        </CardContent></Card>
        <StatisticsReport key={periodKey(selected)} period={selected} person={person} />
    </Stack>;
}
