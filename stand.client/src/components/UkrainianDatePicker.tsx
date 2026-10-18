import { createContext, useContext, useState } from 'react';
import { Button, DialogActions } from '@mui/material';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/uk';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { ukUA } from '@mui/x-date-pickers/locales';
import { usePickerActionsContext, usePickerTranslations } from '@mui/x-date-pickers/hooks';
import type { PickersActionBarProps } from '@mui/x-date-pickers/PickersActionBar';

const ConfirmationContext = createContext<{ commit: () => void; invalid: boolean } | null>(null);

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
    onChange: (isoDate: string) => void;
}

export default function UkrainianDatePicker({ label, name, value, disabled, size = 'medium', clearable = false, confirmSelection = false, onChange }: Props) {
    const [draft, setDraft] = useState<Dayjs | null>(() => value ? dayjs(value) : null);
    const [previousValue, setPreviousValue] = useState(value);
    const [open, setOpen] = useState(false);
    const [invalid, setInvalid] = useState(false);

    if (previousValue !== value) {
        setPreviousValue(value);
        setDraft(value ? dayjs(value) : null);
    }

    return <ConfirmationContext.Provider value={{ invalid, commit: () => {
        const next = draft?.format('YYYY-MM-DD') ?? '';
        if (next !== value) onChange(next);
    } }}>
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="uk" localeText={ukUA.components.MuiLocalizationProvider.defaultProps.localeText}>
        <DatePicker
            label={label}
            name={name}
            value={confirmSelection ? draft : value ? dayjs(value) : null}
            format="DD.MM.YYYY"
            disabled={disabled}
            open={confirmSelection ? open : undefined}
            onOpen={confirmSelection ? () => setOpen(true) : undefined}
            onClose={confirmSelection ? () => {
                setOpen(false);
                setDraft(value ? dayjs(value) : null);
            } : undefined}
            closeOnSelect={confirmSelection ? false : undefined}
            slots={confirmSelection ? { actionBar: ConfirmationActions } : undefined}
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
                field: { clearable, onClear: confirmSelection ? () => onChange('') : undefined },
                clearButton: { 'aria-label': 'Очистити дату', tabIndex: 0 },
                textField: { fullWidth: true, size, sx: { minWidth: 0, '& .MuiPickersInputBase-sectionsContainer': { minWidth: 0, fontSize: 16 } } },
            }}
        />
    </LocalizationProvider>
    </ConfirmationContext.Provider>;
}
