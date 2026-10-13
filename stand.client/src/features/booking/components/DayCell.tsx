import { Button, Box, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { formatDateFull, parseIsoDate } from '../../../utils/date';
import { bookingCopy } from '../bookingCopy';

export default function DayCell({
    date,
    isAvailable,
    readOnly = false,
    isSelected,
    isToday,
    remaining,
    onSelect,
}: {
    date: string;
    isAvailable: boolean;
    readOnly?: boolean;
    isSelected?: boolean;
    isToday: boolean;
    remaining?: number;
    onSelect: (date: string) => void;
}) {
    const disabled = !isAvailable;
    const label = `${formatDateFull(date)}, ${readOnly ? bookingCopy.readOnly : isAvailable ? `є зміни${remaining !== undefined ? `, ${remaining} вільно` : ''}` : 'немає змін'}`;

    return (
        <Button
            disabled={disabled}
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            aria-label={label}
            aria-pressed={Boolean(isSelected)}
            aria-current={isToday ? 'date' : undefined}
            onClick={() => onSelect(date)}
            sx={{
                position: 'relative',
                minWidth: 44,
                minHeight: 44,
                width: '100%',
                aspectRatio: '1',
                p: 0.25,
                borderRadius: 1,
                border: '1px solid',
                borderColor: isSelected ? 'var(--state-selected-bg)' : isAvailable ? 'var(--state-available-border)' : 'transparent',
                bgcolor: isSelected ? 'var(--state-selected-bg)' : readOnly ? 'action.hover' : isAvailable ? 'var(--state-available-bg)' : 'transparent',
                color: isSelected ? 'var(--state-selected-text)' : readOnly ? 'text.primary' : isAvailable ? 'var(--state-available-text)' : 'var(--state-unavailable-text)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                '&.Mui-disabled': { color: 'var(--state-unavailable-text)' },
                '&:focus-visible': { outline: '3px solid #7FB69A', outlineOffset: 2 },
            }}
        >
            <Box sx={{ display: 'grid', justifyItems: 'center', gap: 0.1, lineHeight: 1 }}>
                <Typography component="span" sx={{ fontSize: 16, fontWeight: 800, lineHeight: 1.1 }}>
                    {parseIsoDate(date).getDate()}
                </Typography>
                {isSelected ? (
                    <CheckIcon sx={{ fontSize: 13 }} />
                ) : isAvailable && remaining !== undefined ? (
                    <Typography component="span" sx={{ fontSize: 10.5, fontWeight: 700, lineHeight: 1.1 }}>
                        {remaining} вільно
                    </Typography>
                ) : null}
            </Box>
            {isToday && (
                <Box sx={{
                    position: 'absolute',
                    bottom: 4,
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    bgcolor: isSelected ? 'common.white' : 'primary.main',
                }} />
            )}
        </Button>
    );
}
