import { Box, Typography } from '@mui/material';
import type { MyShiftDto } from '../../../api/types';
import { formatDate } from '../../../utils/date';
import { bookingCopy } from '../bookingCopy';
import ParticipantList from './ParticipantList';

type ShiftSummaryDetails = Pick<MyShiftDto, 'date' | 'startTime' | 'endTime' | 'locationName' | 'locationAddress' | 'participants'>;

export default function ShiftSummary({ shift }: { shift: ShiftSummaryDetails }) {
    return (
        <Box component="section" aria-label={bookingCopy.shiftDetails} sx={{ borderInlineStart: '3px solid', borderColor: 'primary.main', pl: 1.5 }}>
            <Box component="dl" sx={{ m: 0, display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                <Box sx={{ flex: '1 1 120px', minWidth: 0 }}>
                    <Typography component="dt" variant="body2" color="text.secondary">Дата</Typography>
                    <Typography component="dd" variant="h6" sx={{ m: 0, fontSize: '1.25rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        <Box component="time" dateTime={shift.date}>{formatDate(shift.date)}</Box>
                    </Typography>
                </Box>
                <Box sx={{ flex: '1 1 120px', minWidth: 0 }}>
                    <Typography component="dt" variant="body2" color="text.secondary">Час</Typography>
                    <Typography component="dd" variant="h6" sx={{ m: 0, color: 'primary.dark', fontSize: '1.25rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {shift.startTime}–{shift.endTime}
                    </Typography>
                </Box>
                <Box sx={{ flex: '1 1 100%', minWidth: 0 }}>
                    <Typography component="dt" variant="body2" color="text.secondary">Локація</Typography>
                    <Typography component="dd" variant="body1" sx={{ m: 0, fontWeight: 600, overflowWrap: 'anywhere' }}>
                        {[shift.locationName, shift.locationAddress].filter(Boolean).join(', ')}
                    </Typography>
                </Box>
            </Box>
            <ParticipantList participants={shift.participants} prominent />
        </Box>
    );
}
