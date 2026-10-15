import type { SlotAvailabilityDto } from '../../api/types';
import type { SlotTimeStatus } from './slotTimeStatus';

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

export function getSlotDisabledReason(slot: SlotAvailabilityDto, selected: SlotAvailabilityDto[], readOnly = false, timeStatus: SlotTimeStatus = 'upcoming'): string | null {
    // Selected slots must remain removable even when availability changes.
    if (selected.some((item) => item.timeSlotId === slot.timeSlotId)) return null;
    if (timeStatus === 'finished') return 'Ця зміна вже завершена. Оберіть майбутній час для запису.';
    if (timeStatus === 'in-progress') return 'Ця зміна вже триває. Запис після початку зміни недоступний. Оберіть майбутній час.';
    if (readOnly) return 'Запис на минулі дати недоступний. Оберіть іншу дату.';
    if (slot.isBlocked) return 'Цю зміну заблоковано для запису. Оберіть інший час.';
    if (slot.isTooSoon) return 'До початку цієї зміни залишилося замало часу для запису. Оберіть пізніший час.';
    if (slot.remaining <= 0) return 'На цю зміну немає вільних місць. Додати її до обраного часу неможливо.';
    if (!isSlotBookable(slot)) return 'Запис на цю зміну недоступний. Оберіть інший час.';
    if (!selected.length || canAddSlot(slot, selected)) return null;
    if (!isContinuousSelection(selected)) return 'Одна з обраних змін більше недоступна. Зніміть її позначку та оберіть час знову.';
    const ordered = sortSlots(selected);
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    if (slot.startTime < last.endTime && slot.endTime > first.startTime)
        return 'Ця зміна перетинається з обраним часом. Оберіть суміжну зміну без накладань.';
    return `Можна обрати лише послідовні зміни без перерв. Спочатку додайте зміну, що закінчується о ${first.startTime} або починається о ${last.endTime}. Пропускати зайняті чи недоступні зміни не можна.`;
}

export function toggleSlot(slot: SlotAvailabilityDto, selected: SlotAvailabilityDto[]): SlotAvailabilityDto[] {
    const ordered = sortSlots(selected);
    const index = ordered.findIndex((item) => item.timeSlotId === slot.timeSlotId);
    if (index >= 0) return ordered.slice(0, index);
    return canAddSlot(slot, selected) ? sortSlots([...selected, slot]) : ordered;
}
