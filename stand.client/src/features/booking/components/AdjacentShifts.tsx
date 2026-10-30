import { Box, Typography } from '@mui/material';
import type { MyShiftDto } from '../../../api/types';
import { bookingCopy } from '../bookingCopy';

export default function AdjacentShifts({ shift }: { shift: Pick<MyShiftDto, 'previousShifts' | 'nextShifts'> }) {
    const rows = [
        ...(shift.previousShifts ?? []).map(slot => ({ ...slot, label: bookingCopy.beforeYou })),
        ...(shift.nextShifts ?? []).map(slot => ({ ...slot, label: bookingCopy.afterYou })),
    ].filter(slot => slot.participants.length > 0);

    if (rows.length === 0) return null;

    return (
        <Box component="section" aria-label={bookingCopy.adjacentShifts} sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: '76px minmax(0, 1fr)', rowGap: 1 }}>
                {rows.map((slot, index) => (
                    <Box key={`${slot.label}-${slot.startTime}-${slot.endTime}-${index}`} sx={{ display: 'contents' }}>
                        <Typography component="dt" variant="body2" sx={{ fontWeight: 600 }}>{slot.label}</Typography>
                        <Box component="dd" sx={{ m: 0, minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                {slot.startTime}–{slot.endTime}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                                {slot.participants.map(person => [person.firstName?.trim(), person.lastName?.trim()]
                                    .filter(Boolean).join(' ') || bookingCopy.participant).join(', ')}
                            </Typography>
                        </Box>
                    </Box>
                ))}
            </Box>
        </Box>
    );
}
