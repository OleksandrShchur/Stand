import { useEffect, useMemo, useState } from 'react';
import {
    Box, Button, Card, CardContent, Checkbox, CircularProgress, FormControlLabel, FormGroup, IconButton,
    Stack, ToggleButton, Typography,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { adminApi } from '../../api/adminApi';
import { ApiError } from '../../api/client';
import { LoadingState, ErrorState } from '../../components/StateMessage';
import { formatDate } from '../../utils/date';

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const WEEKDAY_OPTIONS = [
    { value: 1, label: 'Пн' }, { value: 2, label: 'Вт' }, { value: 3, label: 'Ср' },
    { value: 4, label: 'Чт' }, { value: 5, label: 'Пт' }, { value: 6, label: 'Сб' }, { value: 0, label: 'Нд' },
];
const MONTH_NAMES = [
    'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
    'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
];

function pad(n: number) { return String(n).padStart(2, '0'); }
function iso(y: number, m: number, d: number) { return `${y}-${pad(m)}-${pad(d)}`; }

export default function AdminDatesPage() {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeMap, setActiveMap] = useState<Record<string, boolean>>({});
    const [bulkWeekdays, setBulkWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
    const [bulkBusy, setBulkBusy] = useState(false);
    const [pendingDate, setPendingDate] = useState<string | null>(null);

    const daysInMonth = new Date(year, month, 0).getDate();
    const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7; // 0=Mon

    const load = () => {
        setLoading(true);
        setError(null);
        const from = iso(year, month, 1);
        const to = iso(year, month, daysInMonth);
        adminApi.listDates(from, to)
            .then((items) => {
                const map: Record<string, boolean> = {};
                items.forEach((i) => { map[i.date] = i.isActive; });
                setActiveMap(map);
            })
            .catch((e) => setError(e instanceof ApiError ? e.message : 'Не вдалося завантажити дати.'))
            .finally(() => setLoading(false));
    };

    useEffect(load, [year, month]);

    const changeMonth = (delta: number) => {
        let m = month + delta;
        let y = year;
        if (m < 1) { m = 12; y -= 1; }
        if (m > 12) { m = 1; y += 1; }
        setMonth(m);
        setYear(y);
    };

    const toggleDay = (date: string) => {
        if (pendingDate || bulkBusy) return;
        const next = !activeMap[date];
        setPendingDate(date);
        setActiveMap((m) => ({ ...m, [date]: next }));
        adminApi.setDate(date, next)
            .catch(() => {
                setActiveMap((m) => ({ ...m, [date]: !next }));
                setError('Не вдалося зберегти дату. Спробуйте ще раз.');
            })
            .finally(() => setPendingDate(null));
    };

    const runBulk = (isActive: boolean) => {
        setBulkBusy(true);
        adminApi.bulkDates(year, month, bulkWeekdays, isActive)
            .then(load)
            .catch((e) => setError(e instanceof ApiError ? e.message : 'Не вдалося виконати масову операцію.'))
            .finally(() => setBulkBusy(false));
    };

    const cells = useMemo(() => {
        const result: { date: string | null; day: number | null }[] = [];
        for (let i = 0; i < firstWeekday; i++) result.push({ date: null, day: null });
        for (let d = 1; d <= daysInMonth; d++) result.push({ date: iso(year, month, d), day: d });
        return result;
    }, [year, month, firstWeekday, daysInMonth]);

    return (
        <Box>
            <Typography variant="h4" sx={{ mb: 2 }}>Доступні дати (білий список)</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Користувачі можуть записатися лише на дати, позначені тут як доступні, у межах сьогодні…+14 днів (слоти на сьогодні — не раніше ніж за годину до початку).
            </Typography>

            <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                    <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
                        <IconButton disabled={bulkBusy || !!pendingDate || loading} onClick={() => changeMonth(-1)}><ChevronLeftIcon /></IconButton>
                        <Typography variant="h6">{MONTH_NAMES[month - 1]} {year}</Typography>
                        <IconButton disabled={bulkBusy || !!pendingDate || loading} onClick={() => changeMonth(1)}><ChevronRightIcon /></IconButton>
                    </Stack>

                    {error && <Box sx={{ mb: 2 }}><ErrorState message={error} onRetry={load} /></Box>}
                    {loading ? <LoadingState /> : (
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.75 }}>
                            {WEEKDAY_LABELS.map((w) => (
                                <Typography key={w} variant="caption" align="center" color="text.secondary" sx={{ fontWeight: 700 }}>{w}</Typography>
                            ))}
                            {cells.map((c, idx) => c.date ? (
                                <ToggleButton
                                    key={c.date}
                                    value={c.date}
                                    disabled={bulkBusy || !!pendingDate}
                                    aria-label={`${formatDate(c.date)}${pendingDate === c.date ? ', зберігаємо' : ''}`}
                                    selected={!!activeMap[c.date]}
                                    onChange={() => toggleDay(c.date!)}
                                    size="small"
                                    sx={{
                                        borderRadius: 1,
                                        aspectRatio: '1',
                                        fontWeight: 700,
                                        '&.Mui-selected': { bgcolor: 'primary.main', color: 'common.white', '&:hover': { bgcolor: 'primary.dark' } },
                                    }}
                                >
                                    {pendingDate === c.date ? <CircularProgress size={18} color="inherit" aria-label="Зберігаємо дату" /> : c.day}
                                </ToggleButton>
                            ) : <Box key={`empty-${idx}`} />)}
                        </Box>
                    )}
                </CardContent>
            </Card>

            <Card variant="outlined">
                <CardContent>
                    <Typography variant="h6" sx={{ mb: 1.5 }}>Масове увімкнення / вимкнення</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                        Застосовується до обраних днів тижня в межах {MONTH_NAMES[month - 1]} {year}.
                    </Typography>
                    <FormGroup row sx={{ mb: 2 }}>
                        {WEEKDAY_OPTIONS.map((opt) => (
                            <FormControlLabel
                                key={opt.value}
                                control={
                                    <Checkbox
                                        checked={bulkWeekdays.includes(opt.value)}
                                        onChange={(e) => {
                                            setBulkWeekdays((prev) =>
                                                e.target.checked ? [...prev, opt.value] : prev.filter((v) => v !== opt.value));
                                        }}
                                    />
                                }
                                label={opt.label}
                            />
                        ))}
                    </FormGroup>
                    <Stack direction="row" spacing={1.5}>
                        <Button loading={bulkBusy} variant="contained" disabled={loading || !!pendingDate} onClick={() => runBulk(true)}>Увімкнути обрані дні</Button>
                        <Button loading={bulkBusy} variant="outlined" color="error" disabled={loading || !!pendingDate} onClick={() => runBulk(false)}>Вимкнути обрані дні</Button>
                    </Stack>
                </CardContent>
            </Card>
        </Box>
    );
}
