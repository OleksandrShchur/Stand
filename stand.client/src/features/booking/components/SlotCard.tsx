import ParticipantList from './ParticipantList';
import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import BlockIcon from '@mui/icons-material/Block';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { SlotAvailabilityDto } from '../../../api/types';
import { bookingCopy, showParticipantNames } from '../bookingCopy';
import StateBadge from './StateBadge';

export default function SlotCard({
    slot,
    selected,
    mine,
    readOnly = false,
    onSelect,
}: {
    slot: SlotAvailabilityDto;
    selected: boolean;
    mine?: boolean;
    readOnly?: boolean;
    onSelect: (slot: SlotAvailabilityDto) => void;
}) {
    const full = slot.remaining <= 0 || (!readOnly && slot.isFull);
    const canViewFullShift = slot.remaining <= 0 && !slot.isBlocked && !slot.isTooSoon;
    const unavailable = !readOnly && !slot.isBookable && !mine && !canViewFullShift;
    const tone = readOnly ? 'unavailable' : mine ? 'mine' : 'full';
    const accent = mine ? 'var(--state-mine-border)' : full ? '#9CA3AF' : 'var(--state-available-border)';
    const badgeLabel = readOnly ? bookingCopy.pastShift : mine
        ? bookingCopy.youBooked
        : full ? bookingCopy.seatsGone : null;

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
                            {badgeLabel && <StateBadge label={badgeLabel} tone={tone} />}
                            {!unavailable && <ChevronRightIcon sx={{ flexShrink: 0 }} />}
                        </Stack>
                        {showParticipantNames && <ParticipantList participants={slot.participants} selected={selected} />}
                    </Box>
                </Stack>
            </Box>
        </ButtonBase>
    );
}
