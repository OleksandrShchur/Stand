import { useEffect, useState } from 'react';
import { Box, Card, CardContent, Grid, LinearProgress, Stack, Typography } from '@mui/material';
import { adminApi } from '../../api/adminApi';
import { ApiError } from '../../api/client';
import { LoadingState, ErrorState } from '../../components/StateMessage';
import type { DashboardDto, LocationFillRateDto } from '../../api/types';

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
            <Typography variant="h4" sx={{ display: { xs: 'none', sm: 'block' }, mb: 2 }}>Огляд</Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <StatCard label="Записів на сьогодні" value={data.todayBookedCount} />
            </Grid>

            <Typography variant="h6" sx={{ mb: 1.5 }}>Заповненість сьогодні за локаціями</Typography>
            <FillRateList items={data.todayByLocation} />

            <Typography variant="h6" sx={{ mt: 3, mb: 1.5 }}>Загальна заповненість запису за локаціями</Typography>
            <FillRateList items={data.upcomingByLocation} />
        </Box>
    );
}

function StatCard({ label, value }: { label: string; value: number }) {
    return (
        <Grid size={12}>
            <Card variant="outlined">
                <CardContent>
                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                    <Typography variant="h3" sx={{ fontWeight: 700, color: 'primary.main' }}>{value}</Typography>
                </CardContent>
            </Card>
        </Grid>
    );
}

function FillRateList({ items }: { items: LocationFillRateDto[] }) {
    return (
        <Stack spacing={1.5}>
            {items.map((loc) => (
                <Card key={loc.locationId} variant="outlined">
                    <CardContent sx={{ py: 1.5 }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ mb: 0.75, gap: 0.5, justifyContent: 'space-between' }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{loc.locationName}</Typography>
                            <Typography variant="caption" color="text.secondary">
                                Записів: {loc.booked} · {loc.fillRatePercent}%
                            </Typography>
                        </Stack>
                        <LinearProgress
                            variant="determinate"
                            value={Math.min(100, loc.fillRatePercent)}
                            sx={{ height: 8, borderRadius: 4 }}
                        />
                    </CardContent>
                </Card>
            ))}
        </Stack>
    );
}
