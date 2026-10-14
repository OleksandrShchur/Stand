import { Box, IconButton, LinearProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { DatePickerToolbar, type DatePickerToolbarProps } from '@mui/x-date-pickers/DatePicker';
import { usePickerActionsContext } from '@mui/x-date-pickers/hooks';

export default function ClosableDatePickerToolbar({ className, sx, selectionPending = false, ...props }: DatePickerToolbarProps & { selectionPending?: boolean }) {
    const { setOpen } = usePickerActionsContext();

    if (props.hidden) return null;

    return (
        <Box className={className} sx={{ position: 'relative' }}>
            <DatePickerToolbar {...props} sx={[...(Array.isArray(sx) ? sx : [sx]), { pr: 7 }]} />
            <IconButton
                aria-label="Закрити календар"
                disabled={selectionPending}
                onClick={() => setOpen(false)}
                sx={{ position: 'absolute', top: 8, right: 8, minWidth: 44, minHeight: 44 }}
            >
                <CloseIcon />
            </IconButton>
            {selectionPending && (
                <LinearProgress aria-label="Застосовуємо дату" sx={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} />
            )}
        </Box>
    );
}
