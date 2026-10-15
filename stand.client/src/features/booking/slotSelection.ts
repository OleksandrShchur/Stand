import type { SlotAvailabilityDto } from '../../api/types';

export function sortSlots(slots: SlotAvailabilityDto[]): SlotAvailabilityDto[] {
    return [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));
}

export function isSlotBookable(slot: SlotAvailabilityDto): boolean {
    return slot.isBookable && slot.remaining > 0 && !slot.isFull && !slot.isBlocked && !slot.isTooSoon && slot.startTime < slot.endTime;
}

export function isContinuousSelection(slots: SlotAvailabilityDto[]): boolean {
    const ordered = sortSlots(slots);
    return ordered.length > 0 && ordered.every((slot, index) =>
        isSlotBookable(slot) && (index === 0 || ordered[index - 1].endTime === slot.startTime));
}

export function canAddSlot(slot: SlotAvailabilityDto, selected: SlotAvailabilityDto[]): boolean {
    return !selected.some((item) => item.timeSlotId === slot.timeSlotId) &&
        isContinuousSelection([...selected, slot]);
}

export function toggleSlot(slot: SlotAvailabilityDto, selected: SlotAvailabilityDto[]): SlotAvailabilityDto[] {
    const ordered = sortSlots(selected);
    const index = ordered.findIndex((item) => item.timeSlotId === slot.timeSlotId);
    if (index >= 0) return ordered.slice(0, index);
    return canAddSlot(slot, selected) ? sortSlots([...selected, slot]) : ordered;
}
