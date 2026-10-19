import { createContext, useContext, useMemo, useState } from 'react';
import { Button, DialogActions } from '@mui/material';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/uk';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { PickerDay, type PickerDayProps } from '@mui/x-date-pickers/PickerDay';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { ukUA } from '@mui/x-date-pickers/locales';
import { usePickerActionsContext, usePickerTranslations } from '@mui/x-date-pickers/hooks';
import type { PickersActionBarProps } from '@mui/x-date-pickers/PickersActionBar';
import { DATE_PICKER_FORMAT } from '../utils/date';

const ConfirmationContext = createContext<{ commit: () => void; invalid: boolean } | null>(null);
const ActiveDatesContext = createContext<readonly string[]>([]);

function ScheduleDay(props: PickerDayProps) {
    const active = useContext(ActiveDatesContext).includes(props.day.format('YYYY-MM-DD'));
    return <PickerDay {...props} data-schedule-active={active || undefined}
        title={active ? 'Відкрито для запису' : undefined}
        sx={active ? {
            '&:not(.Mui-selected)': { bgcolor: '#E3F2E8', color: 'primary.dark' },
            '&:not(.Mui-selected):hover, &:not(.Mui-selected):focus': { bgcolor: '#CDE7D6' },
        } : undefined} />;
}

function ConfirmationActions({ className, sx }: PickersActionBarProps) {
    const confirmation = useContext(ConfirmationContext);
    const { acceptValueChanges, cancelValueChanges } = usePickerActionsContext();
    const translations = usePickerTranslations();
    if (!confirmation) return null;

    return <DialogActions className={className} sx={sx}>
        <Button onClick={cancelValueChanges}>{translations.cancelButtonLabel}</Button>
        <Button disabled={confirmation.invalid} onClick={() => {
            // MUI also accepts on dismissal; only this explicit action commits a filter.
            confirmation.commit();
            acceptValueChanges();
        }}>{translations.okButtonLabel}</Button>
    </DialogActions>;
}

interface Props {
    label: string;
    name: string;
    value: string;
    disabled?: boolean;
    size?: 'small' | 'medium';
    clearable?: boolean;
    confirmSelection?: boolean;
    activeDates?: readonly string[];
    onCalendarOpen?: () => void;
    onCalendarMonthChange?: (month: string) => void;
    onChange: (isoDate: string) => void;
}

export default function UkrainianDatePicker({ label, name, value, disabled, size = 'medium', clearable = false, confirmSelection = false, activeDates, onCalendarOpen, onCalendarMonthChange, onChange }: Props) {
    // Calendar navigation must survive rerenders that refresh active-day highlights.
    const selectedDate = useMemo(() => value ? dayjs(value) : null, [value]);
    const [draft, setDraft] = useState<Dayjs | null>(() => value ? dayjs(value) : null);
    const [previousValue, setPreviousValue] = useState(value);
    const [open, setOpen] = useState(false);
    const [invalid, setInvalid] = useState(false);

    if (previousValue !== value) {
        setPreviousValue(value);
        setDraft(value ? dayjs(value) : null);
    }

    return <ActiveDatesContext.Provider value={activeDates ?? []}><ConfirmationContext.Provider value={{ invalid, commit: () => {
        const next = draft?.format('YYYY-MM-DD') ?? '';
        if (next !== value) onChange(next);
    } }}>
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="uk" localeText={ukUA.components.MuiLocalizationProvider.defaultProps.localeText}>
        <DatePicker
            label={label}
            name={name}
            value={confirmSelection ? draft : selectedDate}
            format={DATE_PICKER_FORMAT}
            disabled={disabled}
            open={confirmSelection ? open : undefined}
            onOpen={() => { if (confirmSelection) setOpen(true); onCalendarOpen?.(); }}
            onMonthChange={month => onCalendarMonthChange?.(month.format('YYYY-MM-DD'))}
            onClose={confirmSelection ? () => {
                setOpen(false);
                setDraft(value ? dayjs(value) : null);
            } : undefined}
            closeOnSelect={confirmSelection ? false : undefined}
            slots={{ ...(confirmSelection ? { actionBar: ConfirmationActions } : {}), ...(activeDates ? { day: ScheduleDay } : {}) }}
            onError={confirmSelection ? (error) => setInvalid(error !== null) : undefined}
            onChange={(date, context) => {
                if (confirmSelection) setDraft(date);
                else if (context.validationError === null) onChange(date?.format('YYYY-MM-DD') ?? '');
            }}
            localeText={{
                fieldDayPlaceholder: () => 'dd',
                fieldMonthPlaceholder: () => 'MM',
                fieldYearPlaceholder: () => 'yyyy',
                clearButtonLabel: 'Очистити дату',
                fieldClearLabel: 'Очистити дату',
            }}
            slotProps={{
                toolbar: { toolbarFormat: DATE_PICKER_FORMAT },
                field: { clearable, onClear: confirmSelection ? () => onChange('') : undefined },
                clearButton: { 'aria-label': 'Очистити дату', tabIndex: 0 },
                textField: { fullWidth: true, size, sx: { minWidth: 0, '& .MuiPickersInputBase-sectionsContainer': { minWidth: 0, fontSize: 16 } } },
            }}
        />
    </LocalizationProvider>
    </ConfirmationContext.Provider></ActiveDatesContext.Provider>;
}
