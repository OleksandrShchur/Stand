import { createContext, useContext, useState } from 'react';
import { Button, DialogActions } from '@mui/material';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/uk';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { ukUA } from '@mui/x-date-pickers/locales';
import { renderTimeViewClock } from '@mui/x-date-pickers/timeViewRenderers';
import { usePickerActionsContext, usePickerTranslations } from '@mui/x-date-pickers/hooks';
import type { PickersActionBarProps } from '@mui/x-date-pickers/PickersActionBar';
import type { TimeValidationError } from '@mui/x-date-pickers/models';

const ConfirmationContext = createContext<{ commit: () => void; invalid: boolean } | null>(null);

function ConfirmationActions({ className, sx }: PickersActionBarProps) {
    const confirmation = useContext(ConfirmationContext);
    const { acceptValueChanges, cancelValueChanges } = usePickerActionsContext();
    const translations = usePickerTranslations();
    if (!confirmation) return null;
    return <DialogActions className={className} sx={sx}>
        <Button onClick={cancelValueChanges}>{translations.cancelButtonLabel}</Button>
        <Button disabled={confirmation.invalid} onClick={() => {
            confirmation.commit();
            acceptValueChanges();
        }}>{translations.okButtonLabel}</Button>
    </DialogActions>;
}

const asTime = (value: string) => value ? dayjs(`2000-01-01T${value}`) : null;

interface Props {
    label: string;
    name: string;
    value: string;
    disabled?: boolean;
    size?: 'small' | 'medium';
    clearable?: boolean;
    validationMessage?: string;
    after?: string;
    before?: string;
    onChange: (time: string) => void;
}

export default function UkrainianTimePicker({ label, name, value, disabled, size = 'small', clearable = true, validationMessage, after, before, onChange }: Props) {
    const [draft, setDraft] = useState<Dayjs | null>(() => asTime(value));
    const [previousValue, setPreviousValue] = useState(value);
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<TimeValidationError>(null);
    if (previousValue !== value) {
        setPreviousValue(value);
        setDraft(asTime(value));
    }
    return <ConfirmationContext.Provider value={{ invalid: error !== null, commit: () => {
        const next = draft?.format('HH:mm') ?? '';
        if (next !== value) onChange(next);
    } }}>
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="uk" localeText={{ ...ukUA.components.MuiLocalizationProvider.defaultProps.localeText, timePickerToolbarTitle: label }}>
            <TimePicker
                label={label} name={name} value={draft} format="HH:mm" ampm={false}
                disabled={disabled}
                views={['hours', 'minutes']} minutesStep={1}
                minTime={after ? asTime(after)!.add(1, 'minute') : undefined}
                maxTime={before ? asTime(before)!.subtract(1, 'minute') : undefined}
                shouldDisableTime={() => before === '00:00' || after === '23:59'}
                desktopModeMediaQuery="@media (min-width: 600px)"
                viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock }}
                open={open} onOpen={() => setOpen(true)}
                onClose={() => { setOpen(false); setDraft(asTime(value)); }}
                closeOnSelect={false} slots={{ actionBar: ConfirmationActions }}
                onError={setError}
                onChange={(time, context) => {
                    setDraft(time);
                    if (!open && context.validationError === null) onChange(time?.format('HH:mm') ?? '');
                }}
                localeText={{
                    fieldHoursPlaceholder: () => 'ГГ', fieldMinutesPlaceholder: () => 'ХХ',
                    fieldClearLabel: `Очистити ${label.toLowerCase()}`,
                }}
                slotProps={{
                    field: { clearable, onClear: () => onChange('') },
                    clearButton: {
                        'aria-label': `Очистити ${label.toLowerCase()}`, tabIndex: 0,
                        sx: { minWidth: { xs: 24, sm: 44 }, width: { xs: 24, sm: 44 }, p: { xs: 0, sm: 1 } },
                    },
                    openPickerButton: {
                        'aria-label': `Обрати ${label.toLowerCase()}`,
                        sx: { minWidth: { xs: 32, sm: 44 }, width: { xs: 32, sm: 44 }, p: { xs: 0, sm: 1 }, mr: { xs: 0, sm: -1.5 } },
                    },
                    textField: {
                        fullWidth: true, size,
                        error: !!validationMessage || error !== null,
                        helperText: validationMessage || (error ? error === 'minTime' || error === 'maxTime'
                            ? 'Час «Від» має бути раніше часу «До».' : 'Вкажіть час у форматі ГГ:ХХ.' : undefined),
                        sx: {
                            minWidth: 0,
                            '& .MuiPickersOutlinedInput-root': { px: { xs: 1, sm: 1.75 } },
                            '& .MuiInputAdornment-root': { ml: { xs: 0, sm: 1 } },
                            '& .MuiPickersInputBase-sectionsContainer': { minWidth: 0, fontSize: 16 },
                        },
                    },
                }}
            />
        </LocalizationProvider>
    </ConfirmationContext.Provider>;
}
