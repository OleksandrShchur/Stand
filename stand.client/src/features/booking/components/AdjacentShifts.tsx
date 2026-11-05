import { Box, Chip, Stack, Typography } from '@mui/material';
import type { MyShiftDto } from '../../../api/types';
import { bookingCopy } from '../bookingCopy';

export default function AdjacentShifts({ shift, subdued = false }: {
    shift: Pick<MyShiftDto, 'previousShifts' | 'nextShifts' | 'isFirstShift' | 'isLastShift'>;
    subdued?: boolean;
}) {
    // Do not describe missing data from an older API as an empty adjoining slot.
    if (!shift.isFirstShift && !shift.isLastShift && shift.previousShifts === undefined && shift.nextShifts === undefined) return null;
    const sides = [
        { label: bookingCopy.beforeYou, hidden: shift.isFirstShift, slots: (shift.previousShifts ?? []).filter(slot => slot.participants.length > 0) },
        { label: bookingCopy.afterYou, hidden: shift.isLastShift, slots: (shift.nextShifts ?? []).filter(slot => slot.participants.length > 0) },
    ].filter(side => !side.hidden);

    return (
        <Box component="section" aria-label={bookingCopy.adjacentShifts} sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider', ...(subdued && { p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 0.5, bgcolor: 'background.default', color: 'text.secondary' }) }}>
            {(shift.isFirstShift || shift.isLastShift) && (
                <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.5, mb: sides.length > 0 ? 1 : 0 }}>
                    {shift.isFirstShift && <Chip label={bookingCopy.firstShiftOfDay} color="primary" variant="outlined" size="small" />}
                    {shift.isLastShift && <Chip label={bookingCopy.lastShiftOfDay} color="primary" variant="outlined" size="small" />}
                </Stack>
            )}
            {sides.length > 0 && <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: '76px minmax(0, 1fr)', rowGap: 1 }}>
                {sides.map(side => (
                    <Box key={side.label} sx={{ display: 'contents' }}>
                        <Typography component="dt" variant="body2" sx={{ fontWeight: subdued ? 400 : 600 }}>{side.label}</Typography>
                        <Box component="dd" sx={{ m: 0, minWidth: 0 }}>
                            {side.slots.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">{bookingCopy.noAdjacentParticipants}</Typography>
                            ) : (
                                <Stack spacing={1}>
                                    {side.slots.map((slot, index) => (
                                        <Box key={`${slot.startTime}-${slot.endTime}-${index}`}>
                                            <Typography variant="body2" sx={{ fontWeight: subdued ? 400 : 600, fontVariantNumeric: 'tabular-nums' }}>
                                                {slot.startTime}–{slot.endTime}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                                                {slot.participants.map(person => [person.firstName?.trim(), person.lastName?.trim()]
                                                    .filter(Boolean).join(' ') || bookingCopy.participant).join(', ')}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Stack>
                            )}
                        </Box>
                    </Box>
                ))}
            </Box>}
        </Box>
    );
}
