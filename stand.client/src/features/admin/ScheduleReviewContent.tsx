import {
    Accordion, AccordionDetails, AccordionSummary, Alert, AlertTitle, Box, Chip, Stack,
    Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import type { LocationAdminDto, SaveScheduleDto, ScheduleSaveResultDto } from '../../api/types';
import { formatDate } from '../../utils/date';

interface Props {
    schedule: SaveScheduleDto;
    result: ScheduleSaveResultDto;
    locations: LocationAdminDto[];
}

export default function ScheduleReviewContent({ schedule, result, locations }: Props) {
    const intervalCount = schedule.locations.reduce((count, location) => count + location.slots.length, 0);
    const dates = <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1 }}>
        {schedule.dates.map(date => <Chip key={date} label={formatDate(date)} variant="outlined" size="small" />)}
    </Stack>;

    return <Stack spacing={2} data-testid="schedule-review-content">
        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
            <Stack spacing={1.5}>
                <Box>
                    <Typography variant="body2" color="text.secondary">{schedule.dates.length === 1 ? 'Дата розкладу' : 'Обрані дати'}</Typography>
                    <Typography component="p" variant="h6" sx={{ mt: 0.25, fontWeight: 700 }}>
                        {schedule.dates.length === 1 ? formatDate(schedule.dates[0]) : `Дат: ${result.updatedDates}`}
                    </Typography>
                </Box>
                <Chip label={schedule.isActive ? 'Відкрито для запису' : 'Закрито для запису'} color={schedule.isActive ? 'success' : 'default'}
                    size="small" sx={{ alignSelf: 'flex-start', maxWidth: '100%' }} />
                {schedule.dates.length > 1 && schedule.dates.length <= 3 && dates}
                {schedule.dates.length > 3 && <Accordion disableGutters elevation={0} variant="outlined" sx={{ boxShadow: 'none' }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography variant="body2">Переглянути дати ({schedule.dates.length})</Typography></AccordionSummary>
                    <AccordionDetails>{dates}</AccordionDetails>
                </Accordion>}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Box><Typography variant="body2" color="text.secondary">Локацій</Typography><Typography sx={{ fontSize: '1.25rem', fontWeight: 700 }}>{schedule.locations.length}</Typography></Box>
                    <Box><Typography variant="body2" color="text.secondary">Інтервалів на день</Typography><Typography sx={{ fontSize: '1.25rem', fontWeight: 700 }}>{intervalCount}</Typography></Box>
                </Box>
            </Stack>
        </Box>

        {result.preservedBookings > 0 && <Alert severity="warning">
            <AlertTitle>Записів поза новим розкладом: {result.preservedBookings}</AlertTitle>
            Вони залишаться чинними на початковий час. Щоб скасувати їх, відкрийте «Записи».
        </Alert>}
        {result.updatedDates > 1 && <Alert severity="warning">Цей розклад замінить налаштування всіх обраних дат.</Alert>}

        <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>Локації та інтервали</Typography>
        {!schedule.locations.length && <Alert severity="info">Локацій та інтервалів немає. Нові записи на ці дати будуть недоступні.</Alert>}
        {schedule.locations.map(location => {
            const name = locations.find(place => place.id === location.locationId)?.name ?? `Локація ${location.locationId}`;
            return <Box component="section" key={location.locationId} data-testid="schedule-review-location"
                sx={{ minWidth: 0, overflow: 'hidden', border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
                <Stack direction="row" spacing={1} sx={{ p: 1.5, alignItems: 'center', bgcolor: 'background.default' }}>
                    <PlaceOutlinedIcon color="primary" fontSize="small" sx={{ flexShrink: 0 }} />
                    <Typography component="h4" sx={{ minWidth: 0, fontWeight: 700, overflowWrap: 'anywhere' }}>{name}</Typography>
                </Stack>
                <Table size="small" aria-label={`Інтервали: ${name}`} sx={{ '& .MuiTableCell-root': { px: 1.5, py: 1 }, '& tbody tr:last-child th, & tbody tr:last-child td': { borderBottom: 0 } }}>
                    <TableHead><TableRow>
                        <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>Час стенду</TableCell>
                        <TableCell align="right" sx={{ width: 76, color: 'text.secondary', fontSize: '0.75rem' }}>Місць</TableCell>
                    </TableRow></TableHead>
                    <TableBody>{location.slots.map(slot => <TableRow key={`${slot.startTime}-${slot.endTime}`}>
                        <TableCell component="th" scope="row" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{slot.startTime}–{slot.endTime}</TableCell>
                        <TableCell align="right"><Box component="span" sx={{ display: 'inline-block', minWidth: 32, px: 1, py: 0.25, borderRadius: 1, bgcolor: 'var(--state-available-bg)', color: 'primary.dark', fontWeight: 700, fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>{slot.capacity}</Box></TableCell>
                    </TableRow>)}</TableBody>
                </Table>
            </Box>;
        })}
        <Alert severity="info"><AlertTitle>Наявні записи не скасовуються</AlertTitle>
            Усі записи залишаться чинними на початковий час. Нові записи дозволятимуться лише за цим розкладом.
        </Alert>
    </Stack>;
}
