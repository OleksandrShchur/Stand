import { Box, Typography } from '@mui/material';
import type { ShiftParticipantDto } from '../../../api/types';
import { bookingCopy } from '../bookingCopy';

export default function ParticipantList({ participants, selected = false, dashed = false, prominent = false }: {
    participants: ShiftParticipantDto[];
    selected?: boolean;
    dashed?: boolean;
    prominent?: boolean;
}) {
    const label = bookingCopy.partners(participants.length);

    return (
        <Box sx={{ mt: 1.5, color: selected ? 'rgba(255,255,255,0.82)' : 'text.secondary' }}>
            {participants.length === 0 ? (
                <Typography variant={prominent ? 'body1' : 'body2'}>{bookingCopy.noPartners}</Typography>
            ) : (
                <>
                    <Typography variant="body2" sx={{ fontWeight: prominent ? 400 : 600 }}>{label}</Typography>
                    <Box component="ul" role="list" aria-label={label} sx={{ m: 0, pl: prominent ? 0 : 2.5, ...(dashed && { listStyleType: '"- "' }), ...(prominent && { listStyle: 'none' }) }}>
                        {participants.map((participant, index) => {
                            const name = [participant.firstName?.trim(), participant.lastName?.trim()].filter(Boolean).join(' ') || bookingCopy.participant;
                            return (
                                <Typography component="li" variant={prominent ? 'body1' : 'body2'} key={`${name}-${index}`} sx={{ py: 0.25, overflowWrap: 'anywhere', ...(prominent && { color: selected ? 'inherit' : 'text.primary', fontWeight: 600 }) }}>
                                    {name}
                                </Typography>
                            );
                        })}
                    </Box>
                </>
            )}
        </Box>
    );
}
