import type { SlotAvailabilityDto } from '../../api/types';
import type { SlotTimeStatus } from './slotTimeStatus';

export function sortSlots(slots: SlotAvailabilityDto[]): SlotAvailabilityDto[] {
    return [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));
}

export function isSlotBookable(slot: SlotAvailabilityDto): boolean {
    return !slot.isBookedByMe && slot.isBookable && slot.remaining > 0 && !slot.isFull && !slot.isBlocked && !slot.isTooSoon && slot.startTime < slot.endTime;
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
    if (slot.isBookedByMe) return `Ви вже записані на ${slot.startTime}–${slot.endTime} у цій локації цього дня. Повторно обрати цей час неможливо. Переглянути або скасувати запис можна в розділі «Мої записи».`;
    // Selected slots must remain removable even when availability changes.
    if (selected.some((item) => item.timeSlotId === slot.timeSlotId)) return null;
    if (timeStatus === 'finished') return 'Цей запис вже завершено. Оберіть майбутній час для запису.';
    if (timeStatus === 'in-progress') return 'Цей запис вже триває. Запис після початку запису недоступний. Оберіть майбутній час.';
    if (readOnly) return 'Запис на минулі дати недоступний. Оберіть іншу дату.';
    if (slot.isBlocked) return 'Цей запис заблоковано для запису. Оберіть інший час.';
    if (slot.isTooSoon) return 'До початку цього запису залишилося замало часу для запису. Оберіть пізніший час.';
    if (slot.remaining <= 0) return 'На цей запис немає вільних місць. Додати його до обраного часу неможливо.';
    if (!isSlotBookable(slot)) return 'Запис на цей час недоступний. Оберіть інший час.';
    if (!selected.length || canAddSlot(slot, selected)) return null;
    if (!isContinuousSelection(selected)) return 'Один з обраних записів більше недоступний. Зніміть її позначку та оберіть час знову.';
    const ordered = sortSlots(selected);
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    if (slot.startTime < last.endTime && slot.endTime > first.startTime)
        return 'Цей час перетинається з обраним часом. Оберіть суміжний час без накладань.';
    return `Можна обрати лише послідовні записи без перерв. Спочатку додайте запис, що закінчується о ${first.startTime} або починається о ${last.endTime}. Пропускати зайняті чи недоступні записи не можна.`;
}

export function toggleSlot(slot: SlotAvailabilityDto, selected: SlotAvailabilityDto[]): SlotAvailabilityDto[] {
    const ordered = sortSlots(selected);
    const index = ordered.findIndex((item) => item.timeSlotId === slot.timeSlotId);
    if (index >= 0) return ordered.slice(0, index);
    return canAddSlot(slot, selected) ? sortSlots([...selected, slot]) : ordered;
}
