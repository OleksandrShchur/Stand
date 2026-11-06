import { Box, Card, CardContent, Grid, Skeleton, Stack } from '@mui/material';

/** Mirrors the report layout so loading a different period keeps the page steady. */
export default function StatisticsSkeleton({ includeFilters = false }: { includeFilters?: boolean }) {
    return <Box role="status" aria-label="Завантажуємо статистику…">
        <Stack spacing={2.5} aria-hidden="true">
            {includeFilters && <Card variant="outlined"><CardContent>
                <Stack spacing={2}>
                    <Skeleton variant="rounded" height={44} />
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <Skeleton variant="rounded" height={56} sx={{ width: '100%', minWidth: 0, flex: { sm: 1 } }} />
                        <Skeleton variant="rounded" height={56} sx={{ width: '100%', minWidth: 0, flex: { sm: 1 } }} />
                    </Stack>
                </Stack>
            </CardContent></Card>}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
                <Box>
                    <Skeleton width={160} height={28} />
                    <Skeleton width={190} height={20} />
                </Box>
                <Skeleton variant="rounded" height={44} sx={{ width: { xs: '100%', sm: 180 } }} />
            </Stack>

            <Grid container spacing={1.5}>
                {[0, 1].map(index => <Grid key={index} size={6}>
                    <Card variant="outlined"><CardContent sx={{ px: { xs: 1.5, sm: 2 } }}>
                        <Skeleton width="70%" height={20} />
                        <Skeleton width="45%" height={38} sx={{ my: 0.75 }} />
                        <Skeleton width="90%" height={18} />
                    </CardContent></Card>
                </Grid>)}
            </Grid>

            <Card variant="outlined"><CardContent>
                <Stack spacing={2}>
                    <Box>
                        <Skeleton width="55%" height={28} />
                        <Skeleton width="70%" height={20} />
                    </Box>
                    <Skeleton variant="rounded" height={180} />
                    <Skeleton width={120} height={24} />
                </Stack>
            </CardContent></Card>

            <Stack spacing={1.5}>
                <Skeleton width={180} height={28} />
                <Grid container spacing={1.5}>
                    {[0, 1, 2, 3].map(index => <Grid key={index} size={{ xs: 12, lg: 6 }}>
                        <Card variant="outlined"><CardContent>
                            <Stack spacing={1.5}>
                                <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                                    <Skeleton width="55%" height={24} />
                                    <Skeleton width="25%" height={24} />
                                </Stack>
                                <Box>
                                    <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                                        <Skeleton width="45%" height={18} />
                                        <Skeleton width={32} height={18} />
                                    </Stack>
                                    <Skeleton variant="rounded" height={7} sx={{ mt: 0.75 }} />
                                </Box>
                            </Stack>
                        </CardContent></Card>
                    </Grid>)}
                </Grid>
            </Stack>
        </Stack>
    </Box>;
}
