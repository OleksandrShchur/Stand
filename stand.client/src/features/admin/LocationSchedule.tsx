import { useState } from 'react';
import {
    Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Card, CardContent,
    Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
    IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
    useMediaQuery, useTheme,
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTimeOutlined';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import type { DayScheduleDto, LocationAdminDto, ScheduleLocationDto, ScheduleRangeDto } from '../../api/types';
import { generateRanges, getRangeErrors, validateRanges } from './scheduleModel';
import UkrainianTimePicker from '../../components/UkrainianTimePicker';

interface Props {
    location: LocationAdminDto;
    slots?: ScheduleRangeDto[];
    bookings: DayScheduleDto['bookings'];
    busy: boolean;
    otherLocations: (ScheduleLocationDto & { name: string })[];
    onChange: (slots: ScheduleRangeDto[] | null) => void;
}

// Only the location being edited mounts time controls. Controls must be able
// to shrink without imposing their intrinsic width on the page.
export default function LocationSchedule({ location, slots, bookings, busy, otherLocations, onChange }: Props) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [open, setOpen] = useState(false);
    const [generatorOpen, setGeneratorOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [actionMenu, setActionMenu] = useState<{ anchor: HTMLElement; index: number } | null>(null);
    const [mode, setMode] = useState<'bulk' | 'single'>('bulk');
    const [start, setStart] = useState('09:00');
    const [end, setEnd] = useState('17:00');
    const [duration, setDuration] = useState(60);
    const [capacity, setCapacity] = useState(location.capacity);
    const [error, setError] = useState('');
    const [copyId, setCopyId] = useState('');
    const enabled = slots !== undefined;
    const slotIssues = getRangeErrors(slots ?? [], bookings);
    const hasSlotErrors = slotIssues.some(issue => issue.capacity || issue.time);
    const generatorCapacityError = getRangeErrors([{ startTime: start, endTime: end, capacity }])[0].capacity;
    const openEditor = () => { setError(''); setGeneratorOpen(!slots?.length); setEditingIndex(null); setOpen(true); };
    const closeEditor = () => { setActionMenu(null); setOpen(false); setEditingIndex(null); };
    const finishEditor = () => {
        const index = slotIssues.findIndex(issue => issue.capacity || issue.time);
        if (index < 0) { closeEditor(); return; }
        setEditingIndex(index);
        requestAnimationFrame(() => {
            const card = document.getElementById(`schedule-interval-${location.id}-${index}`);
            card?.scrollIntoView({ block: 'center' });
            card?.querySelector<HTMLElement>('input[aria-invalid="true"]:not([aria-hidden="true"]), .Mui-error [role="spinbutton"]')?.focus({ preventScroll: true });
        });
    };
    const add = () => {
        try {
            const generated = mode === 'single' ? [{ startTime: start, endTime: end, capacity }] : generateRanges(start, end, duration, capacity);
            const next = [...(slots || []), ...generated].sort((a, b) => a.startTime.localeCompare(b.startTime));
            const invalid = validateRanges(next, bookings);
            if (invalid) throw new Error(invalid);
            onChange(next); setError(''); setEditingIndex(null); setGeneratorOpen(mode === 'single');
        } catch (issue) { setError(issue instanceof Error ? issue.message : 'Перевірте час інтервалів.'); }
    };

    return <>
        <Card variant="outlined" sx={{ minWidth: 0, opacity: location.isActive || enabled ? 1 : 0.65 }}>
            <CardContent>
                <FormControlLabel sx={{ alignItems: 'start', m: 0, width: '100%', minWidth: 0, '& .MuiFormControlLabel-label': { flex: 1, minWidth: 0 } }}
                    control={<Checkbox checked={enabled} disabled={busy || (!location.isActive && !enabled)}
                        onChange={event => {
                            onChange(event.target.checked ? [] : null);
                            if (event.target.checked) { setGeneratorOpen(true); setOpen(true); } else closeEditor();
                        }} sx={{ mt: -0.5, ml: -1, width: 44, height: 44, flexShrink: 0 }} />}
                    label={<Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                        <Typography sx={{ fontWeight: 700 }}>{location.name}{!location.isActive ? ' · Неактивна' : ''}</Typography>
                        <Typography variant="body2" color="text.secondary">{location.address}</Typography>
                        <Typography variant="caption" color="text.secondary">Місць за замовчуванням: {location.capacity}</Typography>
                    </Box>} />
                {bookings.length > 0 && <Typography variant="caption" color="warning.dark" sx={{ display: 'block', mt: 1 }}>Наявних записів: {bookings.length}. Вони залишаться чинними.</Typography>}
                {enabled && <>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, mb: 1 }}>
                        {slots.length ? `${slots.length} інтервалів · ${slots.slice(0, 3).map(slot => `${slot.startTime}–${slot.endTime} (${slot.capacity} місць)`).join(', ')}${slots.length > 3 ? '…' : ''}` : 'Час ще не додано'}
                    </Typography>
                    <Button fullWidth variant="outlined" startIcon={<AccessTimeIcon />} disabled={busy} onClick={openEditor}>Налаштувати час</Button>
                </>}
            </CardContent>
        </Card>

        <Dialog open={open && enabled} onClose={closeEditor} fullScreen={isMobile} fullWidth maxWidth="sm" aria-labelledby={`location-time-${location.id}`} data-testid="location-time-editor">
            <DialogTitle id={`location-time-${location.id}`} sx={{ display: 'flex', alignItems: 'start', gap: 1, p: 2, minWidth: 0 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography component="span" sx={{ display: 'block', fontWeight: 700 }}>Час чергувань</Typography>
                    <Typography component="span" variant="body2" color="text.secondary" title={location.name} sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{location.name}</Typography>
                </Box>
                <IconButton aria-label="Закрити редактор часу" onClick={closeEditor} sx={{ flexShrink: 0, width: 44, height: 44 }}><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent dividers sx={{ p: 2, minWidth: 0, '& .MuiTextField-root': { minWidth: 0 }, '& input': { minWidth: 0, fontSize: 16 } }}>
                <Stack spacing={2} sx={{ minWidth: 0 }}>
                    {bookings.length > 0 && <Alert severity="warning">Наявні записи залишаться чинними на початковий час, навіть якщо ви зміните або видалите інтервал.</Alert>}
                    <Accordion expanded={generatorOpen} onChange={(_, expanded) => setGeneratorOpen(expanded)} variant="outlined" disableGutters>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ fontWeight: 600 }}>Додати час</Typography></AccordionSummary>
                        <AccordionDetails><Stack spacing={2} sx={{ minWidth: 0 }}>
                            <ToggleButtonGroup aria-label="Спосіб додавання інтервалів" exclusive fullWidth value={mode} disabled={busy} onChange={(_, value) => { if (value) { setMode(value); setError(''); } }}>
                                <ToggleButton value="bulk" sx={{ flex: 1, minWidth: 0, whiteSpace: 'normal' }}>Серія інтервалів</ToggleButton>
                                <ToggleButton value="single" sx={{ flex: 1, minWidth: 0, whiteSpace: 'normal' }}>Один інтервал</ToggleButton>
                            </ToggleButtonGroup>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <UkrainianTimePicker label="Від" name={`schedule-${location.id}-from`} value={start} disabled={busy} size="medium" clearable={false} onChange={setStart} />
                                <UkrainianTimePicker label="До" name={`schedule-${location.id}-to`} value={end} disabled={busy} size="medium" clearable={false} onChange={setEnd} />
                            </Stack>
                            {mode === 'bulk' && <TextField label="Тривалість інтервалу, хв" type="number" value={duration} disabled={busy} onChange={event => setDuration(Number(event.target.value))}
                                slotProps={{ htmlInput: { min: 1, max: 1439, inputMode: 'numeric' } }} helperText="60 — щогодини; 30 — кожні пів години." />}
                            {mode === 'single' && <Typography variant="body2" color="text.secondary">Увесь період — один інтервал. Можна додати кілька різних періодів із перервами.</Typography>}
                            <TextField label="Кількість місць" name={`schedule-${location.id}-capacity`} value={capacity || ''} disabled={busy} error={!!generatorCapacityError} onChange={event => {
                                if (/^[0-9]*$/.test(event.target.value)) setCapacity(Number(event.target.value));
                            }}
                                slotProps={{ htmlInput: { inputMode: 'numeric', pattern: '[0-9]*', maxLength: 10 } }}
                                helperText={generatorCapacityError || (mode === 'bulk' ? 'Для кожного інтервалу серії. Після додавання можна змінити окремо.' : 'Максимальна кількість записів на цей інтервал.')} />
                            {error && <Alert severity="error">{error}</Alert>}
                            <Button variant="contained" fullWidth startIcon={<AddIcon />} disabled={busy} onClick={add}>{mode === 'bulk' ? 'Додати серію' : 'Додати інтервал'}</Button>
                        </Stack></AccordionDetails>
                    </Accordion>

                    <Typography sx={{ fontWeight: 600 }}>Інтервали · {slots?.length || 0}</Typography>
                    {!slots?.length && <Typography variant="body2" color="text.secondary">Додайте серію однакових інтервалів або окремі періоди вище.</Typography>}
                    {slots?.map((slot, index) => {
                        const issue = slotIssues[index];
                        const invalid = !!(issue.capacity || issue.time);
                        return <Box key={index} id={`schedule-interval-${location.id}-${index}`} data-testid="schedule-interval"
                            sx={{ border: '1px solid', borderColor: invalid ? 'error.main' : 'divider', borderRadius: 1, p: 1.5, minWidth: 0 }}>
                        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', minWidth: 0 }}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography sx={{ fontWeight: 700 }}>{slot.startTime}–{slot.endTime}</Typography>
                                <Typography variant="body2" color="text.secondary">Місць: {slot.capacity} · Записів: {bookings.filter(b => b.startTime === slot.startTime && b.endTime === slot.endTime).length}</Typography>
                            </Box>
                            <IconButton id={`interval-actions-${location.id}-${index}`} aria-label={`Дії інтервалу ${slot.startTime}–${slot.endTime}`}
                                aria-haspopup="menu" aria-controls={actionMenu?.index === index ? `interval-actions-menu-${location.id}` : undefined}
                                aria-expanded={actionMenu?.index === index ? true : undefined} disabled={busy}
                                onClick={event => setActionMenu({ anchor: event.currentTarget, index })}
                                sx={{ width: 44, height: 44, flexShrink: 0 }}><MoreVertIcon /></IconButton>
                        </Stack>
                        {invalid && editingIndex !== index && <Alert severity="error" sx={{ mt: 1.5 }}>{[issue.capacity, issue.time].filter(Boolean).join(' ')}</Alert>}
                        {editingIndex === index && <Stack spacing={2} sx={{ mt: 2 }}>
                            <UkrainianTimePicker label="Початок" name={`schedule-${location.id}-${index}-start`} value={slot.startTime} disabled={busy} size="medium" clearable={false} onChange={time => onChange(slots.map((item, i) => i === index ? { ...item, startTime: time } : item))} />
                            <UkrainianTimePicker label="Завершення" name={`schedule-${location.id}-${index}-end`} value={slot.endTime} disabled={busy} size="medium" clearable={false} validationMessage={issue.time} onChange={time => onChange(slots.map((item, i) => i === index ? { ...item, endTime: time } : item))} />
                            <TextField label="Кількість місць" name={`schedule-${location.id}-${index}-capacity`} value={slot.capacity || ''} disabled={busy} fullWidth error={!!issue.capacity}
                                slotProps={{ htmlInput: { inputMode: 'numeric', pattern: '[0-9]*', maxLength: 10 } }}
                                helperText={issue.capacity || 'Щоб зменшити кількість місць нижче кількості записів, спочатку скасуйте зайві записи.'}
                                onChange={event => {
                                    if (/^[0-9]*$/.test(event.target.value)) onChange(slots.map((item, i) => i === index ? { ...item, capacity: Number(event.target.value) } : item));
                                }} />
                        </Stack>}
                    </Box>; })}
                    {!!slots?.length && <Button variant="outlined" disabled={busy} color="error" onClick={() => { onChange([]); setEditingIndex(null); setGeneratorOpen(true); }}>Очистити час</Button>}
                    {otherLocations.length > 0 && <Stack spacing={1.5}>
                        <TextField select fullWidth label="Взяти час і місця іншої локації" value={copyId} disabled={busy} onChange={event => setCopyId(event.target.value)}>
                            {otherLocations.map(other => <MenuItem key={other.locationId} value={String(other.locationId)} sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{other.name}</MenuItem>)}
                        </TextField>
                        <Button variant="outlined" disabled={busy || !copyId} onClick={() => {
                            const other = otherLocations.find(item => String(item.locationId) === copyId);
                            if (other) { onChange(other.slots.map(slot => ({ ...slot }))); setError(''); setEditingIndex(null); setGeneratorOpen(false); }
                        }}>Замінити час і місця</Button>
                    </Stack>}
                </Stack>
            </DialogContent>
            <Menu id={`interval-actions-menu-${location.id}`} anchorEl={actionMenu?.anchor} open={!!actionMenu && open && enabled} onClose={() => setActionMenu(null)}
                slotProps={{ list: { 'aria-labelledby': actionMenu ? `interval-actions-${location.id}-${actionMenu.index}` : undefined }, paper: { sx: { minWidth: 180 } } }}
                sx={{ '& .MuiMenuItem-root': { minHeight: 48 } }}>
                <MenuItem disabled={busy} onClick={() => {
                    if (actionMenu) setEditingIndex(editingIndex === actionMenu.index ? null : actionMenu.index);
                    setActionMenu(null);
                }}>
                    <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Редагувати</ListItemText>
                </MenuItem>
                <MenuItem disabled={busy} sx={{ color: 'error.main' }} onClick={() => {
                    if (actionMenu && slots) onChange(slots.filter((_, index) => index !== actionMenu.index));
                    setEditingIndex(null); setActionMenu(null);
                }}>
                    <ListItemIcon sx={{ color: 'inherit' }}><DeleteOutlineIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Видалити</ListItemText>
                </MenuItem>
            </Menu>
            <DialogActions sx={{ p: 2, pb: 'max(16px, env(safe-area-inset-bottom))', flexDirection: 'column', alignItems: 'stretch', gap: 1 }}>
                <Typography variant="caption" color={hasSlotErrors ? 'error.main' : 'text.secondary'}>
                    {hasSlotErrors ? 'Виправте помилки у виділених інтервалах. «Готово» покаже першу помилку.' : 'Після завершення збережіть розклад дня.'}
                </Typography>
                <Button variant="contained" onClick={finishEditor} fullWidth sx={{ ml: '0 !important' }}>Готово</Button>
            </DialogActions>
        </Dialog>
    </>;
}
