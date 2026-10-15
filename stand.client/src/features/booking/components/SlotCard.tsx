import ParticipantList from './ParticipantList';
import { Box, Checkbox, Stack, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import BlockIcon from '@mui/icons-material/Block';
import type { SlotAvailabilityDto } from '../../../api/types';
import { bookingCopy, showParticipantNames } from '../bookingCopy';
import StateBadge from './StateBadge';

export default function SlotCard({
    slot,
    selected,
    mine,
    readOnly = false,
    onSelect,
    disabled = false,
    onDisabledClick,
}: {
    slot: SlotAvailabilityDto;
    selected: boolean;
    mine?: boolean;
    readOnly?: boolean;
    onSelect: (slot: SlotAvailabilityDto) => void;
    disabled?: boolean;
    onDisabledClick?: () => void;
}) {
    const full = slot.remaining <= 0 || (!readOnly && slot.isFull);
    const canViewFullShift = slot.remaining <= 0 && !slot.isBlocked && !slot.isTooSoon;
    const unavailable = !selected && (disabled || (!readOnly && !slot.isBookable && !mine && !canViewFullShift));
    const tone = readOnly ? 'unavailable' : mine ? 'mine' : 'full';
    const accent = mine ? 'var(--state-mine-border)' : full ? '#9CA3AF' : 'var(--state-available-border)';
    const badgeLabel = readOnly ? bookingCopy.pastShift : mine
        ? bookingCopy.youBooked
        : full ? bookingCopy.seatsGone : null;

    return (
        <Box
            component="label"
            role={unavailable ? 'button' : undefined}
            tabIndex={unavailable ? 0 : undefined}
            aria-disabled={unavailable || undefined}
            aria-label={unavailable ? `${slot.startTime}-${slot.endTime}: недоступно. Дізнатися причину` : undefined}
            onClickCapture={(event) => {
                if (unavailable) {
                    event.preventDefault();
                    event.stopPropagation();
                    onDisabledClick?.();
                }
            }}
            onKeyDown={(event) => {
                if (unavailable && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    onDisabledClick?.();
                }
            }}
            sx={{
                width: '100%',
                minHeight: 84,
                display: 'block',
                textAlign: 'left',
                borderRadius: 1,
                cursor: unavailable ? 'not-allowed' : 'pointer',
                opacity: unavailable ? 0.55 : 1,
                '&:focus-visible, &:has(input:focus-visible)': { outline: '3px solid #7FB69A', outlineOffset: 2 },
            }}
        >
            <Box sx={{
                border: '1px solid',
                borderColor: selected ? 'var(--state-selected-bg)' : full ? 'var(--state-full-border)' : 'divider',
                borderLeft: `6px solid ${unavailable ? '#9CA3AF' : selected ? 'var(--state-selected-bg)' : accent}`,
                borderRadius: 1,
                bgcolor: unavailable ? 'action.disabledBackground' : selected ? 'var(--state-selected-bg)' : full ? 'var(--state-full-bg)' : '#FFFFFF',
                color: selected ? 'var(--state-selected-text)' : 'text.primary',
                p: 1.5,
            }}>
                <Stack direction="row" spacing={1.25} sx={{ alignItems: 'flex-start' }}>
                    {mine ? <CheckIcon sx={{ mt: 0.25 }} /> : full ? <BlockIcon sx={{ mt: 0.25, color: 'text.secondary' }} /> : null}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                            <Typography sx={{ fontSize: 18, fontWeight: 800 }}>{slot.startTime}-{slot.endTime}</Typography>
                            {badgeLabel && <StateBadge label={badgeLabel} tone={tone} />}
                            <Checkbox
                                value={slot.timeSlotId}
                                checked={selected}
                                disabled={unavailable}
                                onChange={() => onSelect(slot)}
                                slotProps={{ input: { 'aria-label': `${slot.startTime}-${slot.endTime}` } }}
                                sx={{ p: 0, flexShrink: 0, pointerEvents: unavailable ? 'none' : undefined, ...(selected && { color: 'inherit', '&.Mui-checked': { color: 'inherit' } }) }}
                            />
                        </Stack>
                        {showParticipantNames && <ParticipantList participants={slot.participants} selected={selected} />}
                    </Box>
                </Stack>
            </Box>
        </Box>
    );
}
