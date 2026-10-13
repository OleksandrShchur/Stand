import { Avatar, Box, ButtonBase, Stack, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import BlockIcon from '@mui/icons-material/Block';
import type { SlotAvailabilityDto } from '../../../api/types';
import { bookingCopy, showParticipantNames } from '../bookingCopy';
import StateBadge from './StateBadge';

function participantName(participant: { firstName: string | null; lastName: string | null }, fallback = 'Учасник') {
    return [participant.firstName, participant.lastName].filter(Boolean).join(' ') || fallback;
}

export default function SlotCard({
    slot,
    selected,
    mine,
    onSelect,
}: {
    slot: SlotAvailabilityDto;
    selected: boolean;
    mine?: boolean;
    onSelect: (slot: SlotAvailabilityDto) => void;
}) {
    const full = slot.remaining <= 0 || slot.isFull;
    const unavailable = !slot.isBookable && !mine;
    const almostFull = slot.isBookable && slot.remaining === 1;
    const tone = mine ? 'mine' : full ? 'full' : almostFull ? 'warning' : selected ? 'selected' : 'available';
    const accent = mine ? 'var(--state-mine-border)' : almostFull ? '#B7791F' : full ? '#9CA3AF' : 'var(--state-available-border)';
    const badgeLabel = mine
        ? bookingCopy.youBooked
        : full
            ? bookingCopy.seatsGone
            : almostFull
                ? 'Залишилось 1'
                : `${slot.remaining} з ${slot.capacity} вільно`;

    return (
        <ButtonBase
            disabled={unavailable}
            aria-disabled={unavailable}
            onClick={() => onSelect(slot)}
            sx={{
                width: '100%',
                minHeight: 84,
                display: 'block',
                textAlign: 'left',
                borderRadius: 1,
                cursor: unavailable ? 'not-allowed' : 'pointer',
                '&:focus-visible': { outline: '3px solid #7FB69A', outlineOffset: 2 },
            }}
        >
            <Box sx={{
                border: '1px solid',
                borderColor: selected ? 'var(--state-selected-bg)' : full ? 'var(--state-full-border)' : 'divider',
                borderLeft: `6px solid ${selected ? 'var(--state-selected-bg)' : accent}`,
                borderRadius: 1,
                bgcolor: selected ? 'var(--state-selected-bg)' : full ? 'var(--state-full-bg)' : '#FFFFFF',
                color: selected ? 'var(--state-selected-text)' : 'text.primary',
                p: 1.5,
            }}>
                <Stack direction="row" spacing={1.25} sx={{ alignItems: 'flex-start' }}>
                    {mine ? <CheckIcon sx={{ mt: 0.25 }} /> : full ? <BlockIcon sx={{ mt: 0.25, color: 'text.secondary' }} /> : null}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                            <Typography sx={{ fontSize: 18, fontWeight: 800 }}>{slot.startTime}-{slot.endTime}</Typography>
                            <StateBadge label={badgeLabel} tone={tone} />
                        </Stack>
                        {showParticipantNames && (
                            <Stack direction="row" spacing={0.75} sx={{ mt: 1, flexWrap: 'wrap' }}>
                                {slot.participants.length === 0 ? (
                                    !full && <Typography variant="body2" sx={{ color: selected ? 'rgba(255,255,255,0.82)' : 'text.secondary' }}>{bookingCopy.firstInSlot}</Typography>
                                ) : slot.participants.map((participant, index) => {
                                    const name = participantName(participant);
                                    return (
                                        <Avatar key={`${name}-${index}`} sx={{
                                            width: 28,
                                            height: 28,
                                            fontSize: 12,
                                            bgcolor: selected ? 'rgba(255,255,255,0.18)' : 'var(--state-available-bg)',
                                            color: selected ? 'common.white' : 'primary.dark',
                                            border: '1px solid',
                                            borderColor: selected ? 'rgba(255,255,255,0.45)' : 'var(--state-available-border)',
                                        }} title={name}>
                                            {name.trim()[0]?.toUpperCase() ?? 'У'}
                                        </Avatar>
                                    );
                                })}
                            </Stack>
                        )}
                    </Box>
                </Stack>
            </Box>
        </ButtonBase>
    );
}
