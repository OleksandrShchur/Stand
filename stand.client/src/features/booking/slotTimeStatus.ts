export type SlotTimeStatus = 'upcoming' | 'in-progress' | 'finished';

const kyivFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function getKyivDateTime(now: Date): { date: string; time: string } {
    const parts = Object.fromEntries(kyivFormatter.formatToParts(now).map(({ type, value }) => [type, value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export function getSlotTimeStatus(date: string, slot: { startTime: string; endTime: string }, now: Date): SlotTimeStatus {
    const current = getKyivDateTime(now);
    if (date < current.date || (date === current.date && current.time >= slot.endTime)) return 'finished';
    if (date === current.date && current.time >= slot.startTime) return 'in-progress';
    return 'upcoming';
}
