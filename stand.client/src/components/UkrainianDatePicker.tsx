import dayjs from 'dayjs';
import 'dayjs/locale/uk';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { ukUA } from '@mui/x-date-pickers/locales';

interface Props {
    label: string;
    name: string;
    value: string;
    disabled?: boolean;
    onChange: (isoDate: string) => void;
}

export default function UkrainianDatePicker({ label, name, value, disabled, onChange }: Props) {
    return <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="uk" localeText={ukUA.components.MuiLocalizationProvider.defaultProps.localeText}>
        <DatePicker
            label={label}
            name={name}
            value={value ? dayjs(value) : null}
            format="DD.MM.YYYY"
            disabled={disabled}
            onChange={(date, context) => {
                if (context.validationError === null) onChange(date?.format('YYYY-MM-DD') ?? '');
            }}
            localeText={{
                fieldDayPlaceholder: () => 'dd',
                fieldMonthPlaceholder: () => 'MM',
                fieldYearPlaceholder: () => 'yyyy',
            }}
            slotProps={{ textField: { fullWidth: true, sx: { minWidth: 0, '& .MuiPickersInputBase-sectionsContainer': { minWidth: 0, fontSize: 16 } } } }}
        />
    </LocalizationProvider>;
}
