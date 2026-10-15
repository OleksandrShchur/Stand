import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Container, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { publicApi } from '../../../api/publicApi';
import { ApiError } from '../../../api/client';
import { ErrorState, SkeletonList } from '../../../components/StateMessage';
import { dateRangeIso, parseIsoDate, todayIso } from '../../../utils/date';
import { pagePadding } from '../../../layoutSpacing';
import DayCell from '../components/DayCell';
import StateBadge from '../components/StateBadge';
import { bookingCopy } from '../bookingCopy';

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'];

export default function DateStep({ selectedDate, onSelect, onContinue, onBack }: {
    selectedDate?: string;
    onSelect: (date: string) => void;
    onContinue: () => void;
    onBack: () => void;
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
        <Box sx={{ pb: 'calc(104px + env(safe-area-inset-bottom, 0px))' }}>
            <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="h5">{bookingCopy.selectDate}</Typography>
                <Stack direction="row" spacing={0.5}>
                    <StateBadge label={bookingCopy.available} tone="available" />
                    <StateBadge label={bookingCopy.readOnly} tone="unavailable" />
                </Stack>
            </Stack>
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
            <Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: (theme) => theme.zIndex.appBar, bgcolor: 'background.default', borderTop: '1px solid', borderColor: 'divider', boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.06)', pb: 'env(safe-area-inset-bottom, 0px)' }}>
                <Container maxWidth="sm" sx={{ ...pagePadding, py: 2 }}>
                    <Stack direction="row" spacing={1}>
                        <Button variant="outlined" size="large" onClick={onBack} sx={{ minHeight: 56, flex: '1 1 0', minWidth: 0 }}>
                            {bookingCopy.back}
                        </Button>
                        <Button variant="contained" size="large" onClick={onContinue} disabled={!selectedDate || (!bookable.has(selectedDate) && !pastDates.has(selectedDate))} sx={{ minHeight: 56, flex: '1 1 0', minWidth: 0 }}>
                            {bookingCopy.next}
                        </Button>
                    </Stack>
                </Container>
            </Box>
        </Box>
    );
}
