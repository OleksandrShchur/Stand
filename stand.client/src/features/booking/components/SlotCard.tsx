import ParticipantList from './ParticipantList';
import type { KeyboardEvent, MouseEvent } from 'react';
import { Box, Checkbox, Stack, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import BlockIcon from '@mui/icons-material/Block';
import type { SlotAvailabilityDto } from '../../../api/types';
import { bookingCopy, showParticipantNames } from '../bookingCopy';
import StateBadge from './StateBadge';
import type { SlotTimeStatus } from '../slotTimeStatus';
import { surfaceShadow } from '../../../surfaceStyles';

export default function SlotCard({
    slot,
    selected,
    mine,
    readOnly = false,
    onSelect,
    disabled = false,
    onDisabledClick,
    timeStatus,
}: {
    slot: SlotAvailabilityDto;
    selected: boolean;
    mine?: boolean;
    readOnly?: boolean;
    onSelect: (slot: SlotAvailabilityDto) => void;
    disabled?: boolean;
    onDisabledClick?: () => void;
    timeStatus: SlotTimeStatus;
}) {
    const full = slot.remaining <= 0;
    const canViewFullShift = slot.remaining <= 0 && !slot.isBlocked && !slot.isTooSoon;
    const unavailable = !selected && (timeStatus !== 'upcoming' || disabled || (!readOnly && !slot.isBookable && !mine && !canViewFullShift));
    const accent = mine ? 'var(--state-mine-border)' : full ? '#9CA3AF' : 'var(--state-available-border)';
    const badgeLabel = timeStatus === 'finished' ? bookingCopy.pastShift
        : timeStatus === 'in-progress' ? bookingCopy.shiftInProgress
        : mine ? bookingCopy.youBooked
        : slot.isBlocked ? bookingCopy.shiftBlocked
        : slot.isTooSoon ? bookingCopy.bookingClosed
        : full ? bookingCopy.seatsGone : null;

    return (
        <Box
            component={unavailable ? 'div' : 'label'}
            role={unavailable ? 'button' : undefined}
            tabIndex={unavailable ? 0 : undefined}
            aria-label={unavailable ? `${slot.startTime}-${slot.endTime}: недоступно. Дізнатися причину` : undefined}
            onClickCapture={(event: MouseEvent<HTMLElement>) => {
                if (unavailable) {
                    event.preventDefault();
                    event.stopPropagation();
                    onDisabledClick?.();
                }
            }}
            onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
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
                '&:focus-visible, &:has(input:focus-visible)': { outline: '3px solid #173B2A', outlineOffset: 2, boxShadow: '0 0 0 2px #FFFFFF' },
            }}
        >
            <Box sx={{
                transition: 'background-color 160ms ease, border-color 160ms ease, color 160ms ease, box-shadow 160ms ease',
                boxShadow: surfaceShadow,
                border: '1px solid',
                borderColor: selected ? 'var(--state-selected-bg)' : full ? 'var(--state-full-border)' : 'divider',
                borderLeft: `6px solid ${unavailable ? '#9CA3AF' : selected ? 'var(--state-selected-bg)' : accent}`,
                borderRadius: 1,
                bgcolor: unavailable ? '#EDF0EE' : selected ? 'var(--state-selected-bg)' : full ? 'var(--state-full-bg)' : '#FFFFFF',
                color: selected ? 'var(--state-selected-text)' : 'text.primary',
                p: 1.5,
            }}>
                <Stack direction="row" spacing={1.25} sx={{ alignItems: 'flex-start' }}>
                    {mine ? <CheckIcon sx={{ mt: 0.25 }} /> : full && timeStatus === 'upcoming' ? <BlockIcon sx={{ mt: 0.25, color: 'text.secondary' }} /> : null}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                            <Typography sx={{ fontSize: 18, fontWeight: 800 }}>{slot.startTime}-{slot.endTime}</Typography>
                            {badgeLabel && <StateBadge label={badgeLabel} tone="warning" />}
                            <Checkbox
                                value={slot.timeSlotId}
                                checked={selected}
                                disabled={unavailable}
                                onChange={() => onSelect(slot)}
                                slotProps={{ input: { 'aria-label': `${slot.startTime}-${slot.endTime}` } }}
                                sx={{ p: 0, minWidth: 24, minHeight: 24, flexShrink: 0, pointerEvents: unavailable ? 'none' : undefined, ...(selected && { color: 'inherit', '&.Mui-checked': { color: 'inherit' } }) }}
                            />
                        </Stack>
                        {showParticipantNames && <ParticipantList participants={slot.participants} selected={selected} />}
                    </Box>
                </Stack>
            </Box>
        </Box>
    );
}
