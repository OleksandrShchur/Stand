import { useEffect, useState } from 'react';
import { Box, Card, CardActionArea, CardContent, Grid, LinearProgress, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { adminApi } from '../../api/adminApi';
import { ApiError } from '../../api/client';
import { LoadingState, ErrorState } from '../../components/StateMessage';
import type { DashboardDto, LocationFillRateDto } from '../../api/types';
import { formatDate } from '../../utils/date';

export default function AdminDashboardPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<DashboardDto | null>(null);

    const load = () => {
        setLoading(true);
        setError(null);
        adminApi
            .getDashboard()
            .then(setData)
            .catch((e) => setError(e instanceof ApiError ? e.message : 'Не вдалося завантажити дашборд.'))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    if (loading) return <LoadingState />;
    if (error) return <ErrorState message={error} onRetry={load} />;
    if (!data) return null;

    return (
        <Box>
            <Typography component="h1" variant="h4" sx={(theme) => ({
                mb: 2,
                [theme.breakpoints.down('sm')]: {
                    position: 'absolute', width: '1px', height: '1px', p: 0, m: '-1px',
                    overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap', border: 0,
                },
            })}>Огляд</Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <StatCard label="Записів на сьогодні" value={data.todayBookedCount} to={`/admin/bookings?date=${data.today}`} />
            </Grid>

            <Typography component="h2" variant="h6" sx={{ mb: 1.5 }}>Заповненість сьогодні за локаціями</Typography>
            <FillRateList items={data.todayByLocation} filters={{ date: data.today }} period="сьогодні" />

            <Typography component="h2" variant="h6" sx={{ mt: 3, mb: 1.5 }}>Загальна заповненість запису за локаціями</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{formatDate(data.today)} – {formatDate(data.horizonEnd)}</Typography>
            <FillRateList items={data.upcomingByLocation} filters={{ dateFrom: data.today, dateTo: data.horizonEnd }} period="за весь період" />
        </Box>
    );
}

function StatCard({ label, value, to }: { label: string; value: number; to: string }) {
    return (
        <Grid size={12}>
            <Card variant="outlined">
                <CardActionArea component={RouterLink} to={to} aria-label={`${label}: ${value}. Переглянути записи`}>
                <CardContent>
                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                    <Typography component="p" variant="h3" sx={{ fontWeight: 700, color: 'primary.main' }}>{value}</Typography>
                </CardContent>
                </CardActionArea>
            </Card>
        </Grid>
    );
}

function FillRateList({ items, filters, period }: { items: LocationFillRateDto[]; filters: Record<string, string>; period: string }) {
    return (
        <Stack spacing={1.5}>
            {items.map((loc) => (
                <Card key={loc.locationId} variant="outlined">
                    <CardActionArea component={RouterLink} to={`/admin/bookings?${new URLSearchParams({ ...filters, locationId: String(loc.locationId) })}`}
                        aria-label={`${loc.locationName}: записів ${loc.booked} ${period}. Переглянути записи`}>
                    <CardContent sx={{ py: 1.5 }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ mb: 0.75, gap: 0.5, justifyContent: 'space-between' }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{loc.locationName}</Typography>
                            <Typography variant="caption" color="text.secondary">
                                Записів: {loc.booked} · {loc.fillRatePercent}%
                            </Typography>
                        </Stack>
                        <LinearProgress
                            aria-label={`Заповненість: ${loc.locationName}`}
                            variant="determinate"
                            value={Math.min(100, loc.fillRatePercent)}
                            sx={{ height: 8, borderRadius: 4 }}
                        />
                    </CardContent>
                    </CardActionArea>
                </Card>
            ))}
        </Stack>
    );
}
