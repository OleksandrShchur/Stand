import { Box, Typography } from '@mui/material';
import type { ShiftParticipantDto } from '../../../api/types';
import { bookingCopy } from '../bookingCopy';

export default function ParticipantList({ participants, selected = false, dashed = false }: {
    participants: ShiftParticipantDto[];
    selected?: boolean;
    dashed?: boolean;
}) {
    const label = bookingCopy.partners(participants.length);

    return (
        <Box sx={{ mt: 1.5, color: selected ? 'rgba(255,255,255,0.82)' : 'text.secondary' }}>
            {participants.length === 0 ? (
                <Typography variant="body2">{bookingCopy.noPartners}</Typography>
            ) : (
                <>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>
                    <Box component="ul" aria-label={label} sx={{ m: 0, pl: 2.5, ...(dashed && { listStyleType: '"- "' }) }}>
                        {participants.map((participant, index) => {
                            const name = [participant.firstName?.trim(), participant.lastName?.trim()].filter(Boolean).join(' ') || bookingCopy.participant;
                            return (
                                <Typography component="li" variant="body2" key={`${name}-${index}`} sx={{ py: 0.25, overflowWrap: 'anywhere' }}>
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
