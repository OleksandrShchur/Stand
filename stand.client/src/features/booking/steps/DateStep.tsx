import { useEffect, useState } from 'react';
import { Box, Button, IconButton, Tooltip, Typography } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { publicApi } from '../../../api/publicApi';
import { ApiError } from '../../../api/client';
import { LoadingState, ErrorState } from '../../../components/StateMessage';
import { dateRangeIso, formatDateFull, parseIsoDate, todayIso } from '../../../utils/date';

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'];

export default function DateStep({ onSelect }: { onSelect: (date: string) => void }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [bookable, setBookable] = useState<Set<string>>(new Set());
    const [month, setMonth] = useState(() => {
        const today = parseIsoDate(todayIso());
        return new Date(today.getFullYear(), today.getMonth(), 1);
    });
    const [today, setToday] = useState(todayIso());

    const load = () => {
        setLoading(true);
        setError(null);
        publicApi.getCalendar()
            .then((cal) => {
                setBookable(new Set(cal.bookableDates));
                setToday(cal.earliestBookableDate);
                const firstDate = parseIsoDate(cal.earliestBookableDate);
                setMonth(new Date(firstDate.getFullYear(), firstDate.getMonth(), 1));
            })
            .catch((e) => setError(e instanceof ApiError ? e.message : 'Не вдалося завантажити календар.'))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const changeMonth = (offset: number) => {
        setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
    };

    const year = month.getFullYear();
    const monthNumber = String(month.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(year, month.getMonth() + 1, 0).getDate();
    const dates = dateRangeIso(`${year}-${monthNumber}-01`, `${year}-${monthNumber}-${lastDay}`);
    const offset = (month.getDay() + 6) % 7;
    const cells = Array.from({ length: 42 }, (_, index) => dates[index - offset] ?? null);
    const monthLabel = month.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });

    if (loading) return <LoadingState label="Завантажуємо доступні дати…" />;
    if (error) return <ErrorState message={error} onRetry={load} />;

    return (
        <Box>
            <Typography variant="h5" sx={{ mb: 2 }}>Оберіть дату</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '40px minmax(0, 1fr) 40px', alignItems: 'center', mb: 2 }}>
                <Tooltip title="Попередній місяць">
                    <IconButton aria-label="Попередній місяць" onClick={() => changeMonth(-1)}>
                        <ChevronLeftIcon />
                    </IconButton>
                </Tooltip>
                <Typography component="h2" variant="h6" aria-live="polite"
                    sx={{ textAlign: 'center', textTransform: 'capitalize', fontSize: 18 }}>
                    {monthLabel}
                </Typography>
                <Tooltip title="Наступний місяць">
                    <IconButton aria-label="Наступний місяць" onClick={() => changeMonth(1)}>
                        <ChevronRightIcon />
                    </IconButton>
                </Tooltip>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: { xs: 0.5, sm: 1 } }}>
                {WEEKDAYS.map((day) => (
                    <Typography key={day} variant="caption" color="text.secondary"
                        sx={{ textAlign: 'center', fontWeight: 600, pb: 0.75 }}>
                        {day}
                    </Typography>
                ))}
                {cells.map((date, index) => {
                    if (!date) return <Box key={`empty-${index}`} sx={{ aspectRatio: '1' }} />;
                    const isBookable = bookable.has(date);
                    return (
                        <Button key={date} variant={isBookable ? 'contained' : 'outlined'}
                            aria-label={`${formatDateFull(date)}${isBookable ? ', доступна для запису' : ''}`}
                            aria-current={date === today ? 'date' : undefined}
                            onClick={() => onSelect(date)}
                            sx={{
                                minWidth: 0, width: '100%', aspectRatio: '1', p: 0, borderRadius: 1,
                                fontSize: 16, fontWeight: 600,
                                color: isBookable ? 'common.white' : 'text.primary',
                                bgcolor: isBookable ? 'primary.main' : 'background.paper',
                                borderColor: date === today ? 'primary.main' : 'divider',
                                '&:hover': {
                                    bgcolor: isBookable ? 'primary.dark' : 'action.hover',
                                    borderColor: 'primary.main',
                                },
                            }}>
                            {parseIsoDate(date).getDate()}
                        </Button>
                    );
                })}
            </Box>
        </Box>
    );
}
