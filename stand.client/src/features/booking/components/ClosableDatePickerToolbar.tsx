import { Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { DatePickerToolbar, type DatePickerToolbarProps } from '@mui/x-date-pickers/DatePicker';
import { usePickerActionsContext } from '@mui/x-date-pickers/hooks';

export default function ClosableDatePickerToolbar({ className, sx, ...props }: DatePickerToolbarProps) {
    const { setOpen } = usePickerActionsContext();

    if (props.hidden) return null;

    return (
        <Box className={className} sx={{ position: 'relative' }}>
            <DatePickerToolbar {...props} sx={[...(Array.isArray(sx) ? sx : [sx]), { pr: 7 }]} />
            <IconButton
                aria-label="Закрити календар"
                onClick={() => setOpen(false)}
                sx={{ position: 'absolute', top: 8, right: 8, minWidth: 44, minHeight: 44 }}
            >
                <CloseIcon />
            </IconButton>
        </Box>
    );
}
