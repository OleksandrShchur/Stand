import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Container, IconButton, Snackbar, Stack, Tooltip, Typography } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { publicApi } from '../../../api/publicApi';
import { ApiError } from '../../../api/client';
import { ErrorState, SkeletonList } from '../../../components/StateMessage';
import { dateRangeIso, formatDateHuman, parseIsoDate } from '../../../utils/date';
import type { CalendarDto } from '../../../api/types';
import { getKyivDateTime } from '../slotTimeStatus';
import { pagePadding } from '../../../layoutSpacing';
import DayCell from '../components/DayCell';
import StateBadge from '../components/StateBadge';
import { bookingCopy } from '../bookingCopy';
import { loadCalendarWithAvailability } from '../locationAvailability';

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
    const [readOnlyDates, setReadOnlyDates] = useState<Set<string>>(new Set());
    const [bookingWindow, setBookingWindow] = useState<{ first: string; last: string } | null>(null);
    const [dateHint, setDateHint] = useState<{ message: string; key: number } | null>(null);
    const [month, setMonth] = useState(() => {
        const today = parseIsoDate(selectedDate ?? getKyivDateTime(new Date()).date);
        return new Date(today.getFullYear(), today.getMonth(), 1);
    });
    const [today, setToday] = useState(() => getKyivDateTime(new Date()).date);

    const applyCalendar = useCallback((cal: CalendarDto) => {
        setBookable(new Set(cal.bookableDates));
        setReadOnlyDates(new Set([...(cal.pastDates ?? []), ...(cal.readOnlyDates ?? [])]));
        setBookingWindow({ first: cal.earliestBookableDate, last: cal.latestBookableDate });
        setToday(cal.earliestBookableDate);
    }, []);

    const load = () => {
        setLoading(true);
        setError(null);
        loadCalendarWithAvailability(publicApi)
            .then(applyCalendar)
            .catch((e) => setError(e instanceof ApiError ? e.message : 'Не вдалося завантажити календар.'))
            .finally(() => setLoading(false));
    };

    useEffect(load, [applyCalendar]);

    useEffect(() => {
        let active = true;
        const refresh = () => {
            loadCalendarWithAvailability(publicApi).then((calendar) => {
                if (active) applyCalendar(calendar);
            }).catch(() => { /* Keep the last calendar when a background refresh fails. */ });
        };
        const timer = setInterval(refresh, 30000);
        window.addEventListener('focus', refresh);
        return () => {
            active = false;
            clearInterval(timer);
            window.removeEventListener('focus', refresh);
        };
    }, [applyCalendar]);

    const cells = useMemo(() => {
        const year = month.getFullYear();
        const monthNumber = String(month.getMonth() + 1).padStart(2, '0');
        const lastDay = new Date(year, month.getMonth() + 1, 0).getDate();
        const dates = dateRangeIso(`${year}-${monthNumber}-01`, `${year}-${monthNumber}-${lastDay}`);
        const offset = (month.getDay() + 6) % 7;
        return Array.from({ length: 42 }, (_, index) => dates[index - offset] ?? null);
    }, [month]);

    const changeMonth = (offset: number) => {
        setDateHint(null);
        setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
    };

    const explainUnavailableDate = (date: string) => {
        const reason = bookingWindow && date > bookingWindow.last
            ? `Запис відкрито лише до ${formatDateHuman(bookingWindow.last)}.`
            : bookingWindow && date < bookingWindow.first
                ? 'На цю дату немає змін для перегляду.'
                : 'Запис на цю дату не відкрито. Оберіть доступний день.';
        setDateHint({ message: `${formatDateHuman(date)}: ${reason}`, key: Date.now() });
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
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)', p: 1 }}>
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
                            isAvailable={bookable.has(date) || readOnlyDates.has(date)}
                            readOnly={readOnlyDates.has(date)}
                            isSelected={selectedDate === date}
                            isToday={date === today}
                            onSelect={(date) => {
                                setDateHint(null);
                                onSelect(date);
                            }}
                            onUnavailable={explainUnavailableDate}
                        />
                    ) : <Box key={`empty-${index}`} sx={{ aspectRatio: '1', minHeight: 44 }} />)}
                </Box>
            </Box>
            <Snackbar
                key={dateHint?.key}
                open={Boolean(dateHint)}
                autoHideDuration={16000}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                onClose={(_, reason) => { if (reason !== 'clickaway') setDateHint(null); }}
                sx={{ top: 'max(16px, env(safe-area-inset-top, 0px)) !important' }}
            >
                <Alert severity="warning" variant="filled" onClose={() => setDateHint(null)} sx={{ width: '100%', maxWidth: 568, boxShadow: 3 }}>
                    {dateHint?.message}
                </Alert>
            </Snackbar>
            <Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: (theme) => theme.zIndex.appBar, bgcolor: 'background.default', borderTop: '1px solid', borderColor: 'divider', boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.06)', pb: 'env(safe-area-inset-bottom, 0px)' }}>
                <Container maxWidth="sm" sx={{ ...pagePadding, py: 2 }}>
                    <Stack direction="row" spacing={1}>
                        <Button variant="outlined" size="large" onClick={onBack} sx={{ minHeight: 56, flex: '1 1 0', minWidth: 0 }}>
                            {bookingCopy.back}
                        </Button>
                        <Button variant="contained" size="large" onClick={onContinue} disabled={!selectedDate || (!bookable.has(selectedDate) && !readOnlyDates.has(selectedDate))} sx={{ minHeight: 56, flex: '1 1 0', minWidth: 0 }}>
                            {bookingCopy.next}
                        </Button>
                    </Stack>
                </Container>
            </Box>
        </Box>
    );
}
