import type { MyShiftDto } from '../../api/types';

export function groupShiftsByDate(shifts: MyShiftDto[]) {
    const groups = new Map<string, MyShiftDto[]>();
    const sorted = [...shifts].sort((a, b) =>
        a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.id - b.id);
    for (const shift of sorted) {
        const group = groups.get(shift.date);
        if (group) group.push(shift);
        else groups.set(shift.date, [shift]);
    }
    return [...groups].map(([date, items]) => ({ date, shifts: items }));
}
