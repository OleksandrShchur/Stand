import { useEffect, useState } from 'react';
import {
    Box, Button, Card, CardActionArea, CardContent, Grid, LinearProgress, Stack,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { adminApi } from '../../api/adminApi';
import { ApiError } from '../../api/client';
import type { StatisticsDto, StatisticsPersonDto, StatisticsTrendDto } from '../../api/types';
import { ErrorState, LoadingState } from '../../components/StateMessage';
import { formatDate } from '../../utils/date';
import { MONTH_NAMES, periodLabel, type StatisticsPeriod } from './statisticsModel';

const number = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 });
const formatNumber = (value: number) => number.format(value);
const percent = (value: number | null) => value === null ? '—' : `${formatNumber(value)}%`;

export default function StatisticsReport({ period, person }: { period: StatisticsPeriod; person: StatisticsPersonDto | null }) {
    const [data, setData] = useState<StatisticsDto | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    const { period: type, year, value } = period;
    const personId = person?.id;

    useEffect(() => {
        const controller = new AbortController();
        adminApi.getStatistics({ period: type, year,
            month: type === 'month' ? value : undefined,
            quarter: type === 'quarter' ? value : undefined, personId,
        }, controller.signal)
            .then(result => { if (!controller.signal.aborted) setData(result); })
            .catch(e => { if (!controller.signal.aborted) setError(e instanceof ApiError ? e.message : 'Не вдалося завантажити статистику.'); });
        return () => controller.abort();
    }, [type, year, value, personId, attempt]);

    if (error) return <ErrorState message={error} onRetry={() => { setError(null); setAttempt(value => value + 1); }} />;
    if (!data) return <LoadingState label="Завантажуємо статистику…" />;

    const { summary } = data;
    const filters = new URLSearchParams({ dateFrom: data.dateFrom, dateTo: data.dateTo, isBooked: 'true' });
    if (person) filters.set('phone', person.phone);
    const bookingsUrl = `/admin/bookings?${filters}`;

    return <Stack spacing={2.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
            <Box aria-live="polite">
                <Typography component="h2" variant="h6">{periodLabel(period)}</Typography>
                <Typography variant="body2" color="text.secondary">{formatDate(data.dateFrom)} — {formatDate(data.dateTo)}</Typography>
            </Box>
            <Button component={RouterLink} to={bookingsUrl} variant="outlined">Переглянути записи</Button>
        </Stack>
        <Grid container spacing={1.5}>
            <Metric label="Записи" value={formatNumber(summary.booked)} description="Без скасованих" />
            <Metric label="Години чергувань" value={formatNumber(summary.bookedHours)} description="Сума тривалості записів" />
            {person
                ? <Metric label="Локації" value={formatNumber(summary.locationCount)} description="Де є записи людини" />
                : <Metric label="Заповненість" value={percent(summary.fillRatePercent)}
                    description={summary.scheduledPlaces ? `${formatNumber(summary.scheduledPlaces)} місць у розкладі` : 'Немає збереженого розкладу'} />}
            <Metric label="Дні з записами" value={formatNumber(summary.activeDays)} description="Унікальні дати чергувань" />
        </Grid>

        <Card variant="outlined"><CardContent>
            <Stack spacing={2}>
                <Box>
                    <Typography component="h2" variant="h6">Динаміка записів</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {type === 'month' ? 'Кількість записів за днями' : 'Кількість записів за місяцями'}
                    </Typography>
                </Box>
                <TrendChart points={data.trend} daily={type === 'month'} />
            </Stack>
        </CardContent></Card>

        <Stack spacing={1.5}>
            <Typography component="h2" variant="h6">{person ? 'Локації людини' : 'Порівняння локацій'}</Typography>
            <Grid container spacing={1.5}>
                {data.byLocation.map(location => {
                    const locationFilters = new URLSearchParams(filters);
                    locationFilters.set('locationId', String(location.locationId));
                    const share = Math.round(100 * location.booked / summary.booked);
                    const progress = person ? share : location.fillRatePercent;
                    return <Grid key={location.locationId} size={{ xs: 12, lg: 6 }}>
                        <Card variant="outlined" sx={{ height: '100%' }}>
                            <CardActionArea component={RouterLink} to={`/admin/bookings?${locationFilters}`} sx={{ height: '100%' }}
                                aria-label={`${location.locationName}: ${location.booked} записів. Переглянути записи`}>
                                <CardContent>
                                    <Stack spacing={1.5}>
                                        <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{location.locationName}</Typography>
                                        <Stack direction="row" spacing={3}>
                                            <Box><Typography variant="h5" component="p">{formatNumber(location.booked)}</Typography>
                                                <Typography variant="body2" color="text.secondary">Записи</Typography></Box>
                                            <Box><Typography variant="h5" component="p">{formatNumber(location.bookedHours)}</Typography>
                                                <Typography variant="body2" color="text.secondary">Години</Typography></Box>
                                        </Stack>
                                        <Box>
                                            <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', mb: 0.75 }}>
                                                <Typography variant="caption" color="text.secondary">{person ? 'Частка записів людини' : 'Заповненість'}</Typography>
                                                <Typography variant="caption" sx={{ fontWeight: 600 }}>{percent(progress)}</Typography>
                                            </Stack>
                                            <LinearProgress variant="determinate" value={Math.min(100, progress ?? 0)}
                                                aria-label={`${person ? 'Частка записів' : 'Заповненість'}: ${location.locationName}`}
                                                aria-valuetext={progress === null ? 'Немає збереженого розкладу' : `${progress}%`}
                                                sx={{ height: 7, borderRadius: 4 }} />
                                        </Box>
                                    </Stack>
                                </CardContent>
                            </CardActionArea>
                        </Card>
                    </Grid>;
                })}
            </Grid>
            {!person && <Typography variant="caption" color="text.secondary">
                Заповненість — частка записів від кількості місць у збереженому розкладі. «—» означає, що розкладу немає.
                Якщо інтервали прибрали, а записи зберегли, значення може перевищувати 100%.
            </Typography>}
        </Stack>
    </Stack>;
}

function Metric({ label, value, description }: { label: string; value: string; description: string }) {
    return <Grid size={{ xs: 6, md: 3 }}>
        <Card variant="outlined" sx={{ height: '100%' }}><CardContent sx={{ px: { xs: 1.5, sm: 2 }, height: '100%' }}>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
            <Typography component="p" variant="h4" sx={{ color: 'primary.main', fontWeight: 700, my: 0.75, overflowWrap: 'anywhere' }}>{value}</Typography>
            <Typography variant="caption" color="text.secondary">{description}</Typography>
        </CardContent></Card>
    </Grid>;
}

function TrendChart({ points, daily }: { points: StatisticsTrendDto[]; daily: boolean }) {
    const max = Math.max(1, ...points.map(point => point.booked));
    const width = 720;
    const height = 180;
    const column = width / points.length;
    const label = (date: string) => daily ? formatDate(date) : `${MONTH_NAMES[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;
    const axisLabel = (date: string) => daily ? String(Number(date.slice(8, 10))) : date.slice(5, 7);

    return <Stack spacing={1.5}>
        <Stack direction="row" spacing={1}>
            <Stack aria-hidden="true" sx={{ height, justifyContent: 'space-between', minWidth: 30, textAlign: 'right' }}>
                <Typography variant="caption" color="text.secondary">{formatNumber(max)}</Typography>
                <Typography variant="caption" color="text.secondary">0</Typography>
            </Stack>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box component="svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"
                    role="img" aria-label={`Динаміка записів ${daily ? 'за днями' : 'за місяцями'}. Точні значення доступні в таблиці під графіком.`}
                    sx={{ display: 'block', width: '100%', height, color: 'primary.main', overflow: 'visible' }}>
                    <line x1="0" x2={width} y1="1" y2="1" stroke="currentColor" opacity="0.12" />
                    <line x1="0" x2={width} y1={height / 2} y2={height / 2} stroke="currentColor" opacity="0.12" />
                    <line x1="0" x2={width} y1={height} y2={height} stroke="currentColor" opacity="0.25" />
                    {points.map((point, index) => {
                        const barHeight = point.booked / max * (height - 8);
                        return <rect key={point.date} x={index * column + column * 0.18} y={height - barHeight}
                            width={column * 0.64} height={barHeight} rx="3" fill="currentColor">
                            <title>{label(point.date)}: {point.booked} записів, {formatNumber(point.bookedHours)} год.</title>
                        </rect>;
                    })}
                </Box>
                <Box aria-hidden="true" sx={{ display: 'grid', gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))`, mt: 0.75 }}>
                    {points.map((point, index) => <Typography key={point.date} variant="caption" color="text.secondary"
                        sx={{ textAlign: 'center', fontSize: { xs: '0.625rem', sm: '0.75rem' }, visibility: !daily || index % 5 === 0 || index === points.length - 1 ? 'visible' : 'hidden' }}>
                        {axisLabel(point.date)}
                    </Typography>)}
                </Box>
            </Box>
        </Stack>
        <Box component="details">
            <Box component="summary" sx={{ cursor: 'pointer', color: 'primary.main', typography: 'body2', py: 1, minHeight: 44 }}>
                Дані графіка
            </Box>
            <TableContainer><Table size="small" aria-label="Дані динаміки записів">
                <TableHead><TableRow>
                    <TableCell>{daily ? 'Дата' : 'Місяць'}</TableCell><TableCell align="right">Записи</TableCell><TableCell align="right">Години</TableCell>
                </TableRow></TableHead>
                <TableBody>{points.map(point => <TableRow key={point.date}>
                    <TableCell component="th" scope="row">{label(point.date)}</TableCell>
                    <TableCell align="right">{formatNumber(point.booked)}</TableCell>
                    <TableCell align="right">{formatNumber(point.bookedHours)}</TableCell>
                </TableRow>)}</TableBody>
            </Table></TableContainer>
        </Box>
    </Stack>;
}
