import { useEffect, useMemo, useState } from 'react';
import { Box, Button, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { publicApi } from '../../../api/publicApi';
import { ApiError } from '../../../api/client';
import { ErrorState, SkeletonList } from '../../../components/StateMessage';
import { dateRangeIso, formatDateFull, parseIsoDate, todayIso } from '../../../utils/date';
import DayCell from '../components/DayCell';
import StateBadge from '../components/StateBadge';
import { bookingCopy } from '../bookingCopy';

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'];

export default function DateStep({ selectedDate, onSelect, onContinue }: {
    selectedDate?: string;
    onSelect: (date: string) => void;
    onContinue: () => void;
}) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [bookable, setBookable] = useState<Set<string>>(new Set());
    const [pastDates, setPastDates] = useState<Set<string>>(new Set());
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
                setPastDates(new Set(cal.pastDates ?? []));
                setToday(todayIso());
                const firstDate = parseIsoDate(selectedDate ?? cal.earliestBookableDate);
                setMonth(new Date(firstDate.getFullYear(), firstDate.getMonth(), 1));
            })
            .catch((e) => setError(e instanceof ApiError ? e.message : 'Не вдалося завантажити календар.'))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const cells = useMemo(() => {
        const year = month.getFullYear();
        const monthNumber = String(month.getMonth() + 1).padStart(2, '0');
        const lastDay = new Date(year, month.getMonth() + 1, 0).getDate();
        const dates = dateRangeIso(`${year}-${monthNumber}-01`, `${year}-${monthNumber}-${lastDay}`);
        const offset = (month.getDay() + 6) % 7;
        return Array.from({ length: 42 }, (_, index) => dates[index - offset] ?? null);
    }, [month]);

    const changeMonth = (offset: number) => {
        setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
    };

    const monthLabel = `${month.toLocaleDateString('uk-UA', { month: 'long' })} ${month.getFullYear()}`;

    if (loading) return <SkeletonList rows={4} />;
    if (error) return <ErrorState message={error} onRetry={load} />;

    return (
        <Box sx={{ pb: selectedDate ? 12 : 0 }}>
            <Typography variant="h5" sx={{ mb: 2 }}>{bookingCopy.selectDate}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr) 44px', alignItems: 'center', mb: 2 }}>
                <Tooltip title="Попередній місяць">
                    <IconButton aria-label="Попередній місяць" onClick={() => changeMonth(-1)} sx={{ minWidth: 44, minHeight: 44 }}>
                        <ChevronLeftIcon />
                    </IconButton>
                </Tooltip>
                <Typography component="h2" variant="h6" aria-live="polite" sx={{ textAlign: 'center', textTransform: 'capitalize', fontSize: 18 }}>
                    {monthLabel}
                </Typography>
                <Tooltip title="Наступний місяць">
                    <IconButton aria-label="Наступний місяць" onClick={() => changeMonth(1)} sx={{ minWidth: 44, minHeight: 44 }}>
                        <ChevronRightIcon />
                    </IconButton>
                </Tooltip>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: { xs: 0.5, sm: 1 } }}>
                {WEEKDAYS.map((day) => (
                    <Typography key={day} variant="caption" sx={{ textAlign: 'center', fontWeight: 700, fontSize: 12, color: 'text.secondary', pb: 0.75 }}>
                        {day}
                    </Typography>
                ))}
                {cells.map((date, index) => date ? (
                    <DayCell
                        key={date}
                        date={date}
                        isAvailable={bookable.has(date) || pastDates.has(date)}
                        readOnly={pastDates.has(date)}
                        isSelected={selectedDate === date}
                        isToday={date === today}
                        onSelect={onSelect}
                    />
                ) : <Box key={`empty-${index}`} sx={{ aspectRatio: '1', minHeight: 44 }} />)}
            </Box>
            <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
                <StateBadge label={bookingCopy.available} tone="available" />
                <StateBadge label={bookingCopy.readOnly} tone="unavailable" />
            </Stack>
            {selectedDate && (bookable.has(selectedDate) || pastDates.has(selectedDate)) && (
                <Paper elevation={6} sx={{
                    position: 'fixed',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 10,
                    borderRadius: '8px 8px 0 0',
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    p: 1.5,
                    pb: 'max(12px, env(safe-area-inset-bottom))',
                }}>
                    <Stack direction="row" spacing={1.5} sx={{ maxWidth: 600, mx: 'auto', alignItems: 'center' }}>
                        <Typography sx={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700 }}>
                            {formatDateFull(selectedDate)}
                            {pastDates.has(selectedDate) && (
                                <Typography component="span" sx={{ display: 'block', fontSize: 12, color: 'text.secondary' }}>{bookingCopy.readOnly}</Typography>
                            )}
                        </Typography>
                        <Button variant="contained" onClick={onContinue}>{bookingCopy.next}</Button>
                    </Stack>
                </Paper>
            )}
        </Box>
    );
}
