import { Box, Typography } from '@mui/material';
import type { ShiftParticipantDto } from '../../../api/types';
import { bookingCopy } from '../bookingCopy';

export default function ParticipantList({ participants, selected = false, prominent = false }: {
    participants: ShiftParticipantDto[];
    selected?: boolean;
    prominent?: boolean;
}) {
    const label = bookingCopy.participants;

    return (
        <Box sx={{ mt: 1.5, color: selected ? 'rgba(255,255,255,0.82)' : 'text.secondary' }}>
            {participants.length === 0 ? (
                <Typography variant={prominent ? 'body1' : 'body2'}>{bookingCopy.noParticipants}</Typography>
            ) : (
                <>
                    <Typography variant="body2" sx={{ fontWeight: prominent ? 400 : 600 }}>{label}</Typography>
                    <Box component="ul" role="list" aria-label={label} sx={{ m: 0, p: 0, listStyle: 'none', overflowWrap: 'anywhere' }}>
                        {participants.map((participant, index) => {
                            const name = [participant.firstName?.trim(), participant.lastName?.trim()].filter(Boolean).join(' ') || bookingCopy.participant;
                            return (
                                <Typography component="li" variant={prominent ? 'body1' : 'body2'} key={`${name}-${index}`} sx={{ display: 'inline', ...(prominent && { color: selected ? 'inherit' : 'text.primary', fontWeight: 600 }) }}>
                                    {name}{index < participants.length - 1 ? ', ' : ''}
                                </Typography>
                            );
                        })}
                    </Box>
                </>
            )}
        </Box>
    );
}
