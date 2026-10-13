import { useEffect, useState } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import { publicApi } from '../../../api/publicApi';
import { ApiError } from '../../../api/client';
import { LoadingState, ErrorState, EmptyState } from '../../../components/StateMessage';
import { dateRangeIso, formatDateHuman, formatWeekdayShort } from '../../../utils/date';

export default function DateStep({ onSelect }: { onSelect: (date: string) => void }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [bookable, setBookable] = useState<Set<string>>(new Set());
    const [windowDates, setWindowDates] = useState<string[]>([]);

    const load = () => {
        setLoading(true);
        setError(null);
        publicApi
            .getCalendar()
            .then((cal) => {
                setBookable(new Set(cal.bookableDates));
                setWindowDates(dateRangeIso(cal.earliestBookableDate, cal.latestBookableDate));
            })
            .catch((e) => setError(e instanceof ApiError ? e.message : 'Не вдалося завантажити календар.'))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    if (loading) return <LoadingState label="Завантажуємо доступні дати…" />;
    if (error) return <ErrorState message={error} onRetry={load} />;

    return (
        <Box>
            <Typography variant="h5" sx={{ mb: 0.5 }}>Оберіть дату</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                Доступні дні чергування позначені зеленим.
            </Typography>

            {bookable.size === 0 ? (
                <EmptyState message="Наразі немає доступних днів для запису. Спробуйте пізніше." />
            ) : (
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))',
                        gap: 1.25,
                    }}
                >
                    {windowDates.map((date) => {
                        const isBookable = bookable.has(date);
                        return (
                            <Paper
                                key={date}
                                elevation={0}
                                onClick={isBookable ? () => onSelect(date) : undefined}
                                sx={{
                                    p: 1.25,
                                    textAlign: 'center',
                                    cursor: isBookable ? 'pointer' : 'default',
                                    border: '1.5px solid',
                                    borderColor: isBookable ? 'primary.main' : 'divider',
                                    bgcolor: isBookable ? 'primary.main' : 'background.paper',
                                    color: isBookable ? 'common.white' : 'text.disabled',
                                    opacity: isBookable ? 1 : 0.55,
                                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                                    '&:hover': isBookable ? { transform: 'translateY(-2px)', boxShadow: 3 } : undefined,
                                }}
                            >
                                <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, opacity: 0.85 }}>
                                    {formatWeekdayShort(date)}
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                    {formatDateHuman(date)}
                                </Typography>
                            </Paper>
                        );
                    })}
                </Box>
            )}

            <Stack direction="row" spacing={1} sx={{ mt: 3, opacity: 0.7, alignItems: 'center' }}>
                <EventAvailableIcon fontSize="small" color="success" />
                <Typography variant="caption" color="text.secondary">
                    Запис можливий на сьогодні (не раніше ніж за годину до початку) та на 14 днів наперед.
                </Typography>
            </Stack>
        </Box>
    );
}
